import type { Metadata } from 'next';
import BidSubmissionPage from '../../../../vendors/features/bid/pages/BidSubmissionPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: Promise<{ tenderId: string }>;
}): Promise<Metadata> {
  return params.then(({ tenderId }) => createCanonicalMetadata(`/bid-submission/${tenderId}`));
}

export default function Page() {
  return <BidSubmissionPage />;
}

