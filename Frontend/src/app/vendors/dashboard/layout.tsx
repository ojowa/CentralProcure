import type { ReactNode } from 'react';
import DashboardGuard from '../../../vendors/components/DashboardGuard';
import VendorDashboardPage from '../../../vendors/views/VendorDashboardPage';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <VendorDashboardPage>{children}</VendorDashboardPage>
    </DashboardGuard>
  );
}

