export default function PortalExpiredPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5fa', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#333' }}>
          链接已失效
        </h1>
        <p style={{ color: '#888', fontSize: '0.875rem', lineHeight: 1.6 }}>
          这个访问链接已过期或已被撤销。<br />
          请联系您的顾问重新发送访问链接。
        </p>
      </div>
    </div>
  );
}
