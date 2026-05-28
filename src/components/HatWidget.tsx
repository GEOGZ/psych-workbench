'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { HatType } from '@/db/schema/hat-logs';

const HAT_LABELS: Record<HatType, string> = {
  '🎩': '统筹',
  '🧠': '深度工作',
  '🛠': '执行',
  '📊': '复盘',
};

const HAT_COLORS: Record<HatType, string> = {
  '🎩': '#4a4af0',
  '🧠': '#2563eb',
  '🛠': '#d97706',
  '📊': '#16a34a',
};

const HAT_DETAILS: Record<HatType, { desc: string; items: string[] }> = {
  '🎩': {
    desc: '全局视角，协调多条线',
    items: ['客户沟通 / 销售跟进', '多项目状态检查', '方案确认、做决策', '协调顾问分工'],
  },
  '🧠': {
    desc: '专注单一任务，不被打扰',
    items: ['设计测评方案', '撰写 / 审核报告', '需求分析、材料研读', '复杂问题深度思考'],
  },
  '🛠': {
    desc: '操作性强，步骤清晰',
    items: ['系统配置 / 发送邀请', '数据整理 / 行政事务', '按清单逐项推进', '邮件 / 常规沟通跟进'],
  },
  '📊': {
    desc: '分析性思维，回顾总结',
    items: ['查看项目报表', 'NPS 数据分析', '月度 / 季度回顾', '项目收尾内部总结'],
  },
};

const HATS: HatType[] = ['🎩', '🧠', '🛠', '📊'];

interface HatWidgetProps {
  onBackfillClick: () => void;
}

export function HatWidget({ onBackfillClick }: HatWidgetProps) {
  const utils = trpc.useContext();
  const { data: current } = trpc.hatLog.current.useQuery();
  const [hoveredHat, setHoveredHat] = useState<HatType | null>(null);

  const switchHat = trpc.hatLog.switchHat.useMutation({
    onSuccess: () => utils.hatLog.current.invalidate(),
  });

  const removeHat = trpc.hatLog.removeHat.useMutation({
    onSuccess: () => utils.hatLog.current.invalidate(),
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

  const accentColor = hoveredHat ? HAT_COLORS[hoveredHat] : '#4a4af0';

  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: 420,
    }}>
      {/* Current hat display */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          当前帽子
        </span>
        <div style={{ fontSize: '2rem', marginTop: '0.25rem', minHeight: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {current ? (
            <>
              <span>{current.hat}</span>
              <span style={{ fontSize: '0.875rem', color: '#555', fontWeight: 600 }}>
                {HAT_LABELS[current.hat as HatType]}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '1rem', color: '#aaa' }}>未佩戴</span>
          )}
        </div>
      </div>

      {/* Hat buttons + floating tooltip */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {HATS.map((hat) => {
            const isActive = current?.hat === hat;
            const color = HAT_COLORS[hat];
            return (
              <button
                key={hat}
                onClick={() => !isActive && switchHat.mutate({ hat })}
                onMouseEnter={() => setHoveredHat(hat)}
                onMouseLeave={() => setHoveredHat(null)}
                disabled={switchHat.isPending}
                style={{
                  fontSize: '1.25rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 6,
                  border: isActive ? `2px solid ${color}` : '1px solid #e0e0e0',
                  background: isActive ? `${color}18` : '#fafafa',
                  cursor: isActive ? 'default' : 'pointer',
                  opacity: switchHat.isPending ? 0.6 : 1,
                  transition: 'border-color 0.15s, background 0.15s, transform 0.1s, box-shadow 0.15s',
                  transform: hoveredHat === hat && !isActive ? 'translateY(-1px)' : 'none',
                  boxShadow: hoveredHat === hat ? `0 2px 8px ${color}30` : 'none',
                }}
              >
                {hat}
              </button>
            );
          })}
        </div>

        {/* Floating tooltip */}
        {hoveredHat && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              border: `1px solid ${accentColor}28`,
              padding: '0.9rem 1rem',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute',
              top: -5,
              left: 22,
              width: 9,
              height: 9,
              background: '#fff',
              borderTop: `1px solid ${accentColor}28`,
              borderLeft: `1px solid ${accentColor}28`,
              transform: 'rotate(45deg)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{hoveredHat}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: accentColor }}>
                {HAT_LABELS[hoveredHat]}
              </span>
            </div>
            <p style={{ margin: '0 0 0.55rem', fontSize: '0.73rem', color: '#999', lineHeight: 1.4 }}>
              {HAT_DETAILS[hoveredHat].desc}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
              {HAT_DETAILS[hoveredHat].items.map(item => (
                <li key={item} style={{ fontSize: '0.78rem', color: '#444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: accentColor, fontSize: '0.55rem', flexShrink: 0 }}>✦</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => removeHat.mutate()}
          disabled={!current || removeHat.isPending}
          style={{
            fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: 5,
            border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer',
            opacity: !current || removeHat.isPending ? 0.4 : 1,
          }}
        >
          摘下帽子
        </button>
        <button
          onClick={onBackfillClick}
          style={{
            fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: 5,
            border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer',
          }}
        >
          事后补记
        </button>
      </div>

      {/* Today totals */}
      {Object.keys(totals).length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#666', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#888' }}>今日</span>
          {HATS.filter(h => totals[h]).map(h => (
            <span key={h}>
              {h} <span style={{ color: HAT_COLORS[h], fontWeight: 600 }}>{Math.round(totals[h]!)}min</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
