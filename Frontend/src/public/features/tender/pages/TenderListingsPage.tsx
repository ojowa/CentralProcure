'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOpenTenders, getTenderDetails } from '../services/tenderService';
import { TenderDetails, TenderSummary } from '../types/tender';
import TenderDetailsComponent from './TenderDetails';
import BidSubmissionForm from '../../bid/components/BidSubmissionForm';
import { useAuth } from '../../../hooks/useAuth';

const statusStyles: Record<TenderSummary['Status'], string> = {
  Open: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Closed: 'bg-rose-100 text-rose-800 border-rose-200',
  'Under Evaluation': 'bg-amber-100 text-amber-800 border-amber-200',
  Awarded: 'bg-blue-100 text-blue-800 border-blue-200',
  Cancelled: 'bg-slate-200 text-slate-700 border-slate-300'
};

const categoryStyles: Record<TenderSummary['ProcurementCategory'], string> = {
  Goods: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Works: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Services: 'bg-purple-50 text-purple-700 border-purple-200'
};

const TenderListings: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTender, setSelectedTender] = useState<TenderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [modalView, setModalView] = useState<'details' | 'bid' | 'login'>('details');

  useEffect(() => {
    const fetchTenders = async () => {
      try {
        const tenderData = await getOpenTenders();
        // Ensure tenderData is an array before setting state
        if (Array.isArray(tenderData)) {
          setTenders(tenderData);
        } else {
          console.warn("getOpenTenders did not return an array:", tenderData);
          setTenders([]);
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTenders();
  }, []);

  const openTenderDetails = async (tenderId: string) => {
    setDetailsError(null);
    setDetailsLoading(true);
    setModalView('details');
    try {
      const details = await getTenderDetails(tenderId);
      setSelectedTender(details);
    } catch (err: any) {
      setDetailsError(err.message || 'Unable to load tender details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeTenderDetails = () => {
    setSelectedTender(null);
    setDetailsError(null);
    setDetailsLoading(false);
    setModalView('details');
  };

  const handleBid = (tenderId: string) => {
    if (!isReady) {
      return;
    }
    if (!isAuthenticated) {
      setModalView('login');
      return;
    }
    setModalView('bid');
  };

  const handleBackToDetails = () => {
    setModalView('details');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading tender listings...
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
          {tenders.map((tender) => (
            <article key={tender.Id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[tender.Status]}`}>
                  {tender.Status}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyles[tender.ProcurementCategory]}`}>
                  {tender.ProcurementCategory}
                </span>
              </div>

              <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{tender.Title}</h3>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <dt className="font-medium text-slate-600">Submission Deadline</dt>
                  <dd className="font-semibold text-slate-800">
                    {new Date(tender.SubmissionDeadline).toLocaleDateString('en-NG', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => openTenderDetails(tender.Id)}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                View Details and Bid
              </button>
            </article>
          ))}
        </div>
      )}

      {(detailsLoading || detailsError || selectedTender) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10">
          <div className="relative max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeTenderDetails}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>

            {detailsLoading && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                Loading tender details...
              </div>
            )}

            {detailsError && !detailsLoading && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
                {detailsError}
              </div>
            )}

            {selectedTender && !detailsLoading && !detailsError && modalView === 'details' && (
              <TenderDetailsComponent
                tender={selectedTender}
                onClose={closeTenderDetails}
                onBid={() => handleBid(selectedTender.Id)}
              />
            )}

            {selectedTender && !detailsLoading && !detailsError && modalView === 'bid' && (
              <BidSubmissionForm
                tenderId={selectedTender.Id}
                onBack={handleBackToDetails}
                onClose={closeTenderDetails}
              />
            )}

            {selectedTender && !detailsLoading && !detailsError && modalView === 'login' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Login Required</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Sign in to submit a bid</h3>
                <p className="mt-2 text-sm text-slate-600">
                  You need an active vendor session to submit bids.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/login?next=${encodeURIComponent(`/bid-submission/${selectedTender.Id}`)}`)
                    }
                    className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
                  >
                    Go to Login
                  </button>
                  <button
                    type="button"
                    onClick={closeTenderDetails}
                    className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  >
                    Stay Here
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderListings;
