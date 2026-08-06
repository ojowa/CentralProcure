import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/profile-management');

export default function Page() {
  redirect('/vendors/dashboard/profile-management');
}
