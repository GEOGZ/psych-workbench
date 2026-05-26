// Stage display names and field labels for CSV export
const STAGE_ZH: Record<string, string> = {
  lead: '阶段0·客户准入',
  qualifying: '阶段1·需求确认',
  discovery: '阶段2·合同签约',
  contract: '阶段3·执行监控',
  execution: '阶段4·报告交付',
  reporting: '阶段5·项目收尾',
  closing: '收尾中',
  done: '已完成',
};

const STAGE_META_LABELS: Record<string, string> = {
  clientTier: '客户等级',
  sourceChannel: '客户来源渠道',
  headcountEstimate: '预估测评人数',
  decisionMaker: '决策人姓名/职位',
  goDecision: '准入决策',
  feasibilityNotes: '可行性评估备注',
  assessmentObjective: '测评目标',
  targetPopulation: '目标人群',
  budget: '预算范围',
  timeline: '期望交付时间',
  assessmentTools: '测评工具清单',
  techRequirements: '技术集成需求',
  contractNumber: '合同编号',
  contractAmount: '合同金额（元）',
  paymentTerms: '付款条款',
  depositAmount: '预付款金额（元）',
  discountRate: '折扣率（%）',
  signedDate: '合同签署日期',
  participantCount: '实际参与人数',
  assessmentStartDate: '测评开始日期',
  completionRate: '问卷完成率（%）',
  dataQualityStatus: '数据质量状态',
  milestonesNote: '里程碑进展备注',
  individualReportCount: '个人报告数量',
  groupReportDone: '群体报告状态',
  deliveryMethod: '交付方式',
  deliveryDate: '交付日期',
  feedbackSummary: '初步客户反馈',
  invoiceNumber: '发票编号',
  actualRevenue: '实际到账金额（元）',
  finalPaymentStatus: '尾款状态',
  npsScore: 'NPS净推荐值',
  renewalStatus: '续约意向',
  closingNotes: '结案备注',
};

const CHECKLIST_LABELS: Record<string, Record<string, string>> = {
  lead: {
    client_info_complete: '客户基本信息已完整录入',
    initial_call_done: '初步沟通已完成',
    feasibility_assessed: '可行性评估矩阵已填写',
    go_decision_made: 'Go/No-Go决策已记录',
  },
  qualifying: {
    requirements_surveyed: '需求调研已完成',
    requirements_doc_drafted: '需求确认书已起草',
    assessment_plan_designed: '测评方案已设计完成',
    client_confirmed_plan: '客户已书面确认方案',
  },
  discovery: {
    quote_sent: '报价单已发送并获客户确认',
    contract_amount_set: '合同金额已确定',
    compliance_checklist_done: '合规清单已完成',
    contract_signed: '合同已正式签署',
  },
  contract: {
    kickoff_meeting_done: '项目启动会已完成',
    system_configured: '系统配置已完成并测试通过',
    invitations_sent: '参与者邀请已完成',
    data_quality_passed: '数据质量检查已通过',
  },
  execution: {
    individual_reports_done: '个人报告已生成并审核',
    group_report_done: '群体报告已生成并审核',
    reports_delivered: '报告已交付客户',
    delivery_confirmed: '客户已签署交付确认书',
  },
  reporting: {
    final_payment_received: '尾款已收取',
    satisfaction_survey_done: '满意度调查已完成',
    debrief_done: '项目复盘会已完成',
    closeout_archived: '结项文档已归档',
  },
  closing: {
    contract_formally_closed: '合同已正式结案并归档',
    accounts_settled: '财务对账已完成',
    assets_delivered: '所有报告与数据已确认移交客户',
  },
};

