'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function AssessmentToolDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: tool, isLoading } = trpc.assessmentTools.getById.useQuery({ id: params.id });
  const update = trpc.assessmentTools.update.useMutation({ onSuccess: () => setEditing(false) });
  const del = trpc.assessmentTools.delete.useMutation({ onSuccess: () => router.push('/workbench/assessment-tools') });

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', description: '', source: '' });

  function startEdit() {
    if (!tool) return;
    setForm({ name: tool.name, category: tool.category ?? '', description: tool.description ?? '', source: tool.source ?? '' });
    setEditing(true);
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: params.id,
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      source: form.source.trim() || null,
    });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.45rem 0.7rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' };

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;
  if (!tool) return <p style={{ color: '#c00' }}>未找到该工具。</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <a href="/workbench/assessment-tools" style={{ color: '#888', textDecoration: 'none', fontSize: '0.875rem' }}>← 返回工具库</a>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{tool.name}</h1>
        {!editing && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={startEdit} style={{ padding: '0.35rem 0.85rem', border: '1px solid #4a4af0', color: '#4a4af0', background: '#fff', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>编辑</button>
            <button onClick={() => setConfirmDelete(true)} style={{ padding: '0.35rem 0.85rem', border: '1px solid #e55', color: '#e55', background: '#fff', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>删除</button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div style={{ background: '#fff8f8', border: '1px solid #fcc', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>确认删除「{tool.name}」？此操作不可撤销。</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => del.mutate({ id: params.id })} disabled={del.isPending} style={{ padding: '0.4rem 1rem', background: '#e55', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
              {del.isPending ? '删除中…' : '确认删除'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: '0.4rem 0.85rem', border: '1px solid #ddd', background: '#fff', color: '#555', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {editing ? (
        <form onSubmit={handleUpdate} style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>工具名称 *</label>
            <input required value={form.name} onChange={set('name')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>分类</label>
            <input value={form.category} onChange={set('category')} placeholder="如：性格测评、能力测评" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>来源 / 出版方</label>
            <input value={form.source} onChange={set('source')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>简介</label>
            <textarea value={form.description} onChange={set('description')} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {update.error && <p style={{ margin: 0, color: '#c00', fontSize: '0.8rem' }}>{update.error.message}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', background: '#fff', color: '#555', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>取消</button>
            <button type="submit" disabled={update.isPending} style={{ padding: '0.5rem 1.25rem', background: '#4a4af0', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              {update.isPending ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {tool.category && (
            <div>
              <p style={{ ...labelStyle, marginBottom: '0.2rem' }}>分类</p>
              <span style={{ display: 'inline-block', background: '#f0f0f8', color: '#4a4af0', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.8rem' }}>{tool.category}</span>
            </div>
          )}
          {tool.source && (
            <div>
              <p style={{ ...labelStyle, marginBottom: '0.2rem' }}>来源 / 出版方</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#333' }}>{tool.source}</p>
            </div>
          )}
          {tool.description && (
            <div>
              <p style={{ ...labelStyle, marginBottom: '0.2rem' }}>简介</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{tool.description}</p>
            </div>
          )}
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#aaa' }}>
            创建于 {new Date(tool.createdAt).toLocaleDateString('zh-CN')}
            {tool.updatedAt !== tool.createdAt && `，最后更新 ${new Date(tool.updatedAt).toLocaleDateString('zh-CN')}`}
          </p>
        </div>
      )}
    </div>
  );
}
