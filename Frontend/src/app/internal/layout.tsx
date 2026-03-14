import type { Metadata } from 'next';
import { AuthProvider } from '../../internal/hooks/useAuth';

export const metadata: Metadata = {
  title: 'NIS ePROCUREMENT',
  description: 'NIS internal procurement frontend'
};

export default function InternalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
