import { z } from 'zod';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { clientPortalTokens } from '@/db/schema/client-portal-tokens';
import { projects } from '@/db/schema/projects';
import { clients } from '@/db/schema/clients';
import { projectChecklistItems } from '@/db/schema/checklist';
import { projectReports } from '@/db/schema/project-reports';
import { reportAccessLogs } from '@/db/schema/report-access-logs';
import { randomBytes } from 'crypto';
import { mailer } from '@/server/email/mailer';
import { generateDownloadUrl } from '@/lib/oss';
import type { DbClient } from '@/db';

const TOKEN_BYTES = 32;
const TOKEN_HEX_LENGTH = TOKEN_BYTES * 2; // 64

/** Shared token validation — reusable across portal procedures. */
async function requireValidToken(db: DbClient, token: string) {
  const now = new Date();
  const row = await db.query.clientPortalTokens.findFirst({
    where: and(
      eq(clientPortalTokens.token, token),
      isNull(clientPortalTokens.revokedAt),
      gt(clientPortalTokens.expiresAt, now)
    )
  });

  if (!row) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }

  return row;
}

/**
 * Client-safe project fields — excludes financial and internal-only fields.
 * Security: clients never see contract amounts, discount rates, or owner IDs.
 */
const CLIENT_PROJECT_FIELDS = {
  id: true,
  title: true,
  state: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} as const;

