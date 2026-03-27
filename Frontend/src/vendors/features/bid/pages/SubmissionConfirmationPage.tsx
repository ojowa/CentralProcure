'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBidById, getSubmittedBids, type BidDetailResponse } from '../services/bidService';
import { withAppBasePath } from '../../../utils/basePath';

const SubmissionConfirmationPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const bidIdParam = params?.bidId;
  const bidId = Array.isArray(bidIdParam) ? bidIdParam[0] : bidIdParam;
  const [bid, setBid] = useState<BidDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bidId) {
      setError('Bid ID is missing.');
      setLoading(false);
      return;
    }

    const isGuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(bidId);
    if (!isGuid) {
      setError('Invalid Bid ID format.');
      setLoading(false);
      return;
    }

    let active = true;
    const loadBid = async () => {
      setLoading(true);
      try {
        const data = await getBidById(bidId);
        if (active) {
          setBid(data);
          setError(null);
        }
      } catch (err: any) {
        try {
          const vendorId = localStorage.getItem('vendorId');
          if (!vendorId) {
            throw err;
          }

          const bids = await getSubmittedBids(vendorId);
          const matchedBid = bids.find((item) => item.BidId === bidId);
          if (!matchedBid) {
            throw err;
          }

          const fallbackBid: BidDetailResponse = {
            BidId: matchedBid.BidId,
            TenderId: matchedBid.TenderId,
            TenderTitle: matchedBid.TenderTitle ?? 'Tender details unavailable',
            VendorId: vendorId,
            FinancialBid: matchedBid.FinancialBid,
            TechnicalProposal: matchedBid.TechnicalProposal,
            ValidityPeriodDays: matchedBid.ValidityPeriodDays,
            SubmissionDate: matchedBid.SubmissionDate,
            BidStatus: matchedBid.BidStatus
          };

          if (active) {
            setBid(fallbackBid);
            setError(null);
          }
        } catch (fallbackErr: any) {
          if (active) {
            setError(fallbackErr.message || 'Unable to load bid details.');
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadBid();
    return () => {
      active = false;
    };
  }, [bidId]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-10 text-center text-slate-600 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
            Loading submission details...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-rose-50 via-white to-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.45)]">
            {error}
          </div>
        </div>
      </div>
    );
  }

  const isProposalFile = (value?: string | null) => {
    if (!value) {
      return false;
    }
    return value.startsWith('uploads/bids/') || value.startsWith('/uploads/bids/');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.12),_transparent_45%)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_20px_70px_-40px_rgba(15,23,42,0.6)]">
          <div className="absolute right-0 top-0 h-32 w-48 -translate-y-10 translate-x-10 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-48 -translate-x-10 translate-y-10 rounded-full bg-teal-200/40 blur-3xl" />

          <div className="relative grid gap-10 px-8 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-sm font-semibold text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Submission confirmed
              </div>
              <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
                Bid submitted successfully
              </h1>
              <p className="mt-3 text-base text-slate-600">
                Your bid has been received. You can monitor progress and updates from your submitted bids dashboard.
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bid Reference</p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">{bidId}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Status</p>
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                    {bid?.BidStatus ?? 'Under review'}
                  </p>
                </div>
              </div>

              {bid && (
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-semibold text-slate-900">{bid.TenderTitle}</p>
                    <p className="text-xs text-slate-500">Tender ID: {bid.TenderId}</p>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Bid Amount</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        ₦{bid.FinancialBid.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Submitted</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {new Date(bid.SubmissionDate).toLocaleString()}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Technical Proposal</p>
                      {isProposalFile(bid.TechnicalProposal) ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="text-sm text-slate-600">Attached document</span>
                          <a
                            href={withAppBasePath(`/api/bids/${bid.BidId}/proposal-file`)}
                            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Download technical proposal
                          </a>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{bid.TechnicalProposal}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.push('/vendors/dashboard/submitted-bids')}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  View submitted bids
                </button>
                <button
                  onClick={() => router.push('/vendors')}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to home
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">What happens next</h2>
              <p className="mt-2 text-sm text-slate-600">
                Track the evaluation process and stay ready for clarification requests.
              </p>
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Submission received</p>
                  <p className="mt-1 text-xs text-slate-500">We have logged your bid and issued a reference ID.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Technical review</p>
                  <p className="mt-1 text-xs text-slate-500">Our panel evaluates compliance and requirements.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Financial review</p>
                  <p className="mt-1 text-xs text-slate-500">Qualified bids move to pricing evaluation.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Decision notice</p>
                  <p className="mt-1 text-xs text-slate-500">You will be notified once a decision is made.</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Need help? Contact support with your bid reference ID for faster assistance.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionConfirmationPage;
