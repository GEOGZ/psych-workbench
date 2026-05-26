'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ImeInput, ImeTextarea } from '@/components/ime';

type Competency = { dimension: string; weight: string };

export default function JobProfileDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: profile, isLoading, refetch } = trpc.jobProfiles.getById.useQuery({ id: params.id });

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [competencies, setCompetencies] = useState<Competency[]>([{ dimension: '', weight: '' }]);
  const [tools, setTools] = useState<string[]>(['']);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName((profile as Record<string, unknown>).name as string ?? '');
    setDepartment((profile as Record<string, unknown>).department as string ?? '');
    setNotes((profile as Record<string, unknown>).notes as string ?? '');
    const comps = Array.isArray(profile.competencies)
      ? (profile.competencies as { dimension: string; weight?: number }[]).map(c => ({
          dimension: c.dimension,
          weight: c.weight != null ? String(c.weight) : '',
        }))
      : [];
    setCompetencies(comps.length > 0 ? comps : [{ dimension: '', weight: '' }]);
    const ts = Array.isArray(profile.tools) ? (profile.tools as string[]) : [];
    setTools(ts.length > 0 ? ts : ['']);
  }, [profile]);

  const update = trpc.jobProfiles.update.useMutation({
    onSuccess: () => { refetch(); setError(''); },
    onError: (err) => setError(err.message),
  });
  const deleteMut = trpc.jobProfiles.delete.useMutation({
    onSuccess: () => router.push('/workbench/job-profiles'),
    onError: (err) => setError(err.message),
  });

  function setComp(i: number, field: keyof Competency, value: string) {
    setCompetencies(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }
  function addComp() { setCompetencies(cs => [...cs, { dimension: '', weight: '' }]); }
  function removeComp(i: number) { setCompetencies(cs => cs.filter((_, idx) => idx !== i)); }

  function setTool(i: number, value: string) {
    setTools(ts => ts.map((t, idx) => idx === i ? value : t));
  }
  function addTool() { setTools(ts => [...ts, '']); }
  function removeTool(i: number) { setTools(ts => ts.filter((_, idx) => idx !== i)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const validComps = competencies
      .filter(c => c.dimension.trim())
      .map(c => ({ dimension: c.dimension.trim(), weight: c.weight ? Number(c.weight) : undefined }));
    const validTools = tools.map(t => t.trim()).filter(Boolean);
    update.mutate({
      id: params.id,
      name: name.trim(),
      department: department.trim() || null,
      notes: notes.trim() || null,
      competencies: validComps,
      tools: validTools,
    });
  }

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;
  if (!profile) return <p style={{ color: '#888' }}>岗位画像不存在。</p>;

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <a href="/workbench/job-profiles" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>← 岗位画像</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{name || '编辑岗位画像'}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>岗位名称 *</label>
          <ImeInput value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>部门（可选）</label>
          <ImeInput value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 500 }}>胜任力维度</label>
            <button type="button" onClick={addComp} style={{ fontSize: '0.75rem', color: '#4a4af0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ 添加</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competencies.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ImeInput value={c.dimension} onChange={e => setComp(i, 'dimension', e.target.value)} placeholder="维度名称" style={{ ...inputStyle, flex: 2 }} />
                <input type="number" min={0} max={100} value={c.weight} onChange={e => setComp(i, 'weight', e.target.value)} placeholder="权重%" style={{ ...inputStyle, flex: 1 }} />
                {competencies.length > 1 && (
                  <button type="button" onClick={() => removeComp(i)} style={{ color: '#c00', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 500 }}>常用工具</label>
            <button type="button" onClick={addTool} style={{ fontSize: '0.75rem', color: '#4a4af0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ 添加</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {tools.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ImeInput value={t} onChange={e => setTool(i, e.target.value)} placeholder="工具名称" style={{ ...inputStyle, flex: 1 }} />
                {tools.length > 1 && (
                  <button type="button" onClick={() => removeTool(i)} style={{ color: '#c00', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>备注（可选）</label>
          <ImeTextarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={update.isPending} style={{ flex: 1, padding: '0.5rem', borderRadius: 5, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: update.isPending ? 0.6 : 1 }}>
            {update.isPending ? '保存中…' : '保存'}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: '0.5rem 1rem', borderRadius: 5, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            删除
          </button>
        </div>
      </form>

      {confirmDelete && (
        <div style={{ marginTop: '1rem', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', fontWeight: 600, color: '#c00' }}>
            确认删除「{name}」？此操作不可撤销。
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => deleteMut.mutate({ id: params.id })} disabled={deleteMut.isPending} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              {deleteMut.isPending ? '删除中…' : '确认删除'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
