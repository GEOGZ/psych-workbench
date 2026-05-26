'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function NewAssessmentToolPage() {
  const router = useRouter();
  const create = trpc.assessmentTools.create.useMutation({
    onSuccess: (rows) => {
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row) router.push(`/workbench/assessment-tools/${row.id}`);
    },
  });

  const [form, setForm] = useState({ name: '', category: '', description: '', source: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      source: form.source.trim() || undefined,
    });
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.45rem 0.7rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <a href="/workbench/assessment-tools" style={{ color: '#888', textDecoration: 'none', fontSize: '0.875rem' }}>← 返回工具库</a>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' }}>新增测评工具</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>工具名称 *</label>
          <input required value={form.name} onChange={set('name')} placeholder="如：MBTI、DISC、盖洛普优势" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>分类</label>
          <input value={form.category} onChange={set('category')} placeholder="如：性格测评、能力测评、价值观" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>来源 / 出版方</label>
          <input value={form.source} onChange={set('source')} placeholder="如：Myers & Briggs Foundation" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>简介</label>
          <textarea value={form.description} onChange={set('description')} rows={4} placeholder="工具的背景、适用场景、理论框架等…" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {create.error && <p style={{ margin: 0, color: '#c00', fontSize: '0.8rem' }}>{create.error.message}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <a href="/workbench/assessment-tools" style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: '#555', fontSize: '0.875rem' }}>取消</a>
          <button type="submit" disabled={create.isPending} style={{ padding: '0.5rem 1.25rem', background: '#4a4af0', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
            {create.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
