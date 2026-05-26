'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => router.push('/workbench'), 1500);
    },
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPw !== confirmPw) { setError('两次输入的密码不一致'); return; }
    changePassword.mutate({ newPassword: newPw });
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #ddd', borderRadius: 6, padding: '0.5rem 0.75rem',
    fontSize: '0.95rem', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5fa' }}>
      <div style={{ width: 360, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' }}>设置新密码</h1>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: '#888' }}>
          首次登录须设置密码。密码至少8位，须含大小写字母、数字和特殊字符。
        </p>
        {success ? (
          <p style={{ color: '#15803d', fontWeight: 600, textAlign: 'center' }}>✓ 密码已更新，正在跳转…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>新密码</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>确认密码</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required style={inputStyle} />
            </div>
            {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
            <button type="submit" disabled={changePassword.isPending}
              style={{ padding: '0.55rem 1rem', borderRadius: 6, border: 'none', background: '#4a4af0', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, opacity: changePassword.isPending ? 0.6 : 1 }}>
              {changePassword.isPending ? '保存中…' : '保存密码'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
