'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ImeTextarea } from '@/components/ime';
import { AdvanceProjectButton } from '@/components/AdvanceProjectButton';
import { StagePanel } from '@/components/StagePanel';
import { EventTimeline } from '@/components/EventTimeline';
import { MonthlyRetrospectivePanel } from '@/components/MonthlyRetrospectivePanel';
import { ReportCard } from '@/components/ReportCard';
import { generateProjectCsv, downloadCsv } from '@/lib/export-project-csv';
import { CHECKLIST_KEYS } from '@/lib/checklist-defs';
import type { ProjectState } from '@/db/schema/projects';

const STATE_ZH: Record<ProjectState, string> = {
  lead: '线索', qualifying: '资格确认', discovery: '需求挖掘',
  contract: '合同', execution: '执行', reporting: '汇报',
  closing: '收尾', done: '完成'
};

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

function JobProfilePanel({ projectId, currentProfileId, onChanged }: { projectId: string; currentProfileId: string | null; onChanged: () => void }) {
  const { data: profiles = [] } = trpc.jobProfiles.list.useQuery();
  const setProfile = trpc.projects.setJobProfile.useMutation({ onSuccess: onChanged });
  const current = profiles.find(p => p.id === currentProfileId);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1rem' }}>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>岗位画像</p>
      {current ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
          <a href={`/workbench/job-profiles/${current.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#4a4af0', textDecoration: 'none' }}>{current.name}</a>
          {current.department && <span style={{ fontSize: '0.75rem', color: '#666', background: '#f0f0f8', padding: '0.15rem 0.4rem', borderRadius: 20 }}>{current.department}</span>}
          <button onClick={() => setProfile.mutate({ projectId, jobProfileId: null })} disabled={setProfile.isPending} style={{ marginLeft: 'auto', padding: '0.2rem 0.55rem', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>解除绑定</button>
        </div>
      ) : (
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', color: '#888' }}>暂未绑定岗位画像。</p>
      )}
      {profiles.length > 0 && (
        <select
          value={currentProfileId ?? ''}
          onChange={e => setProfile.mutate({ projectId, jobProfileId: e.target.value || null })}
          disabled={setProfile.isPending}
          style={{ padding: '0.35rem 0.6rem', border: '1px solid #ddd', borderRadius: 5, fontSize: '0.8rem', minWidth: 200 }}
        >
          <option value="">选择岗位画像…</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}{p.department ? ` · ${p.department}` : ''}</option>)}
        </select>
      )}
      {profiles.length === 0 && (
        <a href="/workbench/job-profiles/new" style={{ fontSize: '0.8rem', color: '#4a4af0', textDecoration: 'none' }}>前往创建岗位画像 →</a>
      )}
    </div>
  );
}

function GrantsPanel({ projectId }: { projectId: string }) {
  const { data: grants = [], refetch } = trpc.grants.listForProject.useQuery({ projectId });
  const { data: contractors = [] } = trpc.grants.listContractors.useQuery();
  const grantMut = trpc.grants.grant.useMutation({ onSuccess: () => refetch() });
  const revokeMut = trpc.grants.revoke.useMutation({ onSuccess: () => refetch() });

  const [selectedUser, setSelectedUser] = useState('');
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

  const grantedUserIds = new Set(grants.map((g) => g.userId));
  const available = contractors.filter((c) => !grantedUserIds.has(c.id));

  function handleGrant() {
    if (!selectedUser) return;
    grantMut.mutate({ projectId, userId: selectedUser, expiresAt: new Date(expiryDate + 'T23:59:59Z').toISOString() });
    setSelectedUser('');
  }

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1rem' }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        协作者
      </p>
      {grants.length === 0 ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#888' }}>暂无协作者。</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {grants.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8f8fc', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{g.user.name ?? g.user.email}</span>
                {g.user.name && <span style={{ color: '#888', marginLeft: '0.4rem' }}>{g.user.email}</span>}
                <span style={{ marginLeft: '0.75rem', color: '#888' }}>到期：{new Date(g.expiresAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <button onClick={() => revokeMut.mutate({ grantId: g.id })} disabled={revokeMut.isPending} style={{ padding: '0.2rem 0.55rem', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                撤销
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ padding: '0.35rem 0.6rem', border: '1px solid #ddd', borderRadius: 5, fontSize: '0.8rem', minWidth: 160 }}>
          <option value="">选择协作者…</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.email}</option>)}
        </select>
        <input type="date" value={expiryDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiryDate(e.target.value)} style={{ padding: '0.35rem 0.6rem', border: '1px solid #ddd', borderRadius: 5, fontSize: '0.8rem' }} />
        <button onClick={handleGrant} disabled={!selectedUser || grantMut.isPending} style={{ padding: '0.35rem 0.75rem', borderRadius: 5, background: '#4a4af0', color: '#fff', border: 'none', cursor: selectedUser ? 'pointer' : 'not-allowed', opacity: selectedUser ? 1 : 0.5, fontSize: '0.8rem', fontWeight: 600 }}>
          {grantMut.isPending ? '授权中…' : '授权'}
        </button>
      </div>
      {available.length === 0 && contractors.length > 0 && <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#888' }}>所有协作者均已授权。</p>}
      {contractors.length === 0 && <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#888' }}>系统中暂无 contractor 角色用户。</p>}
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: project, isLoading, refetch } = trpc.projects.getById.useQuery(
    { projectId: params.id },
    { enabled: !!params.id }
  );
  const { data: events = [], refetch: refetchEvents } = trpc.projects.listEvents.useQuery(
    { projectId: params.id },
    { enabled: !!params.id }
  );
  const { data: checklistItems = [] } = trpc.checklist.getForProject.useQuery(
    { projectId: params.id },
    { enabled: !!params.id }
  );

  const addNote = trpc.projects.addNote.useMutation({ onSuccess: () => { refetchEvents(); setNoteText(''); } });
  const [noteText, setNoteText] = useState('');

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { refetch(); setEditing(false); }
  });
  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => router.push('/workbench/projects')
  });

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editErr, setEditErr] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    try {
      const data = await utils.projects.getFullReport.fetch({ projectId: params.id });
      const csv = generateProjectCsv(data);
      const safeTitle = (title as string).replace(/[^一-龥\w-]/g, '_').slice(0, 40);
      downloadCsv(`项目报告_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  function startEdit() {
    if (!project) return;
    setEditTitle((project as Record<string, unknown>).title as string ?? '');
    setEditNotes((project as Record<string, unknown>).notes as string ?? '');
    setEditErr('');
    setEditing(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditErr('');
    updateProject.mutate(
      { projectId: params.id, title: editTitle.trim(), notes: editNotes.trim() || null },
      { onError: (err) => setEditErr(err.message) }
    );
  }

  if (isLoading) return <p style={{ color: '#888' }}>加载中…</p>;
  if (!project) return <p style={{ color: '#888' }}>项目不存在。</p>;

  const title = (project as Record<string, unknown>).title as string ?? project.id;
  const notes = (project as Record<string, unknown>).notes as string | undefined;
  const updatedAt = (project as Record<string, unknown>).updatedAt as string;

  const requiredKeys = CHECKLIST_KEYS[project.state] ?? [];
  const checkedSet = new Set(
    checklistItems.filter(i => i.stage === project.state && i.checked).map(i => i.key)
  );
  const missingCount = requiredKeys.filter(k => !checkedSet.has(k)).length;
  const checklistBlockReason = missingCount > 0
    ? `请先完成本阶段的自检清单（还差 ${missingCount} 项）`
    : undefined;

  let thresholdBlockReason: string | undefined;
  if (project.state === 'discovery') {
    const meta = (project as Record<string, unknown>).stageMeta as Record<string, unknown> ?? {};
    const dr = typeof meta.discountRate === 'number' ? meta.discountRate : null;
    const ca = typeof meta.contractAmount === 'number' ? meta.contractAmount : null;
    if (dr !== null && dr < 70) {
      thresholdBlockReason = `折扣率 ${dr}% 低于 70% 红线，不可进入合同阶段`;
    } else if (dr !== null && dr >= 70 && dr < 85) {
      const since = typeof meta._discountCoolingSince === 'string' ? meta._discountCoolingSince : null;
      if (!since) {
        thresholdBlockReason = '折扣率触发 24h 冷静期，请先保存阶段数据启动计时';
      } else {
        const remainMs = 24 * 3600 * 1000 - (Date.now() - new Date(since).getTime());
        if (remainMs > 0) {
          thresholdBlockReason = `折扣冷静期中，还需约 ${Math.ceil(remainMs / 3600000)} 小时`;
        }
      }
    }
    if (!thresholdBlockReason && ca !== null && ca > 200000) {
      const reviewed = typeof meta._lawyerReviewConfirmed === 'string' ? meta._lawyerReviewConfirmed : '';
      if (!reviewed.startsWith('yes')) {
        thresholdBlockReason = `合同金额 ¥${(ca / 10000).toFixed(1)}万 需律师审核确认后方可推进`;
      }
    }
  }

  const blockReason = checklistBlockReason ?? thresholdBlockReason;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <a href="/workbench/projects" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>← 项目列表</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{title}</h1>
        {!editing && (
          <>
            <button
              onClick={startEdit}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #c7c7f0', background: '#fff', color: '#4a4af0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              编辑
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #c7c7f0', background: '#fff', color: '#4a4af0', cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? '导出中…' : '导出 CSV'}
            </button>
            {project.state === 'lead' && (
              <button
                onClick={() => { setDeleteErr(''); setConfirmDelete(true); }}
                style={{ padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginLeft: 'auto' }}
              >
                删除
              </button>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', fontWeight: 600, color: '#c00' }}>
            确认删除项目「{title}」？此操作不可撤销。
          </p>
          {deleteErr && <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#c00' }}>{deleteErr}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => deleteProject.mutate({ projectId: params.id }, { onError: (err) => { setDeleteErr(err.message); setConfirmDelete(false); } })} disabled={deleteProject.isPending} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              {deleteProject.isPending ? '删除中…' : '确认删除'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>编辑项目</p>
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>项目名称 *</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} required style={{ border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>备注</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} style={{ border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            {editErr && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{editErr}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={updateProject.isPending} style={{ padding: '0.4rem 1rem', borderRadius: 5, background: '#4a4af0', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                {updateProject.isPending ? '保存中…' : '保存'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.4rem 0.85rem', borderRadius: 5, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
          <dt style={{ color: '#888', fontWeight: 500 }}>状态</dt>
          <dd style={{ margin: 0 }}>
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: 20, background: '#e8f4fd', color: '#0968d6', fontWeight: 600 }}>
              {STATE_ZH[project.state] ?? project.state}
            </span>
          </dd>
          {!!notes && (
            <>
              <dt style={{ color: '#888', fontWeight: 500 }}>备注</dt>
              <dd style={{ margin: 0, color: '#444' }}>{notes}</dd>
            </>
          )}
          <dt style={{ color: '#888', fontWeight: 500 }}>更新时间</dt>
          <dd style={{ margin: 0, color: '#666' }}>{new Date(updatedAt).toLocaleString('zh-CN')}</dd>
        </dl>
      </div>

      <StagePanel
        projectId={project.id}
        state={project.state}
        stageMeta={(project as Record<string, unknown>).stageMeta as Record<string, unknown> ?? {}}
        onMetaSaved={() => { refetch(); refetchEvents(); }}
      />

      {project.state !== 'done' && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#888', fontWeight: 500 }}>推进状态</p>
          <AdvanceProjectButton
            projectId={project.id}
            currentState={project.state}
            onAdvanced={() => { refetch(); refetchEvents(); }}
            blockReason={blockReason}
          />
        </div>
      )}

      <JobProfilePanel projectId={project.id} currentProfileId={(project as Record<string, unknown>).jobProfileId as string | null ?? null} onChanged={refetch} />

      <GrantsPanel projectId={project.id} />

      {/* Note input */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1rem' }}>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>添加跟进备注</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <ImeTextarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="记录跟进情况、沟通要点…"
            rows={2}
            style={{ flex: 1, border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <button
            onClick={() => noteText.trim() && addNote.mutate({ projectId: project.id, content: noteText.trim() })}
            disabled={!noteText.trim() || addNote.isPending}
            style={{ padding: '0.45rem 0.9rem', borderRadius: 5, background: '#4a4af0', color: '#fff', border: 'none', cursor: noteText.trim() ? 'pointer' : 'not-allowed', opacity: noteText.trim() ? 1 : 0.45, fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            {addNote.isPending ? '…' : '记录'}
          </button>
        </div>
      </div>

      <ReportCard projectId={project.id} />

      <MonthlyRetrospectivePanel projectId={project.id} />

      <EventTimeline events={events} />
    </div>
  );
}
