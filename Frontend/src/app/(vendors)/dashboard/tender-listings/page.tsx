import type { Metadata } from 'next';
import TenderListingsPage from '../../../../vendors/features/tender/pages/TenderListingsPage';
import { createCanonicalMetadata } from '../../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/tender-listings');

export default function Page() {
  return <TenderListingsPage />;
}

