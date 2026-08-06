'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const Header: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isReady, hasSessionAttempted, logout } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !isAuthenticated) {
      setDisplayName(null);
      return;
    }

    const company = localStorage.getItem('vendorCompanyName');
    const email = localStorage.getItem('vendorEmail');
    setDisplayName(company || email || 'Vendor');
  }, [isAuthenticated, isReady]);

  const handleLogout = () => {
    logout();
    router.push('/vendors/login');
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs sm:px-6 lg:px-8">
          <p className="font-medium tracking-wide">Federal Republic of Nigeria</p>
          <p className="hidden sm:block">Nigeria Immigration Service e-Procurement Portal</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/vendors" className="flex items-center gap-3">
            <Image
              src="/nis-logo.svg"
              alt="NIS Logo"
              width={44}
              height={44}
              unoptimized
              className="h-11 w-11 rounded-md border border-slate-200 bg-white p-1"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">NIS e-Procurement</p>
              <p className="text-xs text-slate-500">Transparent Tender Administration Platform</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
            <Link href="/vendors" className="rounded-md px-3 py-2 transition hover:bg-slate-100">
              Home
            </Link>
            <Link href="/vendors/tenders" className="rounded-md px-3 py-2 transition hover:bg-slate-100">
              Tender Listings
            </Link>
            {isReady && hasSessionAttempted && isAuthenticated ? (
              <>
                <Link href="/vendors/dashboard" className="rounded-md border border-slate-300 px-3 py-2 transition hover:bg-slate-50">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-white transition hover:bg-emerald-800"
                >
                  Logout
                </button>
                {displayName && (
                  <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline">
                    {displayName}
                  </span>
                )}
              </>
            ) : (
              <>
                <Link href="/vendors/login" className="rounded-md border border-slate-300 px-3 py-2 transition hover:bg-slate-50">
                  Login
                </Link>
                <Link href="/vendors/register" className="rounded-md bg-emerald-700 px-4 py-2 text-white transition hover:bg-emerald-800">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
