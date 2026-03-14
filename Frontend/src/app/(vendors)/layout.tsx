import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import VendorLayout from '../../vendors/layouts/VendorLayout';
import VendorProviders from '../../vendors/providers';

export const metadata: Metadata = {
  title: ' NIS ePROCUREMENT',
  description: 'NIS vendor procurement frontend'
};

export default function VendorRoutesLayout({ children }: { children: ReactNode }) {
  return (
    <VendorProviders>
      <VendorLayout>{children}</VendorLayout>
    </VendorProviders>
  );
}
