'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';
import { ImeInput } from '@/components/ime';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

const STATE_COLOR: Record<ProjectState, string> = {
  lead: '#9ca3af', qualifying: '#f59e0b', discovery: '#3b82f6',
  contract: '#8b5cf6', execution: '#10b981', reporting: '#06b6d4',
  closing: '#f97316', done: '#6b7280'
};

const ALL_STATES = Object.keys(STATE_ZH) as ProjectState[];

type Tab = 'all' | ProjectState;

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = projects.filter((p) => {
    const matchTab = activeTab === 'all' || p.state === activeTab;
    const matchSearch = search.trim() === '' ||
      ((p as Record<string, unknown>).title as string ?? '').toLowerCase().includes(search.trim().toLowerCase());
    return matchTab && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function countFor(state: Tab) {
    if (state === 'all') return projects.length;
    return projects.filter((p) => p.state === state).length;
  }

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '0.35rem 0.75rem',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    background: activeTab === tab ? '#4a4af0' : '#f0f0f8',
    color: activeTab === tab ? '#fff' : '#555',
    whiteSpace: 'nowrap'
  });

  function exportCsv() {
    const rows = [['项目名', '状态', '更新时间']];
    filtered.forEach(p => {
      rows.push([
        (p as Record<string, unknown>).title as string ?? p.id,
        STATE_ZH[p.state] ?? p.state,
        new Date((p as Record<string, unknown>).updatedAt as string).toLocaleDateString('zh-CN')
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `projects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>项目列表</h1>
        <a href="/workbench/projects/new" style={{
          padding: '0.4rem 0.85rem', borderRadius: 5, background: '#4a4af0',
          color: '#fff', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600
        }}>
          + 新建
        </a>
        <button onClick={exportCsv} style={{
          padding: '0.4rem 0.85rem', borderRadius: 5, border: '1px solid #ddd',
          background: '#fff', color: '#555', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
        }}>
          导出 CSV
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '0.75rem' }}>
        <ImeInput
          type="text"
          placeholder="搜索项目名…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            width: '100%', maxWidth: 320, padding: '0.4rem 0.75rem',
            border: '1px solid #ddd', borderRadius: 6, fontSize: '0.875rem',
            outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button style={tabStyle('all')} onClick={() => { setActiveTab('all'); setPage(1); }}>
          全部 <span style={{ opacity: 0.75 }}>{countFor('all')}</span>
        </button>
        {ALL_STATES.filter((s) => countFor(s) > 0).map((s) => (
          <button key={s} style={tabStyle(s)} onClick={() => { setActiveTab(s); setPage(1); }}>
            {STATE_ZH[s]} <span style={{ opacity: 0.75 }}>{countFor(s)}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          {search ? '没有匹配的项目。' : '暂无项目。'}
        </p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8f8fc', borderBottom: '1px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>项目名</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555' }}>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < paged.length - 1 ? '1px solid #f0f0f8' : 'none' }}>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <a href={`/workbench/projects/${p.id}`} style={{ color: '#4a4af0', textDecoration: 'none', fontWeight: 500 }}>
                      {(p as Record<string, unknown>).title as string ?? p.id}
                    </a>
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: 20,
                      background: STATE_COLOR[p.state] + '22', color: STATE_COLOR[p.state], fontWeight: 600
                    }}>
                      {STATE_ZH[p.state] ?? p.state}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: '#888' }}>
                    {new Date((p as Record<string, unknown>).updatedAt as string).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === 1 ? '#ccc' : '#4a4af0', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>上一页</button>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>第 {page} 页 / 共 {totalPages} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
            style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === totalPages ? '#ccc' : '#4a4af0', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>下一页</button>
        </div>
      )}
    </div>
  );
}
