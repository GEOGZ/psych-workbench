'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

export default function PortalPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { token } = params;

  const { data: validation, isError: tokenInvalid } = trpc.portal.validate.useQuery(
    { token },
    { retry: false }
  );

  const { data: projects = [], isLoading } = trpc.portal.listProjects.useQuery(
    { token },
    { enabled: !!validation }
  );

  useEffect(() => {
    if (tokenInvalid) router.replace('/portal/expired');
  }, [tokenInvalid, router]);

  if (tokenInvalid) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5fa', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '1rem 1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#333' }}>您的咨询项目进展</h1>
        {validation && (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#888' }}>
            访问有效至 {new Date(validation.expiresAt).toLocaleDateString('zh-CN')}
          </p>
        )}
      </header>

      <main style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
        {isLoading ? (
          <p style={{ color: '#888' }}>加载中…</p>
        ) : projects.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.875rem' }}>暂无进行中的项目。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projects.map(p => (
              <a
                key={p.id}
                href={`/portal/${token}/project/${p.id}`}
                style={{
                  display: 'block', background: '#fff', borderRadius: 8, padding: '1rem 1.25rem',
                  textDecoration: 'none', color: 'inherit',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #eee'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 20,
                    background: '#e8f4fd', color: '#0968d6', fontWeight: 600
                  }}>
                    {STATE_ZH[p.state as ProjectState] ?? p.state}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {p.title ?? p.id}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                  更新于 {new Date((p as Record<string, unknown>).updatedAt as string).toLocaleDateString('zh-CN')}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
