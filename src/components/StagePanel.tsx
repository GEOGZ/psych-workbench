'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';
import { CHECKLISTS } from '@/lib/checklist-defs';

// ─── Stage metadata field definitions ────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  wide?: boolean;
};

const STAGE_FIELDS: Record<ProjectState, FieldDef[]> = {
  lead: [
    { key: 'clientTier', label: '客户等级', type: 'select', options: ['A - 明确需求+预算+决策链', 'B - 需求明确但预算不确定', 'C - 潜在需求长期培育', 'D - 不匹配'] },
    { key: 'sourceChannel', label: '客户来源渠道', type: 'text' },
    { key: 'headcountEstimate', label: '预估测评人数', type: 'number' },
    { key: 'decisionMaker', label: '决策人姓名/职位', type: 'text' },
    { key: 'goDecision', label: '准入决策', type: 'select', options: ['go - 全部维度通过', 'conditional - 需风险缓解', 'no-go - 暂不推进'] },
    { key: 'feasibilityNotes', label: '可行性评估备注', type: 'text', wide: true },
  ],
  qualifying: [
    { key: 'assessmentObjective', label: '测评目标', type: 'text' },
    { key: 'targetPopulation', label: '目标人群', type: 'text' },
    { key: 'budget', label: '预算范围', type: 'text' },
    { key: 'timeline', label: '期望交付时间', type: 'text' },
    { key: 'assessmentTools', label: '测评工具清单', type: 'text', wide: true },
    { key: 'techRequirements', label: '技术集成需求', type: 'text', wide: true },
  ],
  discovery: [
    { key: 'contractNumber', label: '合同编号', type: 'text' },
    { key: 'contractAmount', label: '合同金额（元）', type: 'number' },
    { key: 'paymentTerms', label: '付款条款', type: 'text' },
    { key: 'depositAmount', label: '预付款金额（元）', type: 'number' },
    { key: 'discountRate', label: '折扣率（%，100 = 不打折）', type: 'number' },
    { key: 'signedDate', label: '合同签署日期', type: 'text' },
    { key: '_lawyerReviewConfirmed', label: '律师审核（合同 > 20 万时必填）', type: 'select', options: ['no - 未审核', 'yes - 已审核'], wide: true },
  ],
  contract: [
    { key: 'participantCount', label: '实际参与人数', type: 'number' },
    { key: 'assessmentStartDate', label: '测评开始日期', type: 'text' },
    { key: 'completionRate', label: '问卷完成率（%）', type: 'number' },
    { key: 'dataQualityStatus', label: '数据质量状态', type: 'select', options: ['pending - 待检查', 'pass - 通过', 'fail - 不通过'] },
    { key: 'milestonesNote', label: '里程碑进展备注', type: 'text', wide: true },
  ],
  execution: [
    { key: 'individualReportCount', label: '个人报告数量', type: 'number' },
    { key: 'groupReportDone', label: '群体报告状态', type: 'select', options: ['pending - 待完成', 'done - 已完成'] },
    { key: 'deliveryMethod', label: '交付方式', type: 'select', options: ['平台在线', '邮件（加密）', '线下演示', '混合'] },
    { key: 'deliveryDate', label: '交付日期', type: 'text' },
    { key: 'feedbackSummary', label: '初步客户反馈', type: 'text', wide: true },
  ],
  reporting: [
    { key: 'invoiceNumber', label: '发票编号', type: 'text' },
    { key: 'paymentDueDate', label: '约定付款到期日（YYYY-MM-DD）', type: 'text' },
    { key: 'actualRevenue', label: '实际到账金额（元）', type: 'number' },
    { key: 'finalPaymentStatus', label: '尾款状态', type: 'select', options: ['pending - 待收款', 'partial - 部分到账', 'paid - 已全额到账'] },
    { key: 'npsScore', label: 'NPS 净推荐值（-100~100）', type: 'number' },
    { key: 'renewalStatus', label: '续约意向', type: 'select', options: ['pending - 待确认', 'yes - 有续约意向', 'no - 无续约意向'] },
  ],
  closing: [
    { key: 'closingNotes', label: '结案备注', type: 'text', wide: true },
  ],
  done: [],
};

