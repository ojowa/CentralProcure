import type { ReactNode } from 'react';
import RouteGuard from '../../../vendors/components/RouteGuard';

export default function SubmissionConfirmationLayout({ children }: { children: ReactNode }) {
  return <RouteGuard redirect={false}>{children}</RouteGuard>;
}
