'use client';

interface AuditEvent {
  id: string;
  eventType: string;
  payload: unknown;
  at: Date | string;
}

const EVENT_ICON: Record<string, string> = {
  state_advanced:      '→',
  checklist_toggled:   '☑',
  stage_meta_updated:  '✎',
  note_added:          '📝',
  hat_switched:        '🎩',
  portal_token_issued: '🔑',
  portal_token_revoked:'🔒',
  contractor_granted:  '👤',
  contractor_revoked:  '👤',
  project_updated:     '✎',
  client_updated:      '✎',
  monthly_retrospective: '🔄',
};

const EVENT_LABEL: Record<string, (p: Record<string, unknown>) => string> = {
  state_advanced:      p => `阶段推进：${p.fromState} → ${p.toState}${p.note ? `（${p.note}）` : ''}`,
  checklist_toggled:   p => `${p.checked ? '✓ 完成' : '○ 取消'} ${p.key}（${p.stage}）`,
  stage_meta_updated:  p => `阶段数据已更新（${p.stage}）`,
  note_added:          p => (p as Record<string,unknown>).content ? String((p as Record<string,unknown>).content) : '添加了备注',
  hat_switched:        p => `切换帽子：${p.hat}`,
  portal_token_issued: () => '颁发了客户门户链接',
  portal_token_revoked:() => '撤销了客户门户链接',
  contractor_granted:  () => '添加了协作者',
  contractor_revoked:  () => '移除了协作者',
  project_updated:     p => `编辑了项目信息${Object.keys(p).length ? `（${Object.keys(p).join('、')}）` : ''}`,
  client_updated:      p => `编辑了客户信息${Object.keys(p).length ? `（${Object.keys(p).join('、')}）` : ''}`,
  monthly_retrospective: p => `[${p.month}] 月度复盘：${String(p.content ?? '').slice(0, 50)}${String(p.content ?? '').length > 50 ? '…' : ''}`,
};

interface Props {
  events: AuditEvent[];
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        操作记录
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((ev, idx) => {
          const payload = (ev.payload ?? {}) as Record<string, unknown>;
          const labelFn = EVENT_LABEL[ev.eventType];
          const label = labelFn ? labelFn(payload) : ev.eventType;
          const icon = EVENT_ICON[ev.eventType] ?? '·';
          const isLast = idx === events.length - 1;

          return (
            <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
              {/* Timeline spine */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: ev.eventType === 'state_advanced' ? '#4a4af0' : '#e5e7eb',
                  color: ev.eventType === 'state_advanced' ? '#fff' : '#6b7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, zIndex: 1,
                }}>
                  {icon}
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, background: '#e5e7eb', marginTop: 2 }} />}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : '0.85rem', flex: 1, paddingTop: '0.1rem' }}>
                <p style={{ margin: '0 0 0.1rem', fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>{label}</p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>
                  {new Date(ev.at).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
