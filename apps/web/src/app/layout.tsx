import type { Metadata } from 'next';
import { Inter, Poppins, Outfit } from 'next/font/google';
import './globals.css';
import './login.css';
import './portal-base.css';
import './portal-shell.css';
import './portal-dashboard.css';
import './requisitions.css';
import './budget.css';
import './app-module.css';
import './app-modal.css';
import './routing-timeline.css';
import './audit-threshold.css';
import './audit-trail-v2.css';
import './permissions-panel.css';
import './user-role-management.css';
import './portal-responsive.css';
import { metadataBase } from './seo';
import { CsrfFetchBootstrap } from './CsrfFetchBootstrap';

// Font configurations - pick one or combine
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase,
  title: 'eProcurement',
  description: 'NIS procurement portals'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${outfit.variable} font-sans`} suppressHydrationWarning>
        <CsrfFetchBootstrap />
        {children}
      </body>
    </html>
  );
}
