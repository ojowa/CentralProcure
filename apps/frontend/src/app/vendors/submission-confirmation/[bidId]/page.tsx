import type { Metadata } from 'next';
import SubmissionConfirmationPage from '../../../../vendors/features/bid/pages/SubmissionConfirmationPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: Promise<{ bidId: string }>;
}): Promise<Metadata> {
  return params.then(({ bidId }) => createCanonicalMetadata(`/submission-confirmation/${bidId}`));
}

export default function Page() {
  return <SubmissionConfirmationPage />;
}

