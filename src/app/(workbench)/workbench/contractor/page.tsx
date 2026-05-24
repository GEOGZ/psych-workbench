'use client';

import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

const STATE_COLOR: Record<ProjectState, string> = {
  lead: '#9ca3af', qualifying: '#f59e0b', discovery: '#3b82f6',
  contract: '#8b5cf6', execution: '#10b981', reporting: '#06b6d4',
  closing: '#f97316', done: '#6b7280'
};

export default function ContractorPage() {
  const { data: projects = [], isLoading } = trpc.grants.listMyProjects.useQuery();

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>我的授权项目</h1>

      {projects.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', color: '#888', fontSize: '0.875rem' }}>
          暂无授权项目。请联系管理员获取项目访问权限。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {projects.map(p => {
            const title = (p as Record<string, unknown>).title as string ?? p.id;
            const expiry = new Date((p as Record<string, unknown>).grantExpiresAt as string);
            const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
            return (
              <a
                key={p.id}
                href={`/workbench/projects/${p.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
                  textDecoration: 'none', color: 'inherit',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
                }}
              >
                <span style={{
                  fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 20, fontWeight: 600,
                  background: STATE_COLOR[p.state] + '22', color: STATE_COLOR[p.state],
                  whiteSpace: 'nowrap'
                }}>
                  {STATE_ZH[p.state] ?? p.state}
                </span>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{title}</span>
                <span style={{
                  fontSize: '0.72rem', color: daysLeft <= 7 ? '#ef4444' : '#9ca3af',
                  whiteSpace: 'nowrap'
                }}>
                  授权剩余 {daysLeft} 天
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
