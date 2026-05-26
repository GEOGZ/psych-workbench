'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface Props {
  projectId: string;
}

export function MonthlyRetrospectivePanel({ projectId }: Props) {
  const [month, setMonth] = useState(currentYearMonth);
  const [content, setContent] = useState('');
  const [err, setErr] = useState('');

  const { data: entries = [], refetch } = trpc.projects.listMonthlyRetrospectives.useQuery({ projectId });
  const add = trpc.projects.addMonthlyRetrospective.useMutation({
    onSuccess: () => { refetch(); setContent(''); setErr(''); },
    onError: (e) => setErr(e.message),
  });

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1rem' }}>
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        月度复盘日志
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: entries.length > 0 ? '1.25rem' : 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: 5, padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
          />
          <span style={{ fontSize: '0.8rem', color: '#888' }}>月度复盘</span>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="本月项目进展、关键决策、风险与改进点…"
          rows={4}
          style={{ border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', width: '100%' }}
        />
        {err && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00' }}>{err}</p>}
        <div>
          <button
            onClick={() => content.trim() && add.mutate({ projectId, month, content: content.trim() })}
            disabled={!content.trim() || add.isPending}
            style={{
              padding: '0.35rem 0.9rem', borderRadius: 5, background: '#4a4af0', color: '#fff',
              border: 'none', cursor: content.trim() ? 'pointer' : 'not-allowed',
              opacity: content.trim() ? 1 : 0.45, fontSize: '0.875rem', fontWeight: 600
            }}
          >
            {add.isPending ? '保存中…' : '记录复盘'}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(ev => {
            const p = ev.payload as Record<string, unknown>;
            return (
              <div key={ev.id} style={{ borderLeft: '3px solid #e0e7ff', paddingLeft: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4a4af0' }}>{String(p.month ?? '')}</span>
                  <span style={{ fontSize: '0.7rem', color: '#bbb' }}>{new Date(ev.at).toLocaleDateString('zh-CN')}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {String(p.content ?? '')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
