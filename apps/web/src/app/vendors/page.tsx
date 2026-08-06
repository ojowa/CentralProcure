import type { Metadata } from 'next';
import VendorHomePage from '../../vendors/pages/VendorHomePage';
import { createCanonicalMetadata } from '../seo';

export const metadata: Metadata = createCanonicalMetadata('/vendors');

export default function Page() {
  return <VendorHomePage />;
}

