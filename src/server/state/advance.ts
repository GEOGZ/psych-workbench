import { TRPCError } from '@trpc/server';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '@/db';
import { projects, type ProjectState } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { projectChecklistItems } from '@/db/schema/checklist';
import { transitions, prevTransitions } from './transitions';
import { sendStageNotification } from '@/server/email/stage-notification';
import { CHECKLIST_KEYS } from '@/lib/checklist-defs';

export interface AdvanceResult {
  projectId: string;
  fromState: ProjectState;
  toState: ProjectState;
}

/**
 * Atomically advances a project's state with validation and audit logging.
 *
 * Uses database transactions to ensure:
 * 1. Row-level locking (FOR UPDATE) prevents race conditions
 * 2. State transition rules are enforced
 * 3. Event audit trail is created
 *
 * @param projectId - The project to advance
 * @param toState - The target state
 * @param byUserId - The user performing the advancement
 * @param note - Optional note for the audit trail
 * @returns The advancement result (fromState, toState)
 * @throws TRPCError('NOT_FOUND') if project does not exist
 * @throws TRPCError('BAD_REQUEST') if the state transition is not allowed
 */
export async function advanceProject(
  projectId: string,
  toState: ProjectState,
  byUserId: string,
  note?: string,
  revert?: boolean
): Promise<AdvanceResult> {
  const result = await db.transaction(async (tx) => {
    // Lock the row to prevent concurrent state changes
    const rows = await tx.execute(
      sql`SELECT id, state, stage_meta FROM projects WHERE id = ${projectId} FOR UPDATE`
    );

    let proj: { id: string; state: ProjectState; stage_meta: unknown } | undefined;
    if (Array.isArray(rows)) {
      proj = (rows as Array<{ id: string; state: ProjectState; stage_meta: unknown }>)[0];
    } else if (rows && typeof rows === 'object' && 'rows' in rows) {
      proj = (rows as unknown as { rows: Array<{ id: string; state: ProjectState; stage_meta: unknown }> }).rows[0];
    }

    if (!proj) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    const fromState = proj.state;

    // Block forward advances when checklist items are incomplete
    if (!revert) {
      const requiredKeys = CHECKLIST_KEYS[fromState] ?? [];
      if (requiredKeys.length > 0) {
        const checkedRows = await tx
          .select({ key: projectChecklistItems.key })
          .from(projectChecklistItems)
          .where(
            and(
              eq(projectChecklistItems.projectId, projectId),
              eq(projectChecklistItems.stage, fromState),
              eq(projectChecklistItems.checked, true)
            )
          );
        const checkedSet = new Set(checkedRows.map(r => r.key));
        const missing = requiredKeys.filter(k => !checkedSet.has(k));
        if (missing.length > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `请先完成当前阶段的所有自检清单项（还差 ${missing.length} 项未完成）`
          });
        }
      }
    }

    // Threshold gate: pricing discount and contract amount rules (discovery → contract only)
    if (!revert && fromState === 'discovery') {
      const meta = (proj.stage_meta ?? {}) as Record<string, unknown>;
      const dr = typeof meta.discountRate === 'number' ? meta.discountRate : null;
      const ca = typeof meta.contractAmount === 'number' ? meta.contractAmount : null;

      if (dr !== null && dr < 70) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `折扣率 ${dr}% 低于 70% 红线，请拆分为小额试单或拒绝本项目`
        });
      }
      if (dr !== null && dr >= 70 && dr < 85) {
        const since = meta._discountCoolingSince;
        if (!since) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `折扣率（${dr}%）触发 24h 冷静期，请先保存阶段数据以启动计时`
          });
        }
        const elapsed = Date.now() - new Date(since as string).getTime();
        if (elapsed < 24 * 3600 * 1000) {
          const remainHours = Math.ceil((24 * 3600 * 1000 - elapsed) / 3600000);
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `折扣冷静期未结束，还需等待约 ${remainHours} 小时`
          });
        }
      }
      if (ca !== null && ca > 200000) {
        const reviewed = typeof meta._lawyerReviewConfirmed === 'string'
          ? meta._lawyerReviewConfirmed
          : '';
        if (!reviewed.startsWith('yes')) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `合同金额 ¥${(ca / 10000).toFixed(1)}万 超过 20 万，需外部律师审核后在阶段数据中确认`
          });
        }
      }
    }

    // Validate the state transition
    const allowed = revert ? prevTransitions[fromState] : transitions[fromState];
    if (!allowed.includes(toState)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Illegal state ${revert ? 'revert' : 'advance'}: ${fromState} -> ${toState}`
      });
    }

    // Update project state
    await tx
      .update(projects)
      .set({ state: toState, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    // Create audit event
    await tx.insert(projectEvents).values({
      projectId,
      actorUserId: byUserId,
      eventType: 'state_advanced',
      payload: {
        fromState,
        toState,
        note: note ?? null
      }
    });

    return { projectId, fromState, toState };
  });

  // Fire-and-forget after the transaction commits — email failure must not fail the advance.
  void sendStageNotification(result.projectId, result.fromState, result.toState).catch(() => {});

  return result;
}
