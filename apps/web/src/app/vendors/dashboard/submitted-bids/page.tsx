import type { Metadata } from 'next';
import SubmittedBidsStatusPage from '../../../../vendors/features/bid/pages/SubmittedBidsStatusPage';
import { createCanonicalMetadata } from '../../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/submitted-bids');

export default function Page() {
  return <SubmittedBidsStatusPage />;
}

