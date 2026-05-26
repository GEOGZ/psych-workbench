import { z } from 'zod';
import { and, eq, gt, lt, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { contractorGrants } from '@/db/schema/contractor-grants';
import { users } from '@/db/schema/users';
import { projects } from '@/db/schema/projects';

export const grantsRouter = router({
  /** List active grants for a project (non-revoked, non-expired). */
  listForProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .use(adminOrOwner)
    .query(async ({ input, ctx }) => {
      const now = new Date();
      const grants = await ctx.db.query.contractorGrants.findMany({
        where: and(
          eq(contractorGrants.projectId, input.projectId),
          isNull(contractorGrants.revokedAt),
          gt(contractorGrants.expiresAt, now)
        ),
        columns: { id: true, userId: true, grantedAt: true, expiresAt: true }
      });

      if (grants.length === 0) return [];

      const userIds = grants.map((g) => g.userId);
      const contractorUsers = await ctx.db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, userIds),
        columns: { id: true, name: true, email: true }
      });

      const userMap = Object.fromEntries(contractorUsers.map((u) => [u.id, u]));

      return grants.map((g) => ({
        ...g,
        user: userMap[g.userId] ?? { id: g.userId, name: null, email: '(unknown)' }
      }));
    }),

  /** List all users with role='contractor' (for the grant dropdown). */
  listContractors: protectedProcedure
    .use(adminOrOwner)
    .query(({ ctx }) =>
      ctx.db.query.users.findMany({
        where: eq(users.role, 'contractor'),
        columns: { id: true, name: true, email: true }
      })
    ),

  /**
   * Grant (or re-grant) a contractor access to a project.
   * Uses upsert: if a row already exists (revoked or expired), refresh it.
   */
  grant: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        expiresAt: z.string().datetime()
      })
    )
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.query.contractorGrants.findFirst({
        where: and(
          eq(contractorGrants.userId, input.userId),
          eq(contractorGrants.projectId, input.projectId)
        ),
        columns: { id: true }
      });

      if (existing) {
        const [row] = await ctx.db
          .update(contractorGrants)
          .set({
            revokedAt: null,
            expiresAt: new Date(input.expiresAt),
            grantedByUserId: ctx.user.id,
            grantedAt: new Date()
          })
          .where(eq(contractorGrants.id, existing.id))
          .returning();
        return row;
      }

      const [row] = await ctx.db
        .insert(contractorGrants)
        .values({
          userId: input.userId,
          projectId: input.projectId,
          grantedByUserId: ctx.user.id,
          expiresAt: new Date(input.expiresAt)
        })
        .returning();
      return row;
    }),

  /** Revoke a contractor's access to a project immediately. */
  revoke: protectedProcedure
    .input(z.object({ grantId: z.string().uuid() }))
    .use(adminOrOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(contractorGrants)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(contractorGrants.id, input.grantId),
            isNull(contractorGrants.revokedAt)
          )
        );
      return { ok: true };
    }),

  /** List projects the current user has active contractor grants for. */
  listMyProjects: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const grants = await ctx.db.query.contractorGrants.findMany({
        where: and(
          eq(contractorGrants.userId, ctx.user.id),
          isNull(contractorGrants.revokedAt),
          gt(contractorGrants.expiresAt, now)
        ),
        columns: { id: true, projectId: true, expiresAt: true }
      });
      if (grants.length === 0) return [];
      const projectIds = grants.map(g => g.projectId);
      const myProjects = await ctx.db.query.projects.findMany({
        where: (p, { inArray }) => inArray(p.id, projectIds)
      });
      return myProjects.map(p => ({
        ...p,
        grantExpiresAt: grants.find(g => g.projectId === p.id)!.expiresAt
      }));
    }),

  /** List active grants expiring within 14 days (for dashboard alert). */
  listExpiringSoon: protectedProcedure
    .use(adminOrOwner)
    .query(async ({ ctx }) => {
      const now = new Date();
      const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const grants = await ctx.db.query.contractorGrants.findMany({
        where: and(
          isNull(contractorGrants.revokedAt),
          gt(contractorGrants.expiresAt, now),
          lt(contractorGrants.expiresAt, in14d)
        ),
        columns: { id: true, userId: true, projectId: true, expiresAt: true }
      });
      if (grants.length === 0) return [];
      const userIds = [...new Set(grants.map(g => g.userId))];
      const projectIds = [...new Set(grants.map(g => g.projectId))];
      const [grantUsers, grantProjects] = await Promise.all([
        ctx.db.query.users.findMany({
          where: (u, { inArray }) => inArray(u.id, userIds),
          columns: { id: true, name: true, email: true }
        }),
        ctx.db.query.projects.findMany({
          where: (p, { inArray }) => inArray(p.id, projectIds),
          columns: { id: true, title: true }
        })
      ]);
      const userMap = Object.fromEntries(grantUsers.map(u => [u.id, u]));
      const projectMap = Object.fromEntries(grantProjects.map(p => [p.id, p]));
      return grants.map(g => ({
        ...g,
        user: userMap[g.userId] ?? { id: g.userId, name: null, email: '(unknown)' },
        project: projectMap[g.projectId] ?? { id: g.projectId, title: '(unknown)' }
      }));
    })
});
