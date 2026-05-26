import type { ProjectState } from '@/db/schema/projects';

export type ChecklistItemDef = { key: string; label: string };

export const CHECKLISTS: Record<ProjectState, ChecklistItemDef[]> = {
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
  closing: [
    { key: 'contract_formally_closed', label: '合同已正式结案并归档' },
    { key: 'accounts_settled', label: '财务对账已完成，无待收款项' },
    { key: 'assets_delivered', label: '所有报告与数据已确认移交客户' },
  ],
  done: [],
};

export const CHECKLIST_KEYS: Record<ProjectState, string[]> = Object.fromEntries(
  (Object.entries(CHECKLISTS) as [ProjectState, ChecklistItemDef[]][]).map(
    ([state, items]) => [state, items.map(i => i.key)]
  )
) as Record<ProjectState, string[]>;
