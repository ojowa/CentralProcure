 'use client';

import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

const Footer: React.FC = () => {
  const { isAuthenticated, isReady } = useAuth();
  const vendorLoginHref = isReady && isAuthenticated ? '/dashboard' : '/login';

  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">NIS Procurement</h3>
          <p className="mt-3 text-sm text-slate-300">
            Official portal for public procurement notices, vendor onboarding, and bid submissions.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Quick Links</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/tenders" className="hover:text-white">Open Tenders</Link>
            <Link href="/register" className="hover:text-white">Vendor Registration</Link>
            <Link href={vendorLoginHref} className="hover:text-white">Vendor Login</Link>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Contact Desk</h3>
          <p className="mt-3 text-sm text-slate-300">procurement@immigration.gov.ng</p>
          <p className="mt-1 text-sm text-slate-300">+234 (0) 700 2255 6466</p>
        </div>
      </div>
      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
        &copy; {new Date().getFullYear()} Nigeria Immigration Service. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
