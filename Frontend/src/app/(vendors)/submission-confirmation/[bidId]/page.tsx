import type { Metadata } from 'next';
import SubmissionConfirmationPage from '../../../../vendors/features/bid/pages/SubmissionConfirmationPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: { bidId: string };
}): Metadata {
  return createCanonicalMetadata(`/submission-confirmation/${params.bidId}`);
}

export default function Page() {
  return <SubmissionConfirmationPage />;
}