const STAGE_TITLES: Record<ProjectState, string> = {
  lead: '阶段 0 · 客户准入与商机评估',
  qualifying: '阶段 1 · 需求确认与方案设计',
  discovery: '阶段 2 · 合同与合规签约',
  contract: '阶段 3 · 项目执行与交付监控',
  execution: '阶段 4 · 报告出具与洞察交付',
  reporting: '阶段 5 · 项目收尾与经营拓展',
  closing: '项目收尾中',
  done: '项目已完成',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface StagePanelProps {
  projectId: string;
  state: ProjectState;
  stageMeta: Record<string, unknown>;
  onMetaSaved?: () => void;
}

export function StagePanel({ projectId, state, stageMeta, onMetaSaved }: StagePanelProps) {
  const fields = STAGE_FIELDS[state] ?? [];
  const checklistDefs = CHECKLISTS[state] ?? [];

  const [meta, setMeta] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = String(stageMeta[f.key] ?? '');
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const { data: checklistItems = [], refetch: refetchChecklist } =
    trpc.checklist.getForProject.useQuery({ projectId });

  const toggle = trpc.checklist.toggle.useMutation({
    onSuccess: () => refetchChecklist(),
  });

  const updateMeta = trpc.projects.updateStageMeta.useMutation({
    onSuccess: () => {
      setSaveMsg('已保存');
      setSaving(false);
      onMetaSaved?.();
      setTimeout(() => setSaveMsg(''), 2000);
    },
    onError: (e) => {
      setSaveMsg('保存失败: ' + e.message);
      setSaving(false);
    },
  });

  const handleSaveMeta = () => {
    setSaving(true);
    setSaveMsg('');
    const parsed: Record<string, unknown> = {};
    for (const f of fields) {
      const v = meta[f.key];
      if (f.type === 'number') parsed[f.key] = v === '' ? null : Number(v);
      else parsed[f.key] = v || null;
    }
    updateMeta.mutate({ projectId, stageMeta: parsed });
  };

  const isChecked = (key: string) =>
    checklistItems.find(i => i.stage === state && i.key === key)?.checked ?? false;

  const checklistComplete =
    checklistDefs.length === 0 || checklistDefs.every(d => isChecked(d.key));

  if (fields.length === 0 && checklistDefs.length === 0) return null;

  const panelStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 8,
    padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    marginBottom: '1rem',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: '#555',
    fontWeight: 500,
    display: 'block',
    marginBottom: '0.2rem',
  };
  const inputStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    borderRadius: 5,
    padding: '0.35rem 0.55rem',
    fontSize: '0.85rem',
    width: '100%',
    boxSizing: 'border-box',
  };
  const sectionLabelStyle: React.CSSProperties = {
    margin: '0 0 0.5rem',
    fontSize: '0.75rem',
    color: '#888',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#333' }}>
        {STAGE_TITLES[state]}
      </h2>

      {/* Threshold alerts (discovery stage) */}
      {state === 'discovery' && (() => {
        const dr = typeof stageMeta.discountRate === 'number' ? stageMeta.discountRate : null;
        const ca = typeof stageMeta.contractAmount === 'number' ? stageMeta.contractAmount : null;
        const since = typeof stageMeta._discountCoolingSince === 'string' ? stageMeta._discountCoolingSince : null;
        const alerts: React.ReactNode[] = [];

        if (dr !== null && dr < 70) {
          alerts.push(
            <div key="dr-red" style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', marginBottom: '0.75rem' }}>
              <strong>🚫 折扣红线：</strong>折扣率 {dr}% 低于 70% 最低阈值。请拆分为小额试单或拒绝本项目。
            </div>
          );
        } else if (dr !== null && dr >= 70 && dr < 85) {
          const elapsed = since ? Date.now() - new Date(since).getTime() : 0;
          const remainMs = 24 * 3600 * 1000 - elapsed;
          const remainHours = Math.ceil(remainMs / 3600000);
          const cooled = since && remainMs <= 0;
          alerts.push(
            <div key="dr-yellow" style={{ background: cooled ? '#f0fdf4' : '#fffbeb', border: `1px solid ${cooled ? '#86efac' : '#fcd34d'}`, borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: cooled ? '#15803d' : '#92400e', marginBottom: '0.75rem' }}>
              {cooled
                ? <><strong>✓ 冷静期已满：</strong>折扣率 {dr}%，24h 冷静期已完成，可推进合同阶段。</>
                : <><strong>⏳ 折扣冷静期：</strong>折扣率 {dr}%（70–84% 黄线），{since ? `还需约 ${remainHours} 小时` : '请保存阶段数据以启动 24h 计时'}。保存后请写入复盘原因。</>
              }
            </div>
          );
        }

        if (ca !== null && ca > 200000) {
          const reviewed = typeof stageMeta._lawyerReviewConfirmed === 'string'
            ? stageMeta._lawyerReviewConfirmed
            : '';
          if (!reviewed.startsWith('yes')) {
            alerts.push(
              <div key="ca-lawyer" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#92400e', marginBottom: '0.75rem' }}>
                <strong>⚖️ 律师审核：</strong>合同金额 ¥{(ca / 10000).toFixed(1)}万 超过 20 万，须经一次性外部律师审核后在下方确认。
              </div>
            );
          }
        }

        return alerts.length > 0 ? <div>{alerts}</div> : null;
      })()}

      {/* Checklist */}
      {checklistDefs.length > 0 && (
        <div style={{ marginBottom: fields.length > 0 ? '1.25rem' : 0 }}>
          <p style={sectionLabelStyle}>
            本阶段待办清单
            <span style={{ marginLeft: 8, fontWeight: 700, color: checklistComplete ? '#22c55e' : '#c00' }}>
              {checklistComplete ? '✓ 全部完成' : `已完成 ${checklistDefs.filter(d => isChecked(d.key)).length} / 共 ${checklistDefs.length} 项`}
            </span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {checklistDefs.map(({ key, label }) => {
              const checked = isChecked(key);
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: checked ? '#aaa' : '#c00',
                    borderLeft: checked ? '3px solid transparent' : '3px solid #fca5a5',
                    paddingLeft: '0.4rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e =>
                      toggle.mutate({ projectId, stage: state, key, checked: e.target.checked })
                    }
                    style={{ width: 15, height: 15, accentColor: '#4a4af0', flexShrink: 0 }}
                  />
                  <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata form */}
      {fields.length > 0 && (
        <div>
          <p style={sectionLabelStyle}>阶段数据</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {fields.map(f => (
              <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : {}}>
                <label style={labelStyle}>{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={meta[f.key] ?? ''}
                    onChange={e => setMeta(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">— 请选择 —</option>
                    {(f.options ?? []).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={meta[f.key] ?? ''}
                    onChange={e => setMeta(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleSaveMeta}
              disabled={saving}
              style={{
                padding: '0.35rem 0.9rem',
                borderRadius: 5,
                border: 'none',
                background: '#4a4af0',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '保存中…' : '保存阶段数据'}
            </button>
            {saveMsg && (
              <span style={{ fontSize: '0.8rem', color: saveMsg.startsWith('保存失败') ? '#c00' : '#22c55e' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
