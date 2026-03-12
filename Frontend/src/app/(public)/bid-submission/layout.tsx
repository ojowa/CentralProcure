import type { ReactNode } from 'react';
import RouteGuard from '../../../public/components/RouteGuard';

export default function BidSubmissionLayout({ children }: { children: ReactNode }) {
  return <RouteGuard redirect={false}>{children}</RouteGuard>;
}
