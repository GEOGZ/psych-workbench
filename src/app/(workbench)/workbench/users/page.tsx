'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

const ROLE_ZH: Record<string, string> = {
  owner: '所有者', admin: '管理员', contractor: '协作者',
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

/** Compact "⋯" dropdown for per-row actions */
function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: '0.3rem 0.55rem', borderRadius: 5, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: '#555' }}>
        ⋯
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #eee', minWidth: 160, zIndex: 200, padding: '0.35rem 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.9rem', border: 'none', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.82rem', color: danger ? '#dc2626' : '#333', opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  );
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
  const setPasswordMut   = trpc.auth.setUserPassword.useMutation({ onSuccess: () => { setSetPwId(null); setSetPwValue(''); } });
  const resetPasswordMut = trpc.auth.resetPassword.useMutation({ onSuccess: () => refetch() });

  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteName,   setInviteName]   = useState('');
  const [role,         setRole]         = useState<'owner' | 'admin' | 'contractor'>('contractor');
  const [inviteNotice, setInviteNotice] = useState<{ action: 'created' | 'updated'; email: string } | null>(null);
  const [error,        setError]        = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const [setPwId,    setSetPwId]    = useState<string | null>(null);
  const [setPwValue, setSetPwValue] = useState('');

  const inp: React.CSSProperties = {
    border: '1px solid #ddd', borderRadius: 5, padding: '0.4rem 0.6rem',
    fontSize: '0.875rem', boxSizing: 'border-box',
  };

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInviteNotice(null);
    inviteMut.mutate({ email: inviteEmail.trim(), role, name: inviteName.trim() || undefined }, {
      onSuccess: (res) => {
        if (res.user) setInviteNotice({ action: res.action, email: res.user.email });
        setInviteEmail(''); setInviteName(''); setRole('contractor');
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>用户管理</h1>

      {/* ── Invite form ── */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          邀请 / 预设用户
        </p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>姓名 *</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} required placeholder="张三" style={{ ...inp, width: '100%' }} />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>邮箱 *</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="user@example.com" style={{ ...inp, width: '100%' }} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '0.2rem' }}>角色</label>
            <select value={role} onChange={e => setRole(e.target.value as typeof role)} style={inp}>
              <option value="contractor">协作者</option>
              <option value="admin">管理员</option>
              <option value="owner">所有者</option>
            </select>
          </div>
          <button type="submit" disabled={inviteMut.isPending}
            style={{ padding: '0.4rem 1.25rem', borderRadius: 5, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: inviteMut.isPending ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {inviteMut.isPending ? '处理中…' : '确认'}
          </button>
        </form>
        {inviteNotice && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#15803d', background: '#dcfce7', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
            {inviteNotice.action === 'created' ? `已创建用户 ${inviteNotice.email}，首次使用魔法链接登录后生效。` : `已更新 ${inviteNotice.email} 的信息。`}
          </p>
        )}
        {error && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
      </div>

      {/* ── Users table ── */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#f5f5fa' }}>
              {['姓名', '邮箱', '角色', '上次登录', '创建时间', '操作'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.65rem 0.85rem', fontWeight: 600, color: '#555', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '1.5rem', color: '#aaa', textAlign: 'center' }}>暂无用户</td></tr>
            )}
            {paged.map((u, i) => {
              const rc = ROLE_COLOR[u.role] ?? { bg: '#f3f4f6', color: '#374151' };
              const isEditing = editingId === u.id;
              return (
                <tr key={u.id} style={{ borderTop: i === 0 ? undefined : '1px solid #f0f0f5' }}>

                  {/* 姓名 */}
                  <td style={{ padding: '0.65rem 0.85rem', minWidth: 90 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                          style={{ ...inp, width: 88, padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                          onKeyDown={e => { if (e.key === 'Enter') updateProfileMut.mutate({ userId: u.id, name: editName.trim() }); if (e.key === 'Escape') setEditingId(null); }} />
                        <button onClick={() => updateProfileMut.mutate({ userId: u.id, name: editName.trim() })} disabled={updateProfileMut.isPending || !editName.trim()}
                          style={{ padding: '0.25rem 0.4rem', borderRadius: 4, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                        <button onClick={() => setEditingId(null)}
                          style={{ padding: '0.25rem 0.4rem', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                      </div>
                    ) : (
                      <span onClick={() => { setEditingId(u.id); setEditName(u.name ?? ''); }} title="点击编辑姓名"
                        style={{ cursor: 'pointer', borderBottom: '1px dashed #ccc', paddingBottom: 1, color: u.name ? '#333' : '#bbb' }}>
                        {u.name ?? '未填写'}
                      </span>
                    )}
                  </td>

                  {/* 邮箱 */}
                  <td style={{ padding: '0.65rem 0.85rem', color: '#555', fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                  </td>

                  {/* 角色 badge */}
                  <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.73rem', padding: '0.18rem 0.55rem', borderRadius: 20, background: rc.bg, color: rc.color, fontWeight: 600 }}>
                      {ROLE_ZH[u.role] ?? u.role}
                    </span>
                  </td>

                  {/* 上次登录 */}
                  <td style={{ padding: '0.65rem 0.85rem', color: '#888', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(u.lastLoginAt)}</td>

                  {/* 创建时间 */}
                  <td style={{ padding: '0.65rem 0.85rem', color: '#aaa', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>

                  {/* 操作：角色下拉 + ⋯ 菜单 */}
                  <td style={{ padding: '0.5rem 0.85rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select defaultValue={u.role}
                        onChange={e => { const r = e.target.value as 'owner'|'admin'|'contractor'; if (r !== u.role) setRoleMut.mutate({ userId: u.id, role: r }); }}
                        style={{ ...inp, fontSize: '0.78rem', padding: '0.25rem 0.4rem' }}>
                        <option value="contractor">协作者</option>
                        <option value="admin">管理员</option>
                        <option value="owner">所有者</option>
                      </select>

                      <ActionMenu>
                        {/* 设置密码 */}
                        {setPwId === u.id ? (
                          <div style={{ padding: '0.45rem 0.9rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <input type="password" value={setPwValue} onChange={e => setSetPwValue(e.target.value)}
                              placeholder="新密码" autoFocus
                              style={{ ...inp, width: 110, padding: '0.25rem 0.4rem', fontSize: '0.78rem' }}
                              onKeyDown={e => { if (e.key === 'Escape') { setSetPwId(null); setSetPwValue(''); } }} />
                            <button onClick={() => setPasswordMut.mutate({ userId: u.id, newPassword: setPwValue })}
                              disabled={setPasswordMut.isPending || !setPwValue}
                              style={{ padding: '0.25rem 0.4rem', borderRadius: 4, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                            <button onClick={() => { setSetPwId(null); setSetPwValue(''); }}
                              style={{ padding: '0.25rem 0.4rem', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                          </div>
                        ) : (
                          <MenuItem label="设置密码" onClick={() => { setSetPwId(u.id); setSetPwValue(''); }} />
                        )}
                        <MenuItem label="重置密码（强制改密）" onClick={() => resetPasswordMut.mutate({ userId: u.id })} disabled={resetPasswordMut.isPending} />
                        <div style={{ borderTop: '1px solid #f0f0f0', margin: '0.2rem 0' }} />
                        {confirmDeleteId === u.id ? (
                          <div style={{ padding: '0.45rem 0.9rem', display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => deleteMut.mutate({ userId: u.id }, { onSuccess: () => setConfirmDeleteId(null) })} disabled={deleteMut.isPending}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>确认删除</button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, background: '#fff', color: '#555', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.75rem' }}>取消</button>
                          </div>
                        ) : (
                          <MenuItem label="删除用户" onClick={() => setConfirmDeleteId(u.id)} danger />
                        )}
                      </ActionMenu>
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
