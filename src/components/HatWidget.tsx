'use client';

import { trpc } from '@/lib/trpc';
import type { HatType } from '@/db/schema/hat-logs';

const HAT_LABELS: Record<HatType, string> = {
  '🎩': '统筹',
  '🧠': '深度工作',
  '🛠': '执行',
  '📊': '复盘'
};

const HATS: HatType[] = ['🎩', '🧠', '🛠', '📊'];

interface HatWidgetProps {
  onBackfillClick: () => void;
}

export function HatWidget({ onBackfillClick }: HatWidgetProps) {
  const utils = trpc.useContext();
  const { data: current } = trpc.hatLog.current.useQuery();

  const switchHat = trpc.hatLog.switchHat.useMutation({
    onSuccess: () => utils.hatLog.current.invalidate()
  });

  const removeHat = trpc.hatLog.removeHat.useMutation({
    onSuccess: () => utils.hatLog.current.invalidate()
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayLogs = [] } = trpc.hatLog.forDate.useQuery({ date: today });

  const totals = todayLogs.reduce<Record<string, number>>((acc, log) => {
    if (log.endAt) {
      const mins = (new Date(log.endAt).getTime() - new Date(log.startAt).getTime()) / 60000;
      acc[log.hat] = (acc[log.hat] ?? 0) + mins;
    }
    return acc;
  }, {});

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: 420 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>当前帽子</span>
        <div style={{ fontSize: '2rem', marginTop: '0.25rem' }}>
          {current ? (
            <span title={HAT_LABELS[current.hat as HatType]}>
              {current.hat} <span style={{ fontSize: '0.875rem', color: '#555' }}>{HAT_LABELS[current.hat as HatType]}</span>
            </span>
          ) : (
            <span style={{ fontSize: '1rem', color: '#aaa' }}>未佩戴</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {HATS.map((hat) => (
          <button
            key={hat}
            onClick={() => switchHat.mutate({ hat })}
            disabled={switchHat.isLoading || current?.hat === hat}
            style={{
              fontSize: '1.25rem',
              padding: '0.35rem 0.6rem',
              borderRadius: 6,
              border: current?.hat === hat ? '2px solid #4a4af0' : '1px solid #ddd',
              background: current?.hat === hat ? '#eef' : '#fafafa',
              cursor: current?.hat === hat ? 'default' : 'pointer',
              opacity: switchHat.isLoading ? 0.6 : 1
            }}
            title={HAT_LABELS[hat]}
          >
            {hat}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => removeHat.mutate()}
          disabled={!current || removeHat.isLoading}
          style={{
            fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: 5,
            border: '1px solid #ddd', background: '#fff', cursor: 'pointer',
            opacity: !current || removeHat.isLoading ? 0.4 : 1
          }}
        >
          摘下帽子
        </button>
        <button
          onClick={onBackfillClick}
          style={{
            fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: 5,
            border: '1px solid #ddd', background: '#fff', cursor: 'pointer'
          }}
        >
          事后补记
        </button>
      </div>

      {Object.keys(totals).length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
          <span style={{ fontWeight: 600 }}>今日 </span>
          {HATS.filter(h => totals[h]).map(h => (
            <span key={h} style={{ marginRight: '0.5rem' }}>
              {h} {Math.round(totals[h]!)}min
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
