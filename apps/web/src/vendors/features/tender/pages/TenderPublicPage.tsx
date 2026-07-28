'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTenderDetails, getOpenTenders } from '../services/tenderService';
import { TenderDetails, TenderSummary } from '../types/tender';
import { useAuth } from '../../../hooks/useAuth';

const statusStyles: Record<string, string> = {
  Open: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Closed: 'bg-rose-100 text-rose-800 border-rose-200',
  'Under Evaluation': 'bg-amber-100 text-amber-800 border-amber-200',
  Awarded: 'bg-blue-100 text-blue-800 border-blue-200',
  Cancelled: 'bg-slate-200 text-slate-700 border-slate-300',
  Draft: 'bg-slate-100 text-slate-600 border-slate-300'
};

const categoryStyles: Record<string, string> = {
  Goods: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Works: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Services: 'bg-purple-50 text-purple-700 border-purple-200'
};

const TenderPublicPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
  const tenderId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [view, setView] = useState<'detail' | 'list'>(tenderId ? 'detail' : 'list');
  const [tender, setTender] = useState<TenderDetails | null>(null);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);

  useEffect(() => {
    if (view === 'list') {
      loadTenders();
    } else if (tenderId) {
      loadTender(tenderId);
    }
  }, [view, tenderId]);

  const loadTenders = async () => {
    setLoading(true);
    try {
      const data = await getOpenTenders();
      setTenders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenders');
    } finally {
      setLoading(false);
    }
  };

  const loadTender = async (id: string) => {
    setLoading(true);
    try {
      const data = await getTenderDetails(id);
      setTender(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tender details');
    } finally {
      setLoading(false);
    }
  };

  const handleBid = () => {
    if (!isReady) return;
    if (!hasSessionAttempted) return;
    if (!isAuthenticated) {
      setLoginPrompt(true);
      return;
    }
    router.push(`/vendors/bid-submission/${tender?.Id}`);
  };

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : 'Not specified';

  const formatCurrency = (value?: number) =>
    typeof value === 'number'
      ? value.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
      : 'Not specified';

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 shadow-sm">
          Error: {error}
        </div>
      </div>
    );
  }

  // List View
  if (view === 'list') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 px-6 py-8 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">Tender Opportunities</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Open Procurement Notices</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">
            Browse all active tenders and review eligibility requirements before submitting your bid package.
          </p>
        </div>

        {tenders.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            No open tenders available at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tenders.map(t => (
              <article key={t.Id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[t.Status] || statusStyles.Draft}`}>
                    {t.Status}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyles[t.ProcurementCategory]}`}>
                    {t.ProcurementCategory}
                  </span>
                </div>
                <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{t.Title}</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <dt className="font-medium text-slate-600">Deadline</dt>
                    <dd className="font-semibold text-slate-800">
                      {new Date(t.SubmissionDeadline).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </dd>
                  </div>
                </dl>
                <button
                  onClick={() => router.push(`/vendors/tenders/${t.Id}`)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  View Details & Bid
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail View
  if (!tender) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Tender not found.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push('/vendors/tenders')}
        className="mb-4 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Back to Tenders
      </button>

      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-900 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">Tender Notice</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{tender.Title}</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1">{tender.Status}</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1">{tender.ProcurementCategory}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900">Scope and Requirements</h3>
          <div className="mt-4 space-y-5 text-sm leading-6 text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1">{tender.Description || 'No description provided.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Specifications</p>
              <p className="mt-1">{tender.Specifications || 'No specifications provided.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eligibility Criteria</p>
              <p className="mt-1">{tender.EligibilityCriteria || 'No eligibility criteria provided.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evaluation Criteria</p>
              <p className="mt-1">{tender.EvaluationCriteria || 'No evaluation criteria provided.'}</p>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Tender Information</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <dt className="font-medium text-slate-600">Submission Deadline</dt>
              <dd className="text-slate-900">{formatDate(tender.SubmissionDeadline)}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <dt className="font-medium text-slate-600">Opening Date</dt>
              <dd className="text-slate-900">{formatDate(tender.OpeningDate)}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <dt className="font-medium text-slate-600">Closing Date</dt>
              <dd className="text-slate-900">{formatDate(tender.ClosingDate)}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <dt className="font-medium text-slate-600">Budget</dt>
              <dd className="text-slate-900">{formatCurrency(tender.Budget)}</dd>
            </div>
          </dl>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleBid}
              disabled={tender.Status !== 'Open'}
              className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {tender.Status === 'Open' ? 'Submit Bid' : 'Bidding Closed'}
            </button>

            {loginPrompt && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Login required to submit a bid.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push(`/vendors/login?next=${encodeURIComponent(`/vendors/bid-submission/${tender.Id}`)}`)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Go to Login
                  </button>
                  <button
                    onClick={() => setLoginPrompt(false)}
                    className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Stay Here
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {tender.Documents?.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Tender Documents</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {tender.Documents.map((doc: any) => (
              <li key={doc.Id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <span className="font-medium text-slate-700">{doc.Name}</span>
                <a href={doc.Url} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">
                  Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default TenderPublicPage;
