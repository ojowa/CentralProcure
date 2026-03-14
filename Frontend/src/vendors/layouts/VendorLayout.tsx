import type { ReactNode } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const VendorLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
};

export default VendorLayout;
