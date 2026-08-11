import type { Metadata } from 'next';
import { Inter, Poppins, Outfit } from 'next/font/google';
import './globals.css';
import './login.css';
import './portal.css';
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
