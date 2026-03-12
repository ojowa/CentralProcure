import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PublicLayout from '../../public/layouts/PublicLayout';
import PublicProviders from '../../public/providers';

export const metadata: Metadata = {
  title: ' NIS ePROCUREMENT',
  description: 'NIS public procurement frontend'
};

export default function PublicRoutesLayout({ children }: { children: ReactNode }) {
  return (
    <PublicProviders>
      <PublicLayout>{children}</PublicLayout>
    </PublicProviders>
  );
}

