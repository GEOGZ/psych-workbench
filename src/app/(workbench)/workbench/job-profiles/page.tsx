'use client';

import { trpc } from '@/lib/trpc';

export default function JobProfilesPage() {
  const { data: profiles = [], isLoading } = trpc.jobProfiles.list.useQuery();

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>岗位画像</h1>
        <a href="/workbench/job-profiles/new" style={{
          padding: '0.4rem 0.85rem', borderRadius: 5, background: '#4a4af0',
          color: '#fff', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600
        }}>
          + 新建
        </a>
      </div>

      {profiles.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>暂无岗位画像。点击「新建」创建第一个。</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {profiles.map((p) => (
            <a
              key={p.id}
              href={`/workbench/job-profiles/${p.id}`}
              style={{
                display: 'block', background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textDecoration: 'none', color: 'inherit'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>{p.name}</span>
                {p.department && (
                  <span style={{ fontSize: '0.75rem', color: '#666', background: '#f0f0f8', padding: '0.15rem 0.45rem', borderRadius: 20 }}>
                    {p.department}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#888' }}>
                  {Array.isArray(p.competencies) ? (p.competencies as unknown[]).length : 0} 项能力
                  &nbsp;·&nbsp;
                  {Array.isArray(p.tools) ? (p.tools as unknown[]).length : 0} 个工具
                </span>
              </div>
              {p.notes && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.notes}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