export const portalRouter = router({
  // ─── Public (token-gated) ──────────────────────────────────────────────────

  /**
   * Validate a token and return its metadata.
   * Called on portal entry to confirm the link is still usable.
   */
  validate: publicProcedure
    .input(z.object({ token: z.string().length(TOKEN_HEX_LENGTH) }))
    .query(async ({ input, ctx }) => {
      const row = await requireValidToken(ctx.db, input.token);
      // update lastUsedAt without blocking the caller
      void ctx.db
        .update(clientPortalTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(clientPortalTokens.id, row.id));

      return {
        clientId: row.clientId,
        expiresAt: row.expiresAt
      };
    }),

  /**
   * List projects for the client associated with this token.
   * Returns only client-safe fields.
   */
  listProjects: publicProcedure
    .input(z.object({ token: z.string().length(TOKEN_HEX_LENGTH) }))
    .query(async ({ input, ctx }) => {
      const tokenRow = await requireValidToken(ctx.db, input.token);

      return ctx.db.query.projects.findMany({
        where: eq(projects.clientId, tokenRow.clientId),
        columns: CLIENT_PROJECT_FIELDS,
        orderBy: (p, { desc }) => [desc(p.updatedAt)]
      });
    }),

  /**
   * Get a single project — verifies the project belongs to the token's client.
   */
  getProject: publicProcedure
    .input(
      z.object({
        token: z.string().length(TOKEN_HEX_LENGTH),
        projectId: z.string().uuid()
      })
    )
    .query(async ({ input, ctx }) => {
      const tokenRow = await requireValidToken(ctx.db, input.token);

      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.clientId, tokenRow.clientId)
        ),
        columns: CLIENT_PROJECT_FIELDS
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return project;
    }),

  /**
   * Returns checklist items for a project (completion tracking for client portal).
   * Token must belong to the project's client.
   */
  getChecklist: publicProcedure
    .input(z.object({
      token: z.string().length(TOKEN_HEX_LENGTH),
      projectId: z.string().uuid()
    }))
    .query(async ({ input, ctx }) => {
      const tokenRow = await requireValidToken(ctx.db, input.token);

      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.clientId, tokenRow.clientId)),
        columns: { id: true }
      });

      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.db
        .select()
        .from(projectChecklistItems)
        .where(eq(projectChecklistItems.projectId, input.projectId));
    }),

  // ─── Admin / Owner — token management ─────────────────────────────────────

  /**
   * Issue a portal token for a client.
   * Generates a cryptographically random 32-byte (64 hex-char) token.
   */
  issueToken: protectedProcedure
    .use(adminOrOwner)
    .input(
      z.object({
        clientId: z.string().uuid(),
        expiresAt: z.string().datetime()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clientExists = await ctx.db.query.clients.findFirst({
        where: eq(clients.id, input.clientId),
        columns: { id: true }
      });

      if (!clientExists) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      const token = randomBytes(TOKEN_BYTES).toString('hex');

      const [row] = await ctx.db
        .insert(clientPortalTokens)
        .values({
          clientId: input.clientId,
          issuedByUserId: ctx.user.id,
          token,
          expiresAt: new Date(input.expiresAt)
        })
        .returning();

      return row;
    }),

  /**
   * Revoke a portal token immediately.
   */
  revokeToken: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ tokenId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(clientPortalTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(clientPortalTokens.id, input.tokenId),
            isNull(clientPortalTokens.revokedAt)
          )
        );

      return { ok: true };
    }),

  /**
   * List active (non-expired, non-revoked) tokens for a client.
   */
  listTokens: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ clientId: z.string().uuid() }))
    .query(({ input, ctx }) => {
      const now = new Date();
      return ctx.db.query.clientPortalTokens.findMany({
        where: and(
          eq(clientPortalTokens.clientId, input.clientId),
          isNull(clientPortalTokens.revokedAt),
          gt(clientPortalTokens.expiresAt, now)
        ),
        columns: {
          id: true,
          clientId: true,
          token: true,
          issuedAt: true,
          expiresAt: true,
          lastUsedAt: true
        },
        orderBy: (t, { desc }) => [desc(t.issuedAt)]
      });
    }),

  /**
   * Send the portal link to the client's contact email.
   */
  sendPortalLink: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ tokenId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const tokenRow = await ctx.db.query.clientPortalTokens.findFirst({
        where: and(
          eq(clientPortalTokens.id, input.tokenId),
          isNull(clientPortalTokens.revokedAt),
          gt(clientPortalTokens.expiresAt, new Date())
        ),
        columns: { id: true, token: true, clientId: true, expiresAt: true }
      });
      if (!tokenRow) throw new TRPCError({ code: 'NOT_FOUND', message: 'Token 无效或已过期' });

      const client = await ctx.db.query.clients.findFirst({
        where: eq(clients.id, tokenRow.clientId),
        columns: { name: true, contactEmail: true, contactName: true }
      });
      if (!client?.contactEmail) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '客户未填写联系邮箱，无法发送' });
      }

      const base = process.env.PORTAL_BASE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const portalUrl = `${base}/portal/${tokenRow.token}`;
      const expiry = new Date(tokenRow.expiresAt).toLocaleDateString('zh-CN');

      await mailer.sendMail({
        from: process.env.EMAIL_FROM,
        to: client.contactEmail,
        subject: '您的咨询项目进度门户链接',
        html: `<p>您好，${client.contactName}，</p>
<p>以下是您的专属项目进度门户链接，有效期至 <strong>${expiry}</strong>：</p>
<p><a href="${portalUrl}" style="color:#4a4af0;font-weight:bold;">${portalUrl}</a></p>
<p>通过此链接，您可以随时查看项目进展和阶段状态。</p>
<p>如有疑问，请联系您的顾问。</p>`,
        text: `您好，${client.contactName}，\n\n您的项目门户链接（有效期至 ${expiry}）：\n${portalUrl}\n\n如有疑问请联系您的顾问。`
      });

      return { ok: true };
    }),

  listReports: publicProcedure
    .input(z.object({ token: z.string(), projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const tokenRow = await requireValidToken(ctx.db, input.token);
      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, input.projectId), eq(projects.clientId, tokenRow.clientId)),
        columns: { id: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      const reports = await ctx.db.query.projectReports.findMany({
        where: and(eq(projectReports.projectId, input.projectId), eq(projectReports.visibleToPortal, true)),
        columns: { id: true, title: true, fileType: true, fileSize: true, uploadedAt: true, fileKey: true },
      });
      return reports;
    }),

  downloadReport: publicProcedure
    .input(z.object({ token: z.string(), reportId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const tokenRow = await requireValidToken(ctx.db, input.token);
      const report = await ctx.db.query.projectReports.findFirst({
        where: and(eq(projectReports.id, input.reportId), eq(projectReports.visibleToPortal, true)),
        columns: { id: true, fileKey: true, projectId: true },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND' });
      const project = await ctx.db.query.projects.findFirst({
        where: and(eq(projects.id, report.projectId), eq(projects.clientId, tokenRow.clientId)),
        columns: { id: true },
      });
      if (!project) throw new TRPCError({ code: 'FORBIDDEN' });
      await ctx.db.insert(reportAccessLogs).values({
        reportId: input.reportId,
        actorType: 'portal',
        portalTokenId: tokenRow.id,
        action: 'download',
      });
      return { downloadUrl: generateDownloadUrl(report.fileKey) };
    }),
});
