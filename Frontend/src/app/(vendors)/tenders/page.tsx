import type { Metadata } from 'next';
import TenderPublicPage from '../../../vendors/features/tender/pages/TenderPublicPage';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/tenders');

export default function Page() {
  return <TenderPublicPage />;
}

