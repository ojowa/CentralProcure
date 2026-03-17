import type { Metadata } from 'next';
import './globals.css';
import './login.css';
import './portal.css';
import { metadataBase } from './seo';
import { CsrfFetchBootstrap } from './CsrfFetchBootstrap';

export const metadata: Metadata = {
  metadataBase,
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
      <body suppressHydrationWarning>
        <CsrfFetchBootstrap />
        {children}
      </body>
    </html>
  );
}
