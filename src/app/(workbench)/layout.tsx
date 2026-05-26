import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth/options';
import { GlobalSearch } from '@/components/GlobalSearch';

export default async function WorkbenchLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if ((session.user as any).mustChangePassword) redirect('/change-password');

  const role = (session.user as { role?: string }).role;
  const isContractor = role === 'contractor';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ background: '#1a1a2e', color: '#e8e8f0', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.02em' }}>工作台</span>
        {isContractor ? (
          <a href="/workbench/contractor" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>我的项目</a>
        ) : (
          <>
            <a href="/workbench" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>首页</a>
            <a href="/workbench/projects" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>项目</a>
            <a href="/workbench/clients" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>客户</a>
            <a href="/workbench/job-profiles" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>岗位画像</a>
            <a href="/workbench/assessment-tools" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>测评工具</a>
            <a href="/workbench/reports" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>报表</a>
            {role === 'owner' && (
              <a href="/workbench/users" style={{ color: '#a0a0c0', textDecoration: 'none', fontSize: '0.875rem' }}>用户</a>
            )}
            <GlobalSearch />
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6060a0' }}>
          {(session.user as { email?: string }).email}
        </span>
      </nav>
      <main style={{ flex: 1, padding: '1.5rem', background: '#f5f5fa' }}>
        {children}
      </main>
    </div>
  );
}
