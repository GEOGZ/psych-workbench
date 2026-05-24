'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { EventTimeline } from '@/components/EventTimeline';
import { ImeInput, ImeTextarea } from '@/components/ime';
import type { ProjectState } from '@/db/schema/projects';

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

function portalUrl(token: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/portal/${token}`;
}

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const inputStyle = {
  border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
  fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const
};

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const clientId = params.id;
  const router = useRouter();

  const { data: client, isLoading: loadingClient, refetch: refetchClient } =
    trpc.clients.getById.useQuery({ clientId }, { enabled: !!clientId });

  const { data: projects = [], isLoading: loadingProjects } =
    trpc.projects.listByClient.useQuery({ clientId }, { enabled: !!clientId });

  const { data: tokens = [], isLoading: loadingTokens, refetch: refetchTokens } =
    trpc.portal.listTokens.useQuery({ clientId }, { enabled: !!clientId });

  const { data: clientEvts = [] } =
    trpc.clients.listEvents.useQuery({ clientId }, { enabled: !!clientId });

  const issueToken = trpc.portal.issueToken.useMutation({ onSuccess: () => refetchTokens() });
  const revokeToken = trpc.portal.revokeToken.useMutation({ onSuccess: () => refetchTokens() });
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { refetchClient(); setEditing(false); }
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => router.push('/workbench/clients')
  });

  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  // Edit form state
  const [eName, setEName] = useState('');
  const [eContactName, setEContactName] = useState('');
  const [eContactEmail, setEContactEmail] = useState('');
  const [eContactPhone, setEContactPhone] = useState('');
  const [eCrisisName, setECrisisName] = useState('');
  const [eCrisisPhone, setECrisisPhone] = useState('');
  const [eNotes, setENotes] = useState('');

  function startEdit() {
    if (!client) return;
    setEName(client.name);
    setEContactName(client.contactName);
    setEContactEmail(client.contactEmail ?? '');
    setEContactPhone(client.contactPhone ?? '');
    setECrisisName(client.crisisContactName);
    setECrisisPhone(client.crisisContactPhone);
    setENotes(client.notes ?? '');
    setEditErr('');
    setEditing(true);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditErr('');
    updateClient.mutate({
      clientId,
      name: eName.trim(),
      contactName: eContactName.trim(),
      contactEmail: eContactEmail.trim() || null,
      contactPhone: eContactPhone.trim() || null,
      crisisContactName: eCrisisName.trim(),
      crisisContactPhone: eCrisisPhone.trim(),
      notes: eNotes.trim() || null
    }, { onError: (err) => setEditErr(err.message) });
  }

  function handleDelete() {
    setDeleteErr('');
    deleteClient.mutate({ clientId }, {
      onError: (err) => { setDeleteErr(err.message); setConfirmDelete(false); }
    });
  }

  function handleIssue() {
    issueToken.mutate({ clientId, expiresAt: new Date(expiryDate + 'T23:59:59Z').toISOString() });
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(portalUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loadingClient) return <p style={{ color: '#888' }}>加载中…</p>;
  if (!client) return <p style={{ color: '#c00' }}>客户不存在。</p>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <a href="/workbench/clients" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>
          ← 客户列表
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{client.name}</h1>
        {!editing && (
          <>
            <button
              onClick={startEdit}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #c7c7f0', background: '#fff', color: '#4a4af0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              编辑
            </button>
            <button
              onClick={() => { setDeleteErr(''); setConfirmDelete(true); }}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 5, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginLeft: 'auto' }}
            >
              删除
            </button>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', fontWeight: 600, color: '#c00' }}>
            确认删除客户「{client.name}」？此操作不可撤销。
          </p>
          {deleteErr && <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#c00' }}>{deleteErr}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleDelete}
              disabled={deleteClient.isPending}
              style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
            >
              {deleteClient.isPending ? '删除中…' : '确认删除'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing ? (
        <section style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            编辑客户信息
          </p>
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {([
              ['公司名称 *', eName, setEName, 'text', true],
              ['联系人 *', eContactName, setEContactName, 'text', true],
              ['联系邮箱', eContactEmail, setEContactEmail, 'email', false],
              ['联系电话', eContactPhone, setEContactPhone, 'text', false],
              ['危机联系人 *', eCrisisName, setECrisisName, 'text', true],
              ['危机电话 *', eCrisisPhone, setECrisisPhone, 'text', true],
            ] as [string, string, (v: string) => void, string, boolean][]).map(([label, val, setter, type, req]) => (
              <div key={label}>
                <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>{label}</label>
                <ImeInput type={type} value={val} onChange={e => setter(e.target.value)} required={req} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem', fontWeight: 500 }}>备注</label>
              <ImeTextarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            {editErr && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{editErr}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={updateClient.isPending} style={{ padding: '0.4rem 1rem', borderRadius: 5, background: '#4a4af0', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                {updateClient.isPending ? '保存中…' : '保存'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.4rem 0.85rem', borderRadius: 5, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}>
                取消
              </button>
            </div>
          </form>
        </section>
      ) : (
        /* Read-only client info card */
        <section style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            客户信息
          </p>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.45rem 1rem', fontSize: '0.875rem' }}>
            <dt style={{ color: '#888', fontWeight: 500 }}>联系人</dt>
            <dd style={{ margin: 0 }}>{client.contactName}</dd>
            <dt style={{ color: '#888', fontWeight: 500 }}>联系邮箱</dt>
            <dd style={{ margin: 0 }}>{client.contactEmail ?? '—'}</dd>
            <dt style={{ color: '#888', fontWeight: 500 }}>联系电话</dt>
            <dd style={{ margin: 0 }}>{client.contactPhone ?? '—'}</dd>
            <dt style={{ color: '#888', fontWeight: 500 }}>危机联系人</dt>
            <dd style={{ margin: 0, color: '#065f46', fontWeight: 500 }}>{client.crisisContactName}</dd>
            <dt style={{ color: '#888', fontWeight: 500 }}>危机电话</dt>
            <dd style={{ margin: 0 }}>{client.crisisContactPhone}</dd>
            {client.notes && (
              <>
                <dt style={{ color: '#888', fontWeight: 500 }}>备注</dt>
                <dd style={{ margin: 0, color: '#444', whiteSpace: 'pre-wrap' }}>{client.notes}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Related projects */}
      <section style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            关联项目
          </p>
          <a href={`/workbench/projects/new?clientId=${clientId}`} style={{ padding: '0.3rem 0.7rem', borderRadius: 5, background: '#4a4af0', color: '#fff', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
            + 新建项目
          </a>
        </div>
        {loadingProjects ? (
          <p style={{ margin: 0, color: '#888', fontSize: '0.875rem' }}>加载中…</p>
        ) : projects.length === 0 ? (
          <p style={{ margin: 0, color: '#888', fontSize: '0.875rem' }}>暂无关联项目。</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem 0.5rem 0', color: '#555', fontWeight: 600 }}>项目名称</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: '#555', fontWeight: 600 }}>状态</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', color: '#555', fontWeight: 600 }}>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < projects.length - 1 ? '1px solid #f5f5fa' : 'none' }}>
                  <td style={{ padding: '0.55rem 0.5rem 0.55rem 0' }}>
                    <a href={`/workbench/projects/${p.id}`} style={{ color: '#4a4af0', textDecoration: 'none', fontWeight: 500 }}>{p.title}</a>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: 20, background: STATE_COLOR[p.state] + '22', color: STATE_COLOR[p.state], fontWeight: 600 }}>
                      {STATE_ZH[p.state]}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', color: '#888', fontSize: '0.8rem' }}>
                    {new Date(p.updatedAt).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Portal tokens */}
      <section style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          客户门户 Token
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#555', whiteSpace: 'nowrap' }}>到期日：</label>
          <input type="date" value={expiryDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiryDate(e.target.value)} style={{ padding: '0.35rem 0.6rem', border: '1px solid #ddd', borderRadius: 5, fontSize: '0.875rem' }} />
          <button onClick={handleIssue} disabled={issueToken.isPending} style={{ padding: '0.35rem 0.85rem', borderRadius: 5, background: '#4a4af0', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            {issueToken.isPending ? '颁发中…' : '颁发 Token'}
          </button>
        </div>
        {loadingTokens ? (
          <p style={{ color: '#888', fontSize: '0.875rem' }}>加载中…</p>
        ) : tokens.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.875rem', margin: 0 }}>暂无有效 Token。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tokens.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8f8fc', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#555' }}>到期：</span>
                  <span style={{ fontWeight: 500 }}>{new Date(t.expiresAt).toLocaleDateString('zh-CN')}</span>
                  {t.lastUsedAt && <span style={{ marginLeft: '0.75rem', color: '#888' }}>最近使用：{new Date(t.lastUsedAt).toLocaleString('zh-CN')}</span>}
                </div>
                <button onClick={() => handleCopy(t.token)} style={{ padding: '0.25rem 0.6rem', borderRadius: 4, border: '1px solid #c7c7f0', background: copied === t.token ? '#e8f8e8' : '#fff', color: copied === t.token ? '#065f46' : '#4a4af0', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {copied === t.token ? '已复制 ✓' : '复制链接'}
                </button>
                <button onClick={() => revokeToken.mutate({ tokenId: t.id })} disabled={revokeToken.isPending} style={{ padding: '0.25rem 0.6rem', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  撤销
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ marginTop: '1.25rem' }}>
        <EventTimeline events={clientEvts} />
      </div>
    </div>
  );
}
