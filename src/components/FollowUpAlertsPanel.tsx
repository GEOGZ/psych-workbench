'use client';

import { trpc } from '@/lib/trpc';

export function FollowUpAlertsPanel() {
  const { data: alerts = [] } = trpc.projects.listFollowUpAlerts.useQuery();
  if (alerts.length === 0) return null;

  const cooling = alerts.filter(a => a.type === 'cooling');
  const stale = alerts.filter(a => a.type === 'stale');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
      {cooling.map(a => (
        <div key={`${a.projectId}-cooling`} style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7,
          padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#92400e',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span style={{ fontWeight: 700 }}>⏳ 冷静期</span>
          <span>「{a.title}」— {a.detail}</span>
          <a href={`/workbench/projects/${a.projectId}`} style={{ marginLeft: 'auto', color: '#92400e', fontWeight: 600, whiteSpace: 'nowrap' }}>查看 →</a>
        </div>
      ))}
      {stale.map(a => (
        <div key={`${a.projectId}-stale`} style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7,
          padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#64748b',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span style={{ fontWeight: 700 }}>💤 停滞</span>
          <span>「{a.title}」— {a.detail}</span>
          <a href={`/workbench/projects/${a.projectId}`} style={{ marginLeft: 'auto', color: '#4a4af0', fontWeight: 600, whiteSpace: 'nowrap' }}>跟进 →</a>
        </div>
      ))}
    </div>
  );
}
