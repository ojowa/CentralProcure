import type { Metadata } from 'next';
import App from '../../../../internal/App';
import { createCanonicalMetadata } from '../../../seo';

export async function generateMetadata({
  params
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module } = await params;
  return createCanonicalMetadata(`/internal/dashboard/${module}`);
}

export default function InternalDashboardModulePage() {
  return <App />;
}
