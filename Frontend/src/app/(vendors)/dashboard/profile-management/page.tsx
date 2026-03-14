import type { Metadata } from 'next';
import ProfileManagementPage from '../../../../vendors/features/vendor/pages/ProfileManagement';
import { createCanonicalMetadata } from '../../../seo';

export const metadata: Metadata = createCanonicalMetadata('/dashboard/profile-management');

export default function Page() {
  return <ProfileManagementPage />;
}

