'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ImeInput, ImeTextarea } from '@/components/ime';

type Competency = { dimension: string; weight: string };

export default function NewJobProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [competencies, setCompetencies] = useState<Competency[]>([{ dimension: '', weight: '' }]);
  const [tools, setTools] = useState<string[]>(['']);
  const [error, setError] = useState('');

  const create = trpc.jobProfiles.create.useMutation({
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
      .map(c => ({
        dimension: c.dimension.trim(),
        weight: c.weight ? Number(c.weight) : undefined,
      }));
    const validTools = tools.map(t => t.trim()).filter(Boolean);
    create.mutate({
      name: name.trim(),
      department: department.trim() || undefined,
      notes: notes.trim() || undefined,
      competencies: validComps,
      tools: validTools,
    });
  }

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <a href="/workbench/job-profiles" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>← 岗位画像</a>
      </div>
      <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>新建岗位画像</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>岗位名称 *</label>
          <ImeInput value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="如：高级咨询顾问" />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>部门（可选）</label>
          <ImeInput value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle} placeholder="如：人力资源部" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 500 }}>胜任力维度</label>
            <button type="button" onClick={addComp} style={{ fontSize: '0.75rem', color: '#4a4af0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ 添加</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competencies.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <ImeInput
                  value={c.dimension}
                  onChange={e => setComp(i, 'dimension', e.target.value)}
                  placeholder="维度名称"
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  type="number"
                  min={0} max={100}
                  value={c.weight}
                  onChange={e => setComp(i, 'weight', e.target.value)}
                  placeholder="权重%"
                  style={{ ...inputStyle, flex: 1 }}
                />
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
                <ImeInput
                  value={t}
                  onChange={e => setTool(i, e.target.value)}
                  placeholder="工具名称"
                  style={{ ...inputStyle, flex: 1 }}
                />
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

        <button
          type="submit"
          disabled={create.isPending}
          style={{ padding: '0.5rem', borderRadius: 5, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: create.isPending ? 0.6 : 1 }}
        >
          {create.isPending ? '创建中…' : '创建岗位画像'}
        </button>
      </form>
    </div>
  );
}
