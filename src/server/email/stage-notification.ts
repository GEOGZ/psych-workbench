import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { clients } from '@/db/schema/clients';
import { mailer } from './mailer';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

function buildHtml(clientName: string, projectTitle: string, fromState: ProjectState, toState: ProjectState) {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5fa;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#4a4af0;padding:24px 32px">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:700">项目进展通知</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;color:#555;font-size:14px">您好，${clientName}，</p>
            <p style="margin:0 0 24px;color:#222;font-size:15px">
              您的项目 <strong>「${projectTitle}」</strong> 已推进到新阶段：
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;text-align:center">
              <tr>
                <td style="padding:10px 20px;background:#f0f0f8;border-radius:6px;font-size:14px;color:#555;font-weight:600">
                  ${STATE_ZH[fromState]}
                </td>
                <td style="padding:0 16px;color:#888;font-size:18px">→</td>
                <td style="padding:10px 20px;background:#4a4af0;border-radius:6px;font-size:14px;color:#fff;font-weight:700">
                  ${STATE_ZH[toState]}
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#888;font-size:13px">
              如有疑问，请联系您的顾问。
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8f8fc;border-top:1px solid #eee">
            <p style="margin:0;color:#aaa;font-size:12px">此邮件由系统自动发送，请勿直接回复。</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a stage-advance notification to the client's contactEmail.
 * Fire-and-forget — caller should use `void sendStageNotification(...)`.
 * Silently skips if the client has no contactEmail.
 */
export async function sendStageNotification(
  projectId: string,
  fromState: ProjectState,
  toState: ProjectState
): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { clientId: true, title: true }
  });
  if (!project) return;

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, project.clientId),
    columns: { name: true, contactEmail: true }
  });
  if (!client?.contactEmail) return;

  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to: client.contactEmail,
    subject: `项目进展：${project.title} 已推进至「${STATE_ZH[toState]}」`,
    html: buildHtml(client.name, project.title, fromState, toState)
  });
}
