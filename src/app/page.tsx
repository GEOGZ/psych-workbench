export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f8f8fc',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Nav */}
      <nav style={{
        padding: '1.25rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        borderBottom: '1px solid #eee',
      }}>
        <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1a1a2e', letterSpacing: '0.02em' }}>
          WisePsy
        </span>
        <a
          href="https://admin.wisepsy.cn/login"
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 6,
            border: '1px solid #4a4af0',
            color: '#4a4af0',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          运营系统登录
        </a>
      </nav>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#4a4af0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          心理测评 · 顾问团队专属工具
        </p>
        <h1 style={{
          margin: '0 0 1.25rem',
          fontSize: 'clamp(2rem, 5vw, 3.25rem)',
          fontWeight: 800,
          color: '#1a1a2e',
          lineHeight: 1.2,
          maxWidth: 640,
        }}>
          科学评估，驱动人才<br />决策更有依据
        </h1>
        <p style={{
          margin: '0 0 2.5rem',
          fontSize: '1.05rem',
          color: '#666',
          lineHeight: 1.7,
          maxWidth: 480,
        }}>
          WisePsy 为心理咨询顾问团队提供从客户开发到报告交付的全流程管理，
          让每个项目有据可查、每个阶段清晰可见。
        </p>
        <a
          href="https://admin.wisepsy.cn/login"
          style={{
            display: 'inline-block',
            padding: '0.8rem 2rem',
            borderRadius: 8,
            background: '#4a4af0',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(74,74,240,0.35)',
          }}
        >
          进入运营系统 →
        </a>
        <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#aaa' }}>
          仅限受邀团队成员使用
        </p>
      </main>

      {/* Feature strip */}
      <section style={{
        background: '#fff',
        borderTop: '1px solid #eee',
        padding: '2.5rem 2rem',
        display: 'flex',
        justifyContent: 'center',
        gap: '3rem',
        flexWrap: 'wrap',
      }}>
        {[
          { icon: '📋', title: '项目全程管理', desc: '从准入到收尾 8 阶段闭环' },
          { icon: '📊', title: '数据实时看板', desc: '收入、NPS、待收款一目了然' },
          { icon: '🔐', title: '客户专属门户', desc: 'Token 隔离，客户安全查看进展' },
          { icon: '📁', title: '报告统一管理', desc: 'PDF/Word 上传、门户可控可见' },
        ].map(f => (
          <div key={f.title} style={{ textAlign: 'center', minWidth: 140, maxWidth: 180 }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' }}>{f.title}</div>
            <div style={{ fontSize: '0.78rem', color: '#888' }}>{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        padding: '1.25rem 2rem',
        background: '#1a1a2e',
        color: '#6060a0',
        fontSize: '0.78rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span>© 2026 WisePsy · www.wisepsy.cn</span>
        <a href="https://admin.wisepsy.cn/login" style={{ color: '#8080c0', textDecoration: 'none' }}>
          运营系统登录
        </a>
      </footer>
    </div>
  );
}
