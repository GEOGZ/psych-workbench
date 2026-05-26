'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const ROLE_ZH: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  contractor: '协作者',
};

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  owner:      { bg: '#ede9fe', color: '#6d28d9' },
  admin:      { bg: '#dbeafe', color: '#1d4ed8' },
  contractor: { bg: '#dcfce7', color: '#15803d' },
};

const PAGE_SIZE = 20;

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function UsersPage() {
  const { data: users = [], refetch } = trpc.users.list.useQuery();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paged = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inviteMut        = trpc.users.invite.useMutation({ onSuccess: () => refetch() });
  const setRoleMut       = trpc.users.setRole.useMutation({ onSuccess: () => refetch() });
  const updateProfileMut = trpc.users.updateProfile.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const deleteMut        = trpc.users.delete.useMutation({ onSuccess: () => refetch() });

  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteName,   setInviteName]   = useState('');
  const [role,         setRole]         = useState<'owner' | 'admin' | 'contractor'>('contractor');
  const [inviteNotice, setInviteNotice] = useState<{ action: 'created' | 'updated'; email: string } | null>(null);
  const [error,        setError]        = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');

  const inputStyle = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', boxSizing: 'border-box' as const,
  };

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviteNotice(null);
    inviteMut.mutate({ email: inviteEmail.trim(), role, name: inviteName.trim() || undefined }, {
      onSuccess: (res) => {
        if (res.user) setInviteNotice({ action: res.action, email: res.user.email });
        setInviteEmail('');
        setInviteName('');
        setRole('contractor');
      },
      onError: (err) => setError(err.message),
    });
  }

  function startEdit(u: { id: string; name?: string | null }) {
    setEditingId(u.id);
    setEditName(u.name ?? '');
  }

  function saveEdit(userId: string) {
    if (!editName.trim()) return;
    updateProfileMut.mutate({ userId, name: editName.trim() });
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>用户管理</h1>

      {/* Invite form */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          邀请 / 预设用户
        </p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>姓名 *</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} required placeholder="张三" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>邮箱 *</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="user@example.com" style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>角色</label>
            <select value={role} onChange={e => setRole(e.target.value as typeof role)} style={inputStyle}>
              <option value="contractor">协作者</option>
              <option value="admin">管理员</option>
              <option value="owner">所有者</option>
            </select>
          </div>
          <button type="submit" disabled={inviteMut.isPending} style={{ padding: '0.4rem 1rem', borderRadius: 5, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: inviteMut.isPending ? 0.6 : 1, whiteSpace: 'nowrap' as const }}>
            {inviteMut.isPending ? '处理中…' : '确认'}
          </button>
        </form>
        {inviteNotice && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#15803d', background: '#dcfce7', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
            {inviteNotice.action === 'created'
              ? `已创建用户 ${inviteNotice.email}，首次使用魔法链接登录后生效。`
              : `已更新 ${inviteNotice.email} 的信息。`}
          </div>
        )}
        {error && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</div>
        )}
      </div>

      {/* Users table */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f5f5fa' }}>
              <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555', fontSize: '0.8rem' }}>姓名</th>
              <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555', fontSize: '0.8rem' }}>邮箱</th>
              <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555', fontSize: '0.8rem' }}>角色</th>
              <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555', fontSize: '0.8rem' }}>上次登录</th>
              <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 600, color: '#555', fontSize: '0.8rem' }}>创建时间</th>
              <th style={{ padding: '0.6rem 1rem' }} />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '1rem', color: '#888', textAlign: 'center' }}>暂无用户。</td></tr>
            )}
            {paged.map((u, i) => {
              const rc = ROLE_COLOR[u.role] ?? { bg: '#f3f4f6', color: '#374151' };
              const isEditing = editingId === u.id;
              return (
                <tr key={u.id} style={{ borderTop: i === 0 ? undefined : '1px solid #f0f0f5' }}>
                  <td style={{ padding: '0.55rem 1rem', minWidth: 120 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          style={{ ...inputStyle, width: 100, padding: '0.25rem 0.4rem' }}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(u.id); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <button onClick={() => saveEdit(u.id)} disabled={updateProfileMut.isPending || !editName.trim()} style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                      </div>
                    ) : (
                      <span onClick={() => startEdit(u)} title="点击编辑姓名" style={{ cursor: 'pointer', borderBottom: '1px dashed #ccc', paddingBottom: 1, color: u.name ? '#333' : '#bbb' }}>
                        {u.name ?? '未填写'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: '#555', fontSize: '0.85rem' }}>{u.email}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 20, background: rc.bg, color: rc.color, fontWeight: 600 }}>
                      {ROLE_ZH[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: '#888', fontSize: '0.8rem' }}>{fmtDate(u.lastLoginAt)}</td>
                  <td style={{ padding: '0.65rem 1rem', color: '#aaa', fontSize: '0.8rem' }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select
                        defaultValue={u.role}
                        onChange={e => {
                          const newRole = e.target.value as 'owner' | 'admin' | 'contractor';
                          if (newRole !== u.role) setRoleMut.mutate({ userId: u.id, role: newRole });
                        }}
                        style={{ ...inputStyle, fontSize: '0.8rem' }}
                      >
                        <option value="contractor">协作者</option>
                        <option value="admin">管理员</option>
                        <option value="owner">所有者</option>
                      </select>
                      {confirmDeleteId === u.id ? (
                        <>
                          <button onClick={() => deleteMut.mutate({ userId: u.id }, { onSuccess: () => setConfirmDeleteId(null) })} disabled={deleteMut.isPending} style={{ padding: '0.3rem 0.5rem', borderRadius: 4, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>确认</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.3rem 0.5rem', borderRadius: 4, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.75rem' }}>取消</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(u.id)} style={{ padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>删除</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === 1 ? '#ccc' : '#4a4af0', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>上一页</button>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>第 {page} 页 / 共 {totalPages} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
            style={{ padding: '0.3rem 0.65rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', color: page === totalPages ? '#ccc' : '#4a4af0', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>下一页</button>
        </div>
      )}
    </div>
  );
}
