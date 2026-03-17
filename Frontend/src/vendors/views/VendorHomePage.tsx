 'use client';

import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

const VendorHomePage: React.FC = () => {
  const { isAuthenticated, isReady } = useAuth();
  const vendorLoginHref = isReady && isAuthenticated ? '/dashboard' : '/login';

  const quickActions = [
    { title: 'Open Tenders', description: 'Browse active procurement opportunities.', to: '/tenders' },
    { title: 'Vendor Login', description: 'Access vendor dashboard and submissions.', to: vendorLoginHref },
    { title: 'Create Account', description: 'Register your organization for bidding.', to: '/register' }
  ];

  const notices = [
    { title: 'Mandatory compliance documents update window', date: 'Feb 10, 2026' },
    { title: 'Clarification addendum published for ICT equipment lots', date: 'Feb 7, 2026' },
    { title: 'Bid opening timetable for Q1 infrastructure tenders', date: 'Feb 3, 2026' }
  ];

  return (
    <div className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white">
        <div className="absolute -left-24 -top-16 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-emerald-100">
            NIGERIA IMMIGRATION SERVICE PROCUREMENT PORTAL
          </div>
          <h1 className="max-w-4xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Transparent Public Procurement for National Service Delivery
          </h1>
          <p className="mt-5 max-w-3xl text-base text-slate-200 sm:text-lg">
            Participate in open bidding, track procurement notices, and manage vendor submissions through a secure,
            accountable digital process.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/tenders"
              className="rounded-md bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              View Open Tenders
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Register as Vendor
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((item) => (
            <Link
              key={item.title}
              href={item.to}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Procurement Notices</h3>
              <Link href="/tenders" className="text-sm font-semibold text-teal-700 hover:underline">
                See all notices
              </Link>
            </div>
            <ul className="mt-5 divide-y divide-slate-100">
              {notices.map((notice) => (
                <li key={notice.title} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-slate-800">{notice.title}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{notice.date}</span>
                </li>
              ))}
            </ul>
          </article>

          <aside className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-emerald-900">Service Highlights</h3>
            <ul className="mt-4 space-y-3 text-sm text-emerald-900">
              <li className="rounded-md bg-white/80 px-3 py-2">Real-time tender publication and updates</li>
              <li className="rounded-md bg-white/80 px-3 py-2">Structured vendor registration workflow</li>
              <li className="rounded-md bg-white/80 px-3 py-2">Secure bid submission and confirmation trail</li>
            </ul>
            <Link
              href={vendorLoginHref}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Vendor Access
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default VendorHomePage;
