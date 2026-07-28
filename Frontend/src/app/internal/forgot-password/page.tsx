import type { Metadata } from 'next';
import ForgotPasswordPage from '../../../internal/views/ForgotPasswordPage';
import { createCanonicalMetadata } from '../../seo';

export const metadata: Metadata = createCanonicalMetadata('/internal/forgot-password');

export default function Page() {
  return <ForgotPasswordPage />;
}
