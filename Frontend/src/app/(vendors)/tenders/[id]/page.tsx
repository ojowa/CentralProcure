import type { Metadata } from 'next';
import TenderDetailsPage from '../../../../vendors/features/tender/pages/TenderDetailsPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: { id: string };
}): Metadata {
  return createCanonicalMetadata(`/tenders/${params.id}`);
}

export default function Page() {
  return <TenderDetailsPage />;
}

