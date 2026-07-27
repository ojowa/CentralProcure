'use client';

import React, { useEffect, useState } from 'react';
import { getSubmittedBids, submitBid } from '../services/bidService';
import type { BidSubmission } from '../types/bid';
import { useAuth } from '../../../hooks/useAuth';

interface BidSubmissionFormProps {
  tenderId: string;
  onBack: () => void;
  onClose: () => void;
}

const BidSubmissionForm: React.FC<BidSubmissionFormProps> = ({ tenderId, onBack, onClose }) => {
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [proposal, setProposal] = useState<string>('');
  const [technicalProposalFile, setTechnicalProposalFile] = useState<File | null>(null);
  const [validityPeriod, setValidityPeriod] = useState<number>(90);
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(false);
  const [hasExistingBid, setHasExistingBid] = useState<boolean>(false);
  const [existingBidId, setExistingBidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBidId, setSuccessBidId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.UserId || !tenderId) {
      return;
    }

    let active = true;
    const checkExisting = async () => {
      setCheckingExisting(true);
      try {
        const bids = await getSubmittedBids(user.UserId);
        const existingBid = bids.find((bid) => bid.TenderId === tenderId);
        const exists = Boolean(existingBid);
        if (active) {
          setHasExistingBid(exists);
          setExistingBidId(existingBid?.BidId ?? null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Unable to verify existing bids.');
        }
      } finally {
        if (active) {
          setCheckingExisting(false);
        }
      }
    };

    checkExisting();
    return () => {
      active = false;
    };
  }, [tenderId, user?.UserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasExistingBid) {
      setError('You have already submitted a bid for this tender.');
      return;
    }

    if (!user?.UserId) {
      setError('Vendor session is missing. Please log in again.');
      return;
    }

    if (!technicalProposalFile && !proposal.trim()) {
      setError('Provide a technical proposal text or attach a file.');
      return;
    }

    setLoading(true);
    try {
      const bidData: BidSubmission = {
        TenderId: tenderId,
        VendorId: user.UserId,
        BidAmount: bidAmount,
        Proposal: technicalProposalFile ? '' : proposal
      };
      const response = await submitBid(bidData, technicalProposalFile);
      const bidId = response?.BidId ?? response?.bidId ?? null;
      setSuccessBidId(bidId);
    } catch (err: any) {
      setError(err.message || 'Bid submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProposalFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setTechnicalProposalFile(null);
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      setError('Only PDF or Word documents are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > maxBytes) {
      setError('Technical proposal file exceeds 10 MB limit.');
      event.target.value = '';
      return;
    }

    setError(null);
    setTechnicalProposalFile(file);
  };

  if (successBidId) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Bid Submitted</p>
        <p className="mt-2 text-base">Your bid has been submitted successfully.</p>
        {successBidId && (
          <p className="mt-2 text-sm text-emerald-800">Bid ID: {successBidId}</p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <button onClick={onBack} className="text-emerald-700 hover:underline mb-4 text-sm font-semibold">
        &larr; Back to Details
      </button>

      <h2 className="text-2xl font-bold text-slate-900">Submit Bid</h2>
      <p className="mt-1 text-sm text-slate-600">Tender ID: {tenderId}</p>
      {checkingExisting && (
        <p className="mt-2 text-sm text-slate-500">Checking for existing bids...</p>
      )}
      {hasExistingBid && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have already submitted a bid for this tender. Multiple submissions are not allowed.
          {existingBidId && (
            <div className="mt-2">
              <a
                href={`/vendors/submission-confirmation/${existingBidId}`}
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                View my submitted bid
              </a>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="financialBid" className="block text-sm font-medium text-slate-700">
            Financial Bid (NGN)
          </label>
          <input
            type="number"
            id="financialBid"
            value={bidAmount}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            required
            min="0"
            step="0.01"
            disabled={hasExistingBid}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="technicalProposal" className="block text-sm font-medium text-slate-700">
            Technical Proposal
          </label>
          <textarea
            id="technicalProposal"
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            disabled={hasExistingBid || Boolean(technicalProposalFile)}
            rows={8}
            placeholder="Describe your technical approach, qualifications, and how you meet the tender requirements."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
            <label htmlFor="technicalProposalFile" className="block text-sm font-medium text-slate-700">
              Attach technical proposal (PDF/DOC/DOCX)
            </label>
            <input
              id="technicalProposalFile"
              type="file"
              accept=".pdf,.doc,.docx"
              disabled={hasExistingBid}
              onChange={handleProposalFileChange}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
            />
            {technicalProposalFile && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                <span>{technicalProposalFile.name}</span>
                <button
                  type="button"
                  onClick={() => setTechnicalProposalFile(null)}
                  className="font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            {technicalProposalFile && (
              <p className="mt-2 text-xs text-slate-500">
                Text entry is disabled while a file is attached.
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="validityPeriod" className="block text-sm font-medium text-slate-700">
            Bid Validity Period (days)
          </label>
          <input
            type="number"
            id="validityPeriod"
            value={validityPeriod}
            onChange={(e) => setValidityPeriod(Number(e.target.value))}
            required
            min="1"
            disabled={hasExistingBid}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || hasExistingBid}
            className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
          >
            {loading ? 'Submitting...' : 'Submit Bid'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BidSubmissionForm;
