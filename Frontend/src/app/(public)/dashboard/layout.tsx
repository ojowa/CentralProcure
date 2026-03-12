import type { ReactNode } from 'react';
import DashboardGuard from '../../../public/components/DashboardGuard';
import VendorDashboardPage from '../../../public/views/VendorDashboardPage';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <VendorDashboardPage>{children}</VendorDashboardPage>
    </DashboardGuard>
  );
}

