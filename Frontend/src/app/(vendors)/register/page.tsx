import type { Metadata } from 'next';
import RegisterPage from '../../../vendors/features/auth/pages/RegisterPage';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/register');

export default function Page() {
  return <RegisterPage />;
}

