'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

type Tab = 'password' | 'magic' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('password');

  // Password login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Magic-link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation();

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', { email: email.trim(), password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('邮箱或密码不正确，或该账号尚未设置密码');
    } else {
      router.push('/workbench');
      router.refresh();
    }
  }

  async function handleMagicLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('email', { email: magicEmail.trim(), redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('发送失败，请检查邮箱地址');
    } else {
      setMagicSent(true);
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestReset.mutateAsync({ email: resetEmail.trim() });
      setResetSent(true);
    } catch {
      setError('发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #ddd', borderRadius: 6, padding: '0.5rem 0.75rem',
    fontSize: '0.95rem', width: '100%', boxSizing: 'border-box',
  };
  const btnPrimary: React.CSSProperties = {
    padding: '0.55rem 1rem', borderRadius: 6, border: 'none',
    background: '#4a4af0', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: '0.95rem', fontWeight: 600, width: '100%', opacity: loading ? 0.6 : 1,
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: active ? 700 : 400,
    color: active ? '#4a4af0' : '#888',
    borderBottom: active ? '2px solid #4a4af0' : '2px solid transparent',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5fa' }}>
      <div style={{ width: 360, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>
          心理咨询工作台
        </h1>

        {/* Tabs — only password and magic, reset is a sub-state */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: '1.25rem' }}>
          <button style={tabBtn(tab === 'password')} onClick={() => switchTab('password')}>密码登录</button>
          <button style={tabBtn(tab === 'magic')} onClick={() => switchTab('magic')}>魔法链接</button>
        </div>

        {/* ── Password login ── */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>邮箱</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>密码</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? '登录中…' : '登录'}</button>
            <button type="button" onClick={() => { switchTab('reset'); setResetEmail(email); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#888', textAlign: 'center', padding: '0.1rem', textDecoration: 'underline' }}>
              忘记密码？
            </button>
          </form>
        )}

        {/* ── Magic-link login ── */}
        {tab === 'magic' && !magicSent && (
          <form onSubmit={handleMagicLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
              输入邮箱，系统发送一次性登录链接（10 分钟有效），无需密码即可登录。
            </p>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>邮箱</label>
              <input type="email" value={magicEmail} onChange={e => setMagicEmail(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? '发送中…' : '发送登录链接'}</button>
          </form>
        )}
        {tab === 'magic' && magicSent && (
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: '#15803d' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>✉️</p>
            <p style={{ margin: '0 0 1rem' }}>登录链接已发送至 <strong>{magicEmail}</strong>，请查收邮件。</p>
            <button type="button" onClick={() => setMagicSent(false)}
              style={{ fontSize: '0.8rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              重新发送
            </button>
          </div>
        )}

        {/* ── Reset password ── */}
        {tab === 'reset' && !resetSent && (
          <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
              输入账号邮箱，系统将发送邮件引导您通过魔法链接登录后设置新密码。
            </p>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>邮箱</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? '发送中…' : '发送重置邮件'}</button>
            <button type="button" onClick={() => switchTab('password')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#888', textAlign: 'center', padding: '0.1rem', textDecoration: 'underline' }}>
              返回密码登录
            </button>
          </form>
        )}
        {tab === 'reset' && resetSent && (
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: '#15803d' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>✉️</p>
            <p style={{ margin: '0 0 1rem' }}>重置邮件已发送至 <strong>{resetEmail}</strong>，请查收并按提示操作。</p>
            <button type="button" onClick={() => switchTab('magic')}
              style={{ fontSize: '0.8rem', color: '#4a4af0', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              前往魔法链接登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
