import type { Metadata } from 'next';
import LoginPage from '../../../internal/views/LoginPage';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/internal/login');

export default function Page() {
  return <LoginPage />;
}
