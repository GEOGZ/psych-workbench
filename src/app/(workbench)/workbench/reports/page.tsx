'use client';
import { trpc } from '@/lib/trpc';

type Meta = Record<string, unknown>;

const STATE_ZH: Record<string, string> = {
  lead: '准入', qualifying: '需求确认', discovery: '合同签约',
  contract: '项目执行', execution: '报告交付', reporting: '项目收尾',
  closing: '收尾中', done: '已完成',
};

function fmtMoney(v: number) {
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`;
  return `¥${v.toLocaleString('zh-CN')}`;
}

function monthLabel(iso: string) {
  return iso.slice(0, 7);
}

export default function ReportsPage() {
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  // ── Derive fields ──────────────────────────────────────────────────────────
  const rows = projects.map(p => {
    const meta = (p.stageMeta ?? {}) as Meta;
    return {
      id: p.id,
      title: (p as Meta).title as string,
      state: p.state,
      month: monthLabel((p as Meta).createdAt as string),
      contractAmount: typeof meta.contractAmount === 'number' ? meta.contractAmount : 0,
      actualRevenue: typeof meta.actualRevenue === 'number' ? meta.actualRevenue : 0,
      npsScore: typeof meta.npsScore === 'number' ? (meta.npsScore as number) : null,
      finalPaymentStatus: typeof meta.finalPaymentStatus === 'string' ? meta.finalPaymentStatus : null,
    };
  });

  // ── Monthly revenue ────────────────────────────────────────────────────────
  const monthlyMap = new Map<string, { contract: number; actual: number; count: number }>();
  for (const r of rows) {
    const entry = monthlyMap.get(r.month) ?? { contract: 0, actual: 0, count: 0 };
    entry.contract += r.contractAmount;
    entry.actual += r.actualRevenue;
    entry.count += 1;
    monthlyMap.set(r.month, entry);
  }
  const months = [...monthlyMap.keys()].sort().slice(-12);
  const maxMonthly = Math.max(1, ...months.map(m => monthlyMap.get(m)!.contract));

  // ── By-state revenue ───────────────────────────────────────────────────────
  const stateMap = new Map<string, { contract: number; count: number }>();
  for (const r of rows) {
    const entry = stateMap.get(r.state) ?? { contract: 0, count: 0 };
    entry.contract += r.contractAmount;
    entry.count += 1;
    stateMap.set(r.state, entry);
  }

  // ── NPS buckets ────────────────────────────────────────────────────────────
  const npsRows = rows.filter(r => r.npsScore !== null);
  const promoters = npsRows.filter(r => r.npsScore! >= 9).length;
  const passives  = npsRows.filter(r => r.npsScore! >= 7 && r.npsScore! <= 8).length;
  const detractors = npsRows.filter(r => r.npsScore! <= 6).length;
  const npsScore = npsRows.length > 0
    ? Math.round(((promoters - detractors) / npsRows.length) * 100)
    : null;

  // ── Receivables list ───────────────────────────────────────────────────────
  const receivables = rows.filter(r =>
    r.finalPaymentStatus?.startsWith('pending') || r.finalPaymentStatus?.startsWith('partial')
  );

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalContract = rows.reduce((s, r) => s + r.contractAmount, 0);
  const totalActual   = rows.reduce((s, r) => s + r.actualRevenue, 0);
  const totalReceivables = receivables.reduce((s, r) => s + Math.max(0, r.contractAmount - r.actualRevenue), 0);

  const sectionTitle: React.CSSProperties = { margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' };

  return (
    <div style={{ maxWidth: 960, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e' }}>收入统计报表</h1>

      {/* ── Summary KPIs ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: '签约总金额', value: totalContract > 0 ? fmtMoney(totalContract) : '—' },
          { label: '已收款', value: totalActual > 0 ? fmtMoney(totalActual) : '—' },
          { label: '待收款', value: totalReceivables > 0 ? fmtMoney(totalReceivables) : '—', warn: totalReceivables > 0 },
          { label: 'NPS 净推荐值', value: npsScore !== null ? String(npsScore) : '—', sub: npsRows.length > 0 ? `${npsRows.length} 个已评分` : '暂无数据', warn: npsScore !== null && npsScore < 0 },
        ].map(({ label, value, sub, warn }) => (
          <div key={label} style={{ ...card, borderLeft: `3px solid ${warn ? '#fca5a5' : '#e2e8f0'}` }}>
            <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: warn ? '#dc2626' : '#1e293b', margin: '0.2rem 0 0.1rem' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Monthly revenue chart ──────────────────────────────────────── */}
      {months.length > 0 && (
        <div style={card}>
          <p style={sectionTitle}>按月签约金额（近12个月）</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: 120 }}>
            {months.map(m => {
              const d = monthlyMap.get(m)!;
              const barH = Math.max(4, Math.round((d.contract / maxMonthly) * 84));
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  {d.contract > 0 && (
                    <span style={{ fontSize: '0.58rem', color: '#4a4af0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmtMoney(d.contract)}
                    </span>
                  )}
                  <div style={{ width: '100%', background: d.contract > 0 ? '#4a4af0' : '#e2e8f0', borderRadius: '3px 3px 0 0', height: barH }} title={`${m}: ${fmtMoney(d.contract)}`} />
                  <span style={{ fontSize: '0.58rem', color: '#aaa', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 32 }}>{m}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── By state ──────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>按阶段收入分布</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f8' }}>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>阶段</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>项目数</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>签约金额</th>
            </tr>
          </thead>
          <tbody>
            {[...stateMap.entries()].sort((a, b) => b[1].contract - a[1].contract).map(([state, d]) => (
              <tr key={state} style={{ borderBottom: '1px solid #f9f9fb' }}>
                <td style={{ padding: '0.45rem 0.5rem' }}>{STATE_ZH[state] ?? state}</td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#666' }}>{d.count}</td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: d.contract > 0 ? 600 : 400, color: d.contract > 0 ? '#1e293b' : '#ccc' }}>
                  {d.contract > 0 ? fmtMoney(d.contract) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── NPS breakdown ─────────────────────────────────────────────── */}
      {npsRows.length > 0 && (
        <div style={card}>
          <p style={sectionTitle}>NPS 分布（{npsRows.length} 个已评分）</p>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: '推荐者 (9-10)', count: promoters, color: '#22c55e' },
              { label: '中立者 (7-8)', count: passives,  color: '#f59e0b' },
              { label: '批评者 (0-6)', count: detractors, color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '0.85rem', color: '#555' }}>{label}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{count}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#888' }}>净推荐值</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: npsScore! >= 0 ? '#22c55e' : '#ef4444' }}>{npsScore}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Receivables detail ────────────────────────────────────────── */}
      {receivables.length > 0 && (
        <div style={card}>
          <p style={sectionTitle}>待收款明细 ({receivables.length} 个项目)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f8' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>项目</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>合同额</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>已收</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: '#888', fontWeight: 600, fontSize: '0.75rem' }}>待收</th>
              </tr>
            </thead>
            <tbody>
              {receivables.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f9f9fb' }}>
                  <td style={{ padding: '0.45rem 0.5rem' }}>
                    <a href={`/workbench/projects/${r.id}`} style={{ color: '#4a4af0', textDecoration: 'none', fontWeight: 500 }}>{r.title}</a>
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#666' }}>{r.contractAmount > 0 ? fmtMoney(r.contractAmount) : '—'}</td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#666' }}>{r.actualRevenue > 0 ? fmtMoney(r.actualRevenue) : '—'}</td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                    {fmtMoney(Math.max(0, r.contractAmount - r.actualRevenue))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
