import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/profile-management');

export default function Page() {
  permanentRedirect('/vendors/dashboard/profile-management');
}
