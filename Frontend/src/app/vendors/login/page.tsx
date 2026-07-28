import type { Metadata } from 'next';
import LoginPage from '../../../vendors/features/auth/pages/LoginPage';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/vendors/login');

export default function Page() {
  return <LoginPage />;
}

