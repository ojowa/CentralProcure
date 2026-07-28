import type { Metadata } from 'next';
import App from '../../../internal/App';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/internal/dashboard');

export default function InternalDashboardPage() {
  return <App />;
}
