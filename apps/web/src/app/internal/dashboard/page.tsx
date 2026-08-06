import type { Metadata } from 'next';
import { InternalDashboardHome } from '../../../internal/components/shell/InternalDashboardHome';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/internal/dashboard');

export default function InternalDashboardPage() {
  return <InternalDashboardHome />;
}