import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { projects, type ProjectState } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { transitions, prevTransitions } from './transitions';
import { sendStageNotification } from '@/server/email/stage-notification';

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
      sql`SELECT id, state FROM projects WHERE id = ${projectId} FOR UPDATE`
    );

    let proj: { id: string; state: ProjectState } | undefined;
    if (Array.isArray(rows)) {
      proj = (rows as Array<{ id: string; state: ProjectState }>)[0];
    } else if (rows && typeof rows === 'object' && 'rows' in rows) {
      proj = (rows as unknown as { rows: Array<{ id: string; state: ProjectState }> }).rows[0];
    }

    if (!proj) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    const fromState = proj.state;

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
