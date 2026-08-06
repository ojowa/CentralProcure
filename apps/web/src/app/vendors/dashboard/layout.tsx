import type { ReactNode } from 'react';
import DashboardGuard from '../../../vendors/components/DashboardGuard';
import VendorDashboardLayout from '../../../vendors/layouts/VendorDashboardLayout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <VendorDashboardLayout>{children}</VendorDashboardLayout>
    </DashboardGuard>
  );
}

