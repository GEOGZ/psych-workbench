'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function AssessmentToolsPage() {
  const { data: tools = [], isLoading } = trpc.assessmentTools.list.useQuery();
  const [search, setSearch] = useState('');

  const filtered = tools.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, typeof filtered> = {};
  for (const t of filtered) {
    const key = t.category ?? '未分类';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  const categories = Object.keys(grouped).sort();

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e' }}>测评工具库</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索工具名称、分类或描述…"
          style={{ flex: 1, minWidth: 200, padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem' }}
        />
        <a
          href="/workbench/assessment-tools/new"
          style={{ padding: '0.45rem 1rem', background: '#4a4af0', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          + 新增工具
        </a>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          {tools.length === 0 ? '暂无测评工具，点击"新增工具"开始添加。' : '没有匹配的工具。'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {categories.map(cat => (
            <div key={cat}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {(grouped[cat] ?? []).map(t => (
                  <a
                    key={t.id}
                    href={`/workbench/assessment-tools/${t.id}`}
                    style={{ display: 'block', background: '#fff', borderRadius: 8, padding: '0.9rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', textDecoration: 'none', color: 'inherit', border: '1px solid #eee' }}
                  >
                    <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>{t.name}</p>
                    {t.source && (
                      <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: '#888' }}>来源：{t.source}</p>
                    )}
                    {t.description && (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#555', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
