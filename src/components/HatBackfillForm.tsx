'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { HatType } from '@/db/schema/hat-logs';

const HATS: HatType[] = ['🎩', '🧠', '🛠', '📊'];

interface HatBackfillFormProps {
  onClose: () => void;
}

export function HatBackfillForm({ onClose }: HatBackfillFormProps) {
  const [hat, setHat] = useState<HatType>('🎩');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState('');
  const utils = trpc.useContext();

  const backfill = trpc.hatLog.backfill.useMutation({
    onSuccess: () => {
      utils.hatLog.forDate.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!startAt || !endAt) return;
    backfill.mutate({ hat, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() });
  };

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 4, padding: '0.3rem 0.5rem',
    fontSize: '0.875rem', width: '100%'
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>事后补记</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', color: '#888' }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>帽子</label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {HATS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHat(h)}
                style={{
                  fontSize: '1.25rem', padding: '0.25rem 0.4rem', borderRadius: 5,
                  border: hat === h ? '2px solid #4a4af0' : '1px solid #ddd',
                  background: hat === h ? '#eef' : '#fafafa', cursor: 'pointer'
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>开始时间</label>
          <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} required style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>结束时间</label>
          <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} required style={inputStyle} />
        </div>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
            {error.includes('overlap') || error.includes('conflict') ? '时间段冲突，请检查已有记录' : error}
          </div>
        )}

        <button
          type="submit"
          disabled={backfill.isLoading}
          style={{
            padding: '0.45rem', borderRadius: 5, border: 'none',
            background: '#4a4af0', color: '#fff', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: 600,
            opacity: backfill.isLoading ? 0.6 : 1
          }}
        >
          {backfill.isLoading ? '保存中…' : '保存'}
        </button>
      </form>
    </div>
  );
}
