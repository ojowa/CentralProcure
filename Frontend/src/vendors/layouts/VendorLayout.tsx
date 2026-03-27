'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';

const VendorLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/vendors/dashboard') || pathname?.startsWith('/dashboard');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">{children}</main>
      {!isDashboard && <Footer />}
    </div>
  );
};

export default VendorLayout;
