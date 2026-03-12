import type { Metadata } from 'next';
import './globals.css';
import './login.css';
import './portal.css';

export const metadata: Metadata = {
  title: 'CentralProcure',
  description: 'NIS procurement portals'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
