import type { Metadata } from 'next';
import VendorHomePage from '../../vendors/views/VendorHomePage';
import { createCanonicalMetadata } from '../seo';

export const metadata: Metadata = createCanonicalMetadata('/vendors');

export default function Page() {
  return <VendorHomePage />;
}

