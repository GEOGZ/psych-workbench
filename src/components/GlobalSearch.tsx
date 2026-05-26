'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

const STATE_ZH: Record<string, string> = {
  lead: '准入', qualifying: '需求确认', discovery: '合同签约',
  contract: '项目执行', execution: '报告交付', reporting: '项目收尾',
  closing: '收尾中', done: '已完成'
};

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q.trim(), 300);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = trpc.projects.search.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 1, keepPreviousData: true }
  );

  const hasResults = data && (data.projects.length > 0 || data.clients.length > 0);

  useEffect(() => {
    if (debounced.length >= 1) setOpen(true);
    else setOpen(false);
  }, [debounced]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function navigate(url: string) {
    setQ('');
    setOpen(false);
    window.location.href = url;
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        placeholder="搜索项目、客户…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '0.3rem 0.65rem', borderRadius: 6,
          border: '1px solid #3a3a5e', background: '#2a2a48',
          color: '#e8e8f0', fontSize: '0.8rem', outline: 'none',
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 1000, overflow: 'hidden', minWidth: 260
        }}>
          {isFetching && !hasResults && (
            <div style={{ padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#888' }}>搜索中…</div>
          )}
          {!isFetching && !hasResults && debounced.length >= 1 && (
            <div style={{ padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#888' }}>无匹配结果</div>
          )}
          {data?.projects && data.projects.length > 0 && (
            <>
              <div style={{ padding: '0.4rem 0.85rem 0.2rem', fontSize: '0.68rem', color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>项目</div>
              {data.projects.map(p => (
                <button key={p.id} onClick={() => navigate(`/workbench/projects/${p.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.5rem 0.85rem',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.85rem', color: '#1e293b'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5fa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {STATE_ZH[p.state] ?? p.state}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                </button>
              ))}
            </>
          )}
          {data?.clients && data.clients.length > 0 && (
            <>
              <div style={{ padding: '0.4rem 0.85rem 0.2rem', fontSize: '0.68rem', color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: data.projects.length > 0 ? '1px solid #f0f0f8' : 'none' }}>客户</div>
              {data.clients.map(c => (
                <button key={c.id} onClick={() => navigate(`/workbench/clients/${c.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.5rem 0.85rem',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.85rem', color: '#1e293b'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5fa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 20, background: '#f0fdf4', color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>客户</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.contactName && <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>{c.contactName}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
