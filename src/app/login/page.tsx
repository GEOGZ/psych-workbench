'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('邮箱或密码不正确，或该账号尚未设置密码（请使用魔法链接登录）');
    } else {
      router.push('/workbench');
      router.refresh();
    }
  }

  async function handleMagicLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('email', {
      email: magicEmail.trim(),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('发送失败，请检查邮箱地址');
    } else {
      setMagicSent(true);
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #ddd', borderRadius: 6, padding: '0.5rem 0.75rem',
    fontSize: '0.95rem', width: '100%', boxSizing: 'border-box',
  };
  const btnStyle: React.CSSProperties = {
    padding: '0.55rem 1rem', borderRadius: 6, border: 'none',
    background: '#4a4af0', color: '#fff', cursor: 'pointer',
    fontSize: '0.95rem', fontWeight: 600, width: '100%',
    opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5fa' }}>
      <div style={{ width: 360, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
        <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>
          心理咨询工作台
        </h1>

        <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: '1.25rem' }}>
          {(['password', 'magic'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{ flex: 1, padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: tab === t ? 700 : 400,
                color: tab === t ? '#4a4af0' : '#888',
                borderBottom: tab === t ? '2px solid #4a4af0' : '2px solid transparent' }}>
              {t === 'password' ? '密码登录' : '魔法链接（备用）'}
            </button>
          ))}
        </div>

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
            <button type="submit" disabled={loading} style={btnStyle}>{loading ? '登录中…' : '登录'}</button>
          </form>
        )}

        {tab === 'magic' && !magicSent && (
          <form onSubmit={handleMagicLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>输入邮箱，系统将发送一次性登录链接（10 分钟有效）。</p>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>邮箱</label>
              <input type="email" value={magicEmail} onChange={e => setMagicEmail(e.target.value)} required style={inputStyle} autoFocus />
            </div>
            {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#c00', background: '#fff0f0', padding: '0.4rem 0.6rem', borderRadius: 4 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>{loading ? '发送中…' : '发送登录链接'}</button>
          </form>
        )}

        {tab === 'magic' && magicSent && (
          <div style={{ textAlign: 'center', color: '#15803d', fontSize: '0.9rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>✉️</p>
            <p style={{ margin: 0 }}>登录链接已发送至 <strong>{magicEmail}</strong>，请查收邮件。</p>
          </div>
        )}
      </div>
    </div>
  );
}
