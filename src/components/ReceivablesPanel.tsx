'use client';

import { trpc } from '@/lib/trpc';

function daysFromToday(dateStr: string): number {
  return Math.ceil((new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

export function ReceivablesPanel() {
  const { data: items = [] } = trpc.projects.listReceivables.useQuery();
  if (items.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem 0.5rem', borderBottom: '1px solid #f0f0f8' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          应收账款跟进
        </span>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#aaa' }}>{items.length} 项待收</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((p, i) => {
          const meta = (p.stageMeta ?? {}) as Record<string, unknown>;
          const contract = typeof meta.contractAmount === 'number' ? meta.contractAmount : 0;
          const actual = typeof meta.actualRevenue === 'number' ? meta.actualRevenue : 0;
          const outstanding = Math.max(0, contract - actual);
          const dueStr = typeof meta.paymentDueDate === 'string' ? meta.paymentDueDate : null;
          const days = dueStr ? daysFromToday(dueStr) : null;

          let dueBg = 'transparent', dueColor = '#888', dueLabel = '未设到期日';
          if (days !== null) {
            if (days < 0) {
              dueBg = '#fff5f5'; dueColor = '#dc2626'; dueLabel = `逾期 ${Math.abs(days)} 天`;
            } else if (days <= 7) {
              dueBg = '#fffbeb'; dueColor = '#b45309'; dueLabel = days === 0 ? '今日到期' : `${days} 天后到期`;
            } else {
              dueColor = '#6b7280'; dueLabel = `${days} 天后到期`;
            }
          }

          return (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem 1rem',
                borderBottom: i < items.length - 1 ? '1px solid #f5f5fa' : 'none',
                background: dueBg,
              }}
            >
              <a
                href={`/workbench/projects/${p.id}`}
                style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {p.title}
              </a>
              <span style={{ fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap' }}>
                {outstanding > 0 ? `¥${(outstanding / 10000).toFixed(1)}万` : '—'}
              </span>
              <span style={{ fontSize: '0.75rem', color: dueColor, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
                {dueStr ? `${dueStr} · ${dueLabel}` : dueLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
