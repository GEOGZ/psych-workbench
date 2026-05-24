import { Providers } from './providers';

export const metadata = {
  title: 'Personal Workbench',
  description: 'Single-tenant workbench for psychological-assessment consulting'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
