import type { Metadata } from 'next';
import BidSubmissionPage from '../../../../vendors/features/bid/pages/BidSubmissionPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: { tenderId: string };
}): Metadata {
  return createCanonicalMetadata(`/bid-submission/${params.tenderId}`);
}

export default function Page() {
  return <BidSubmissionPage />;
}

