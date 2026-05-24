import { TRPCError } from '@trpc/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { middleware, protectedProcedure } from './trpc';
import { contractorGrants } from '@/db/schema/contractor-grants';

export const ownerOnly = middleware(({ ctx, next }) => {
  if (ctx.user?.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const adminOrOwner = middleware(({ ctx, next }) => {
  const role = ctx.user?.role;
  if (role !== 'owner' && role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const contractorScoped = middleware(async ({ ctx, rawInput, next }) => {
  const role = ctx.user?.role;
  if (role === 'owner' || role === 'admin') {
    return next();
  }
  if (role !== 'contractor' || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const input = rawInput as { projectId?: string } | undefined;
  const projectId = input?.projectId;
  if (!projectId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'contractorScoped requires projectId in input'
    });
  }

  const grant = await ctx.db.query.contractorGrants.findFirst({
    where: and(
      eq(contractorGrants.userId, ctx.user.id),
      eq(contractorGrants.projectId, projectId),
      gt(contractorGrants.expiresAt, new Date()),
      isNull(contractorGrants.revokedAt)
    )
  });
  if (!grant) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx: { ...ctx, grant } });
});

export const ownerProcedure = protectedProcedure.use(ownerOnly);
export const adminProcedure = protectedProcedure.use(adminOrOwner);
export const contractorProcedure = protectedProcedure.use(contractorScoped);
