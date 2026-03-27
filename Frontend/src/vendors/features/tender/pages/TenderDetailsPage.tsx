'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTenderDetails } from '../services/tenderService';
import { TenderDetails } from '../types/tender';
import { useAuth } from '../../../hooks/useAuth';

const TenderDetailsPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
  const [tender, setTender] = useState<TenderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Tender ID is missing.');
      setLoading(false);
      return;
    }

    const fetchTender = async () => {
      try {
        const details = await getTenderDetails(id);
        setTender(details);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTender();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading tender details...
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

  if (!tender) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Tender not found.
        </div>
      </div>
    );
  }

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleString('en-NG', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Not specified';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
              <dd className="text-slate-900">
                {typeof tender.Budget === 'number'
                  ? tender.Budget.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
                  : 'Not specified'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                if (!isReady) {
                  return;
                }
                if (!hasSessionAttempted) {
                  return;
                }
                if (!isAuthenticated) {
                  setLoginPrompt(true);
                  return;
                }
                router.push(`/vendors/bid-submission/${tender.Id}`);
              }}
              className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Submit Bid
            </button>
            <button
              onClick={() => router.push('/vendors/tenders')}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Tenders
            </button>
            {loginPrompt && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700">
                <p className="font-semibold">Login required to submit a bid.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/vendors/login?next=${encodeURIComponent(`/vendors/bid-submission/${tender.Id}`)}`)
                    }
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                  >
                    Go to Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginPrompt(false)}
                    className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Stay Here
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {tender.Documents && tender.Documents.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Tender Documents</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {tender.Documents.map((doc) => (
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

export default TenderDetailsPage;
