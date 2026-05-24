'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';

// ─── Checklist definitions per stage ─────────────────────────────────────────

const CHECKLISTS: Record<ProjectState, Array<{ key: string; label: string }>> = {
  lead: [
    { key: 'client_info_complete', label: '客户基本信息已完整录入' },
    { key: 'initial_call_done', label: '初步沟通已完成（30-60分钟）' },
    { key: 'feasibility_assessed', label: '可行性评估矩阵已填写' },
    { key: 'go_decision_made', label: 'Go/No-Go 决策已记录' },
  ],
  qualifying: [
    { key: 'requirements_surveyed', label: '需求调研已完成（业务/技术/合规三维度）' },
    { key: 'requirements_doc_drafted', label: '需求确认书已起草' },
    { key: 'assessment_plan_designed', label: '测评方案已设计完成' },
    { key: 'client_confirmed_plan', label: '客户已书面确认方案' },
  ],
  discovery: [
    { key: 'quote_sent', label: '报价单已发送并获客户确认' },
    { key: 'contract_amount_set', label: '合同金额已确定' },
    { key: 'compliance_checklist_done', label: '合规清单已完成（个保法/数据安全）' },
    { key: 'contract_signed', label: '合同已正式签署' },
  ],
  contract: [
    { key: 'kickoff_meeting_done', label: '项目启动会已完成' },
    { key: 'system_configured', label: '系统配置已完成并测试通过' },
    { key: 'invitations_sent', label: '参与者邀请已完成（交付率≥95%）' },
    { key: 'data_quality_passed', label: '数据质量检查已通过' },
  ],
  execution: [
    { key: 'individual_reports_done', label: '个人报告已生成并审核' },
    { key: 'group_report_done', label: '群体报告已生成并审核' },
    { key: 'reports_delivered', label: '报告已交付客户' },
    { key: 'delivery_confirmed', label: '客户已签署交付确认书' },
  ],
  reporting: [
    { key: 'final_payment_received', label: '尾款已收取' },
    { key: 'satisfaction_survey_done', label: '满意度调查已完成（NPS已计算）' },
    { key: 'debrief_done', label: '项目复盘会已完成' },
    { key: 'closeout_archived', label: '结项文档已归档' },
  ],
  closing: [],
  done: [],
};

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
    { key: 'goDecision', label: '准入决策', type: 'select', options: ['go - 全部维度通过', 'conditional - 需风险缓解', 'no-go - 暂不推进'] },
    { key: 'feasibilityNotes', label: '可行性评估备注', type: 'text', wide: true },
  ],
  qualifying: [
    { key: 'assessmentObjective', label: '测评目标', type: 'text' },
    { key: 'targetPopulation', label: '目标人群', type: 'text' },
    { key: 'budget', label: '预算范围', type: 'text' },
    { key: 'timeline', label: '期望交付时间', type: 'text' },
  ],
  discovery: [
    { key: 'contractAmount', label: '合同金额（元）', type: 'number' },
    { key: 'paymentTerms', label: '付款条款', type: 'text' },
    { key: 'discountRate', label: '折扣率（%）', type: 'number' },
    { key: 'signedDate', label: '合同签署日期', type: 'text' },
  ],
  contract: [
    { key: 'completionRate', label: '问卷完成率（%）', type: 'number' },
    { key: 'dataQualityStatus', label: '数据质量状态', type: 'select', options: ['pending - 待检查', 'pass - 通过', 'fail - 不通过'] },
    { key: 'milestonesNote', label: '里程碑进展备注', type: 'text', wide: true },
  ],
  execution: [
    { key: 'individualReportCount', label: '个人报告数量', type: 'number' },
    { key: 'groupReportDone', label: '群体报告状态', type: 'select', options: ['pending - 待完成', 'done - 已完成'] },
    { key: 'deliveryMethod', label: '交付方式', type: 'select', options: ['平台在线', '邮件（加密）', '线下演示', '混合'] },
    { key: 'deliveryDate', label: '交付日期', type: 'text' },
  ],
  reporting: [
    { key: 'finalPaymentStatus', label: '尾款状态', type: 'select', options: ['pending - 待收款', 'partial - 部分到账', 'paid - 已全额到账'] },
    { key: 'npsScore', label: 'NPS 净推荐值（-100~100）', type: 'number' },
    { key: 'renewalStatus', label: '续约意向', type: 'select', options: ['pending - 待确认', 'yes - 有续约意向', 'no - 无续约意向'] },
  ],
  closing: [],
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

      {/* Checklist */}
      {checklistDefs.length > 0 && (
        <div style={{ marginBottom: fields.length > 0 ? '1.25rem' : 0 }}>
          <p style={sectionLabelStyle}>
            本阶段待办清单
            {checklistComplete && (
              <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 700 }}>✓ 全部完成</span>
            )}
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
                    color: checked ? '#aaa' : '#333',
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
