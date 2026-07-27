import type { Metadata } from 'next';
import TenderPublicPage from '../../../../vendors/features/tender/pages/TenderPublicPage';
import { createCanonicalMetadata } from '../../../seo';

export function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return params.then(({ id }) => createCanonicalMetadata(`/tenders/${id}`));
}

export default function Page() {
  return <TenderPublicPage />;
}