const EVENT_TYPE_ZH: Record<string, string> = {
  state_advanced: '状态推进',
  note_added: '添加备注',
  hat_switched: '切换帽子',
  contractor_granted: '授权协作者',
  contractor_revoked: '撤销协作者',
  portal_token_issued: '发放Portal链接',
  portal_token_revoked: '撤销Portal链接',
  checklist_toggled: '清单勾选',
  stage_meta_updated: '保存阶段数据',
  project_updated: '项目信息更新',
  client_updated: '客户信息更新',
};

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function row(...cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

function formatDate(d: unknown): string {
  if (!d) return '';
  try {
    return new Date(d as string).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return String(d);
  }
}

export type ProjectReportData = {
  project: {
    id: string;
    title: string;
    state: string;
    notes?: string | null;
    stageMeta: Record<string, unknown>;
    createdAt: unknown;
    updatedAt: unknown;
  };
  client: {
    name: string;
    contactName: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    crisisContactName: string;
    crisisContactPhone: string;
    notes?: string | null;
  } | null;
  events: Array<{
    at: unknown;
    eventType: string;
    payload: unknown;
    actorUserId?: string | null;
  }>;
  checklistItems: Array<{
    stage: string;
    key: string;
    checked: boolean;
    checkedAt?: unknown;
  }>;
};

export function generateProjectCsv(data: ProjectReportData): string {
  const lines: string[] = [];
  const { project, client, events, checklistItems } = data;

  lines.push(row('项目报告', project.title));
  lines.push(row('导出时间', formatDate(new Date())));
  lines.push('');

  lines.push(row('## 项目基本信息'));
  lines.push(row('字段', '内容'));
  lines.push(row('项目ID', project.id));
  lines.push(row('项目名称', project.title));
  lines.push(row('当前阶段', `${STAGE_ZH[project.state] ?? project.state} (${project.state})`));
  lines.push(row('顾问备注', project.notes ?? ''));
  lines.push(row('创建时间', formatDate(project.createdAt)));
  lines.push(row('最后更新', formatDate(project.updatedAt)));
  lines.push('');

  lines.push(row('## 客户信息'));
  lines.push(row('字段', '内容'));
  if (client) {
    lines.push(row('客户名称', client.name));
    lines.push(row('联系人', client.contactName));
    lines.push(row('联系邮箱', client.contactEmail ?? ''));
    lines.push(row('联系电话', client.contactPhone ?? ''));
    lines.push(row('危机联系人', client.crisisContactName));
    lines.push(row('危机联系电话', client.crisisContactPhone));
    lines.push(row('客户备注', client.notes ?? ''));
  } else {
    lines.push(row('（客户数据不可用）', ''));
  }
  lines.push('');

  lines.push(row('## 阶段数据'));
  lines.push(row('字段key', '字段标签', '内容'));
  const meta = project.stageMeta ?? {};
  const metaKeys = Object.keys(meta).filter(k => meta[k] != null && meta[k] !== '');
  if (metaKeys.length > 0) {
    for (const k of metaKeys) {
      lines.push(row(k, STAGE_META_LABELS[k] ?? k, meta[k]));
    }
  } else {
    lines.push(row('（暂无阶段数据）', '', ''));
  }
  lines.push('');

  lines.push(row('## 待办清单'));
  lines.push(row('阶段', '清单项', '状态', '完成时间'));
  const checklistMap = new Map(checklistItems.map(i => [`${i.stage}__${i.key}`, i]));
  for (const stage of ['lead', 'qualifying', 'discovery', 'contract', 'execution', 'reporting', 'closing']) {
    const stageDefs = CHECKLIST_LABELS[stage];
    if (!stageDefs) continue;
    for (const [key, label] of Object.entries(stageDefs)) {
      const item = checklistMap.get(`${stage}__${key}`);
      const checked = item?.checked ? '✓ 已完成' : '○ 未完成';
      const checkedAt = item?.checked && item.checkedAt ? formatDate(item.checkedAt) : '';
      lines.push(row(STAGE_ZH[stage] ?? stage, label, checked, checkedAt));
    }
  }
  lines.push('');

  lines.push(row('## 操作日志'));
  lines.push(row('时间', '事件类型', '详情'));
  if (events.length > 0) {
    for (const e of events) {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      lines.push(row(formatDate(e.at), EVENT_TYPE_ZH[e.eventType] ?? e.eventType, formatEventDetail(e.eventType, payload)));
    }
  } else {
    lines.push(row('（暂无日志）', '', ''));
  }

  return '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8
}

function formatEventDetail(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'state_advanced':
      return `${payload.from ?? ''} → ${payload.to ?? ''}`;
    case 'note_added':
      return String(payload.content ?? '').slice(0, 120);
    case 'checklist_toggled':
      return `${payload.stage} / ${payload.key}: ${payload.checked ? '已勾选' : '已取消'}`;
    case 'stage_meta_updated':
      return `阶段: ${payload.stage ?? ''}`;
    case 'contractor_granted':
    case 'contractor_revoked':
      return String(payload.userId ?? '');
    default:
      return Object.entries(payload).map(([k, v]) => `${k}=${v}`).join('; ').slice(0, 120);
  }
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
