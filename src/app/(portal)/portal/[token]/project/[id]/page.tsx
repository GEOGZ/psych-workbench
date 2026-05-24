'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import type { ProjectState } from '@/db/schema/projects';

const STAGE_STEPS: { state: ProjectState; label: string }[] = [
  { state: 'lead',       label: '准入' },
  { state: 'qualifying', label: '需求确认' },
  { state: 'discovery',  label: '合同签约' },
  { state: 'contract',   label: '项目执行' },
  { state: 'execution',  label: '报告交付' },
  { state: 'reporting',  label: '项目收尾' },
];

const CHECKLIST_LABELS: Record<string, Record<string, string>> = {
  lead:       { client_info_complete: '基本信息确认', initial_call_done: '初步沟通', feasibility_assessed: '可行性评估', go_decision_made: '准入决策' },
  qualifying: { requirements_surveyed: '需求调研', requirements_doc_drafted: '需求确认书', assessment_plan_designed: '测评方案设计', client_confirmed_plan: '方案确认' },
  discovery:  { quote_sent: '报价确认', contract_amount_set: '合同金额确定', compliance_checklist_done: '合规审查', contract_signed: '合同签署' },
  contract:   { kickoff_meeting_done: '项目启动', system_configured: '系统配置', invitations_sent: '参与者邀请', data_quality_passed: '数据质量检查' },
  execution:  { individual_reports_done: '个人报告', group_report_done: '群体报告', reports_delivered: '报告交付', delivery_confirmed: '客户确认' },
  reporting:  { final_payment_received: '尾款结算', satisfaction_survey_done: '满意度调查', debrief_done: '项目复盘', closeout_archived: '文档归档' },
};

export default function PortalProjectPage({ params }: { params: { token: string; id: string } }) {
  const router = useRouter();
  const { token, id } = params;

  const { data: project, isLoading, isError } = trpc.portal.getProject.useQuery(
    { token, projectId: id },
    { retry: false }
  );

  const { data: checklistItems = [] } = trpc.portal.getChecklist.useQuery(
    { token, projectId: id },
    { enabled: !!project }
  );

  useEffect(() => {
    if (isError) router.replace('/portal/expired');
  }, [isError, router]);

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5fa', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <p style={{ color: '#888' }}>加载中…</p>
    </div>
  );

  if (!project) return null;

  const currentIdx = STAGE_STEPS.findIndex(s => s.state === project.state);
  const isDone = project.state === 'done' || project.state === 'closing';

  const stageChecklist = CHECKLIST_LABELS[project.state] ?? {};
  const stageKeys = Object.keys(stageChecklist);
  const checkedKeys = new Set(
    checklistItems.filter(i => i.stage === project.state && i.checked).map(i => i.key)
  );
  const completedCount = stageKeys.filter(k => checkedKeys.has(k)).length;
  const totalCount = stageKeys.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5fa', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '1rem 1.5rem' }}>
        <a href={`/portal/${token}`} style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>← 返回列表</a>
      </header>

      <main style={{ padding: '1.5rem', maxWidth: 580, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>{project.title}</h1>

        {/* Stage progress */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.85rem', fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>项目进度</p>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STAGE_STEPS.map((step, idx) => {
              const done = isDone || idx < currentIdx;
              const active = !isDone && idx === currentIdx;
              const future = !isDone && idx > currentIdx;
              return (
                <div key={step.state} style={{ display: 'flex', alignItems: 'center', flex: idx < STAGE_STEPS.length - 1 ? 1 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                      background: done || active ? '#4a4af0' : '#e5e7eb',
                      color: done || active ? '#fff' : '#9ca3af',
                      boxShadow: active ? '0 0 0 3px rgba(74,74,240,0.2)' : 'none',
                    }}>
                      {done ? '✓' : idx + 1}
                    </div>
                    <span style={{ fontSize: '0.6rem', color: active ? '#4a4af0' : future ? '#9ca3af' : '#6b7280', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STAGE_STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: done ? '#4a4af0' : '#e5e7eb', margin: '0 2px', marginBottom: '1.1rem' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checklist completion */}
        {totalCount > 0 && (
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>本阶段完成情况</p>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: pct === 100 ? '#22c55e' : '#4a4af0' }}>{completedCount}/{totalCount}</span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, marginBottom: '0.85rem', overflow: 'hidden' }}>
              <div style={{ background: pct === 100 ? '#22c55e' : '#4a4af0', width: `${pct}%`, height: '100%', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {stageKeys.map(key => {
                const checked = checkedKeys.has(key);
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: checked ? '#94a3b8' : '#374151' }}>
                    <span style={{ color: checked ? '#22c55e' : '#d1d5db' }}>{checked ? '✓' : '○'}</span>
                    <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>{stageChecklist[key]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {!!project.notes && (
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>顾问备注</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#444', lineHeight: 1.6 }}>{project.notes}</p>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 8, padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.5rem 1rem', fontSize: '0.83rem' }}>
            <dt style={{ color: '#888', fontWeight: 500 }}>最近更新</dt>
            <dd style={{ margin: 0, color: '#666' }}>{new Date(project.updatedAt).toLocaleString('zh-CN')}</dd>
          </dl>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '1.5rem', textAlign: 'center' }}>如有疑问请联系您的顾问</p>
      </main>
    </div>
  );
}
