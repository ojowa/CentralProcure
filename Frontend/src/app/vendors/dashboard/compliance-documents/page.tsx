import type { Metadata } from 'next';
import ComplianceDocumentsPage from '../../../../vendors/features/vendor/pages/ComplianceDocuments';
import { createCanonicalMetadata } from '../../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/compliance-documents');

export default function Page() {
  return (
    <ComplianceDocumentsPage />
  );
}

