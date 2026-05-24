'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { ImeInput } from '@/components/ime';

const PAGE_SIZE = 15;

export default function ClientsPage() {
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.contactName.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>客户列表</h1>
        <a href="/workbench/clients/new" style={{
          padding: '0.4rem 0.85rem', borderRadius: 5, background: '#4a4af0',
          color: '#fff', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600
        }}>
          + 新建
        </a>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <ImeInput
          type="text"
          placeholder="搜索客户名或联系人…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 320, padding: '0.4rem 0.75rem',
            border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem',
            outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          {search ? '没有匹配的客户。' : '暂无客户档案。'}
        </p>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8f8fc', borderBottom: '1px solid #eee' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>姓名</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>联系人</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>联系邮箱</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>危机联系</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < paged.length - 1 ? '1px solid #f0f0f8' : 'none' }}>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: 500 }}>
                      <a href={`/workbench/clients/${c.id}`} style={{ color: '#4a4af0', textDecoration: 'none' }}>
                        {c.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#555' }}>{c.contactName}</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#555' }}>{c.contactEmail ?? '—'}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: c.crisisContactName ? '#065f46' : '#c00' }}>
                        {c.crisisContactName ? `✓ ${c.crisisContactName}` : '未填写'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
              <button
                onClick={() => setPage(p => p - 1)} disabled={page === 1}
                style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === 1 ? '#ccc' : '#4a4af0', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >上一页</button>
              <span style={{ fontSize: '0.8rem', color: '#555' }}>第 {page} 页 / 共 {totalPages} 页</span>
              <button
                onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === totalPages ? '#ccc' : '#4a4af0', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
