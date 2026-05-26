import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import { router, protectedProcedure } from '../trpc';
import { adminOrOwner } from '../middleware';
import { projectReports } from '@/db/schema/project-reports';
import { reportAccessLogs } from '@/db/schema/report-access-logs';
import { projectEvents } from '@/db/schema/project-events';
import { generateUploadUrl, generateDownloadUrl, deleteObject } from '@/lib/oss';

const FILE_TYPES = ['pdf', 'word', 'other'] as const;
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  other: 'application/octet-stream',
};

export const reportsRouter = router({
  getUploadUrl: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({
      projectId: z.string().uuid(),
      fileType: z.enum(FILE_TYPES),
      fileName: z.string().min(1),
    }))
    .mutation(({ input }) => {
      const ext = input.fileType === 'pdf' ? '.pdf' : input.fileType === 'word' ? '.docx' : '';
      const fileKey = `reports/${input.projectId}/${randomUUID()}${ext}`;
      const uploadUrl = generateUploadUrl(fileKey, CONTENT_TYPES[input.fileType] ?? 'application/octet-stream');
      return { uploadUrl, fileKey };
    }),

  confirmUpload: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1),
      fileType: z.enum(FILE_TYPES),
      fileKey: z.string().min(1),
      fileUrl: z.string().url(),
      fileSize: z.number().int().positive().optional(),
      visibleToPortal: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const [report] = await ctx.db.insert(projectReports).values({
        projectId: input.projectId,
        title: input.title,
        fileType: input.fileType,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize ?? null,
        uploadedBy: ctx.user.id,
        visibleToPortal: input.visibleToPortal,
      }).returning();
      if (!report) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await ctx.db.insert(projectEvents).values({
        projectId: input.projectId,
        actorUserId: ctx.user.id,
        eventType: 'report_uploaded',
        payload: { reportId: report.id, title: input.title, fileType: input.fileType },
      });
      return report;
    }),

  listByProject: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const reports = await ctx.db.query.projectReports.findMany({
        where: eq(projectReports.projectId, input.projectId),
        orderBy: [desc(projectReports.uploadedAt)],
      });
      return reports.map(r => ({
        ...r,
        downloadUrl: generateDownloadUrl(r.fileKey),
      }));
    }),

  togglePortalVisibility: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ reportId: z.string().uuid(), visible: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await ctx.db.update(projectReports)
        .set({ visibleToPortal: input.visible })
        .where(eq(projectReports.id, input.reportId))
        .returning({ id: projectReports.id });
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  delete: protectedProcedure
    .use(adminOrOwner)
    .input(z.object({ reportId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const report = await ctx.db.query.projectReports.findFirst({
        where: eq(projectReports.id, input.reportId),
        columns: { fileKey: true },
      });
      if (!report) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db.delete(projectReports).where(eq(projectReports.id, input.reportId));
      try { await deleteObject(report.fileKey); } catch {}
      return { success: true };
    }),

  logAccess: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid(),
      action: z.enum(['view', 'download']),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.insert(reportAccessLogs).values({
        reportId: input.reportId,
        actorType: 'user',
        userId: ctx.user.id,
        action: input.action,
      });
      return { success: true };
    }),
});
