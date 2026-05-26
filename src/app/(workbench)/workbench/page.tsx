'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { HatWidget } from '@/components/HatWidget';
import { HatBackfillForm } from '@/components/HatBackfillForm';
import { ReceivablesPanel } from '@/components/ReceivablesPanel';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH = {
  lead: '准入', qualifying: '需求确认', discovery: '合同签约',
  contract: '项目执行', execution: '报告交付', reporting: '项目收尾',
  closing: '收尾中', done: '已完成'
} as const;

const STATE_COLOR = {
  lead:       { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' },
  qualifying: { bg: '#eff6ff', text: '#1d4ed8', bar: '#60a5fa' },
  discovery:  { bg: '#f0fdf4', text: '#15803d', bar: '#4ade80' },
  contract:   { bg: '#fffbeb', text: '#b45309', bar: '#fbbf24' },
  execution:  { bg: '#f5f3ff', text: '#6d28d9', bar: '#a78bfa' },
  reporting:  { bg: '#fff1f2', text: '#be123c', bar: '#fb7185' },
  closing:    { bg: '#fdf4ff', text: '#7e22ce', bar: '#c084fc' },
  done:       { bg: '#f0f0f0', text: '#666',    bar: '#d1d5db' },
} as const;

const FUNNEL_STAGES: ProjectState[] = ['lead', 'qualifying', 'discovery', 'contract', 'execution', 'reporting'];

function daysUntil(date: unknown): number {
  return Math.ceil((new Date(date as string).getTime() - Date.now()) / 86400000);
}

export default function DashboardPage() {
  const [showBackfill, setShowBackfill] = useState(false);
  const [period, setPeriod] = useState<'all' | 'month' | 'quarter'>('all');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: expiring = [] } = trpc.grants.listExpiringSoon.useQuery();

  const displayProjects = projects.filter(p => {
    if (period === 'all') return true;
    const cutoff = new Date();
    if (period === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else cutoff.setMonth(cutoff.getMonth() - 3);
    return new Date((p as Record<string, unknown>).updatedAt as string) >= cutoff;
  });

  // ── Pipeline counts ──────────────────────────────────────────────────────
  const stageCounts = Object.fromEntries(FUNNEL_STAGES.map(s => [s, 0] as [string, number])) as Record<string, number>;
  displayProjects.forEach(p => { if (p.state in stageCounts) stageCounts[p.state] = (stageCounts[p.state] ?? 0) + 1; });
  const maxCount = Math.max(1, ...Object.values(stageCounts));

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const wip = displayProjects.filter(p => p.state === 'contract' || p.state === 'execution').length;

  const totalRevenue = displayProjects.reduce((sum, p) => {
    const v = (p.stageMeta as Record<string, unknown>)?.contractAmount;
    return sum + (typeof v === 'number' ? v : 0);
  }, 0);

  const npsValues = displayProjects
    .map(p => (p.stageMeta as Record<string, unknown>)?.npsScore)
    .filter((v): v is number => typeof v === 'number');
  const avgNps = npsValues.length > 0
    ? Math.round(npsValues.reduce((a, b) => a + b, 0) / npsValues.length)
    : null;

  const receivablesAmount = displayProjects.reduce((sum, p) => {
    const meta = p.stageMeta as Record<string, unknown>;
    const status = meta?.finalPaymentStatus as string | undefined;
    if (!status?.startsWith('pending') && !status?.startsWith('partial')) return sum;
    const contract = typeof meta?.contractAmount === 'number' ? meta.contractAmount : 0;
    const actual = typeof meta?.actualRevenue === 'number' ? meta.actualRevenue : 0;
    return sum + Math.max(0, contract - actual);
  }, 0);
  const pendingReceivables = displayProjects.filter(p => {
    const s = (p.stageMeta as Record<string, unknown>)?.finalPaymentStatus as string | undefined;
    return s?.startsWith('pending') || s?.startsWith('partial');
  }).length;

  const activeProjects = displayProjects.filter(p => p.state !== 'done' && p.state !== 'closing').length;

  // ── Expiring grant alerts ─────────────────────────────────────────────────
  const urgentGrants = expiring.filter(g => daysUntil(g.expiresAt) <= 7);
  const warnGrants = expiring.filter(g => daysUntil(g.expiresAt) > 7);

  return (
    <div>
      {/* ── Expiring grant alerts ─────────────────────────────────────── */}
      {expiring.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {urgentGrants.map(g => (
            <div key={g.id} style={{
              background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 7,
              padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#b91c1c',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <span style={{ fontWeight: 700 }}>⚠ 紧急</span>
              <span>协作者 <strong>{g.user.name ?? g.user.email}</strong> 在项目「{g.project.title}」的授权将于 <strong>{daysUntil(g.expiresAt)} 天</strong>后到期</span>
              <a href={`/workbench/projects/${g.projectId}`} style={{ marginLeft: 'auto', color: '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap' }}>前往续期 →</a>
            </div>
          ))}
          {warnGrants.map(g => (
            <div key={g.id} style={{
              background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7,
              padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#92400e',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <span style={{ fontWeight: 700 }}>提醒</span>
              <span>协作者 <strong>{g.user.name ?? g.user.email}</strong> 在项目「{g.project.title}」的授权将于 <strong>{daysUntil(g.expiresAt)} 天</strong>后到期</span>
              <a href={`/workbench/projects/${g.projectId}`} style={{ marginLeft: 'auto', color: '#92400e', fontWeight: 600, whiteSpace: 'nowrap' }}>前往续期 →</a>
            </div>
          ))}
        </div>
      )}

      {/* ── Receivables ──────────────────────────────────────────────── */}
      <ReceivablesPanel />

      {/* ── Pipeline funnel ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>工作台</h1>
          <span style={{ fontSize: '0.75rem', color: '#999' }}>项目漏斗</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
            {(['all', 'month', 'quarter'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '0.2rem 0.6rem', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 600,
                background: period === p ? '#4a4af0' : '#ececf8',
                color: period === p ? '#fff' : '#555'
              }}>
                {p === 'all' ? '全部' : p === 'month' ? '近1月' : '近3月'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: '0.5rem' }}>
          {FUNNEL_STAGES.map(s => {
            const count = stageCounts[s] ?? 0;
            const color = STATE_COLOR[s as keyof typeof STATE_COLOR];
            const barH = Math.round((count / maxCount) * 40) + 8;
            return (
              <div key={s} style={{
                background: '#fff', borderRadius: 8, padding: '0.65rem 0.75rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'column', gap: '0.35rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {STATE_ZH[s]}
                </div>
                <div style={{
                  background: color.bar, borderRadius: 3,
                  height: barH, minHeight: 8,
                  opacity: count === 0 ? 0.25 : 1
                }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: count === 0 ? '#ccc' : color.text }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: '活跃项目', value: activeProjects, sub: wip > 0 ? `${wip} 个执行中` : '无执行中', warn: wip >= 3 },
          { label: '签约总金额', value: totalRevenue > 0 ? `¥${(totalRevenue / 10000).toFixed(1)}万` : '—', sub: '已填写合同额', warn: false },
          { label: '平均 NPS', value: avgNps !== null ? avgNps : '—', sub: npsValues.length > 0 ? `${npsValues.length} 个已评分` : '暂无数据', warn: avgNps !== null && avgNps < 0 },
          {
            label: '待收款',
            value: receivablesAmount > 0 ? `¥${(receivablesAmount / 10000).toFixed(1)}万` : pendingReceivables > 0 ? `${pendingReceivables} 项` : '—',
            sub: pendingReceivables > 0 ? `${pendingReceivables} 个项目待收` : '全部到账',
            warn: pendingReceivables > 0
          },
        ].map(({ label, value, sub, warn }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 8, padding: '0.85rem 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderLeft: `3px solid ${warn ? '#fca5a5' : '#e2e8f0'}`
          }}>
            <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: warn ? '#dc2626' : '#1e293b', margin: '0.2rem 0 0.1rem' }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: warn ? '#ef4444' : '#94a3b8' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main two-col ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <HatWidget onBackfillClick={() => setShowBackfill(s => !s)} />
          {showBackfill && <HatBackfillForm onClose={() => setShowBackfill(false)} />}
        </div>

        <div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>进行中的项目</h2>
          {projects.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.875rem' }}>暂无项目。<a href="/workbench/projects/new">新建项目</a></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {projects.filter(p => p.state !== 'done').slice(0, 10).map(p => {
                const color = STATE_COLOR[p.state as keyof typeof STATE_COLOR];
                return (
                  <a key={p.id} href={`/workbench/projects/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: '#fff', borderRadius: 6, padding: '0.55rem 0.85rem',
                    textDecoration: 'none', color: 'inherit',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <span style={{
                      fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: 20,
                      background: color?.bg ?? '#eee', color: color?.text ?? '#555',
                      fontWeight: 600, whiteSpace: 'nowrap'
                    }}>
                      {STATE_ZH[p.state as keyof typeof STATE_ZH] ?? p.state}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(p as Record<string, unknown>).title as string ?? p.id}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                      {new Date((p as Record<string, unknown>).updatedAt as string).toLocaleDateString('zh-CN')}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
