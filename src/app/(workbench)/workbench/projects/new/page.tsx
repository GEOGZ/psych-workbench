'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: clients = [] } = trpc.clients.list.useQuery();

  // Pre-select client when coming from client detail page
  useEffect(() => {
    const pre = searchParams.get('clientId');
    if (pre) setClientId(pre);
  }, [searchParams]);

  const create = trpc.projects.create.useMutation({
    onSuccess: (rows) => {
      const id = Array.isArray(rows) ? rows[0]?.id : (rows as { id: string })?.id;
      const from = searchParams.get('clientId');
      if (id) router.push(`/workbench/projects/${id}`);
      else if (from) router.push(`/workbench/clients/${from}`);
      else router.push('/workbench/projects');
    },
    onError: (err) => setError(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !clientId) return;
    create.mutate({ title: title.trim(), clientId, notes: notes.trim() || undefined });
  };

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const
  };

  const fromClientId = searchParams.get('clientId');

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <a
          href={fromClientId ? `/workbench/clients/${fromClientId}` : '/workbench/projects'}
          style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}
        >
          ← {fromClientId ? '返回客户' : '项目列表'}
        </a>
      </div>
      <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>新建项目</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>项目名称 *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="例：王小姐 EAP 评估" style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>关联客户 *</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} required style={inputStyle}>
            <option value="">— 选择客户 —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <a href="/workbench/clients/new" style={{ fontSize: '0.75rem', color: '#4a4af0', marginTop: '0.2rem', display: 'inline-block' }}>+ 新建客户</a>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>备注（可选）</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={create.isLoading}
          style={{
            padding: '0.5rem', borderRadius: 5, border: 'none',
            background: '#4a4af0', color: '#fff', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 600,
            opacity: create.isLoading ? 0.6 : 1
          }}
        >
          {create.isLoading ? '创建中…' : '创建项目'}
        </button>
      </form>
    </div>
  );
}
