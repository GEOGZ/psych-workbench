'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { transitions, prevTransitions } from '@/server/state/transitions';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

interface AdvanceProjectButtonProps {
  projectId: string;
  currentState: ProjectState;
  onAdvanced: () => void;
}

export function AdvanceProjectButton({ projectId, currentState, onAdvanced }: AdvanceProjectButtonProps) {
  const [toast, setToast] = useState('');
  const utils = trpc.useContext();

  const advance = trpc.projects.advance.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ projectId });
      onAdvanced();
    },
    onError: (err) => {
      setToast(err.message.replace(/execution|reporting|done|lead/g, (m) => STATE_ZH[m as ProjectState] ?? m));
      setTimeout(() => setToast(''), 4000);
    }
  });

  const nextStates = transitions[currentState];
  const prevStates = prevTransitions[currentState];

  if (nextStates.length === 0 && prevStates.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {nextStates.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {nextStates.map(target => (
            <button
              key={target}
              onClick={() => advance.mutate({ projectId, toState: target })}
              disabled={advance.isPending}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: 5, border: '1px solid #4a4af0',
                background: '#fff', color: '#4a4af0', cursor: 'pointer', fontSize: '0.875rem',
                fontWeight: 600, opacity: advance.isPending ? 0.6 : 1
              }}
            >
              推进至 {STATE_ZH[target]}
            </button>
          ))}
        </div>
      )}
      {prevStates.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {prevStates.map(target => (
            <button
              key={target}
              onClick={() => advance.mutate({ projectId, toState: target, revert: true })}
              disabled={advance.isPending}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #d1d5db',
                background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem',
                fontWeight: 500, opacity: advance.isPending ? 0.6 : 1
              }}
            >
              ← 回退至 {STATE_ZH[target]}
            </button>
          ))}
        </div>
      )}
      {toast && (
        <div style={{ fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.35rem 0.6rem', borderRadius: 4 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
