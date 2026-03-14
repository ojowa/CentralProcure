'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSubmittedBids, submitBid } from '../services/bidService'; // Import the actual service call
import { BidSubmission } from '../types/bid';
import { useAuth } from '../../../hooks/useAuth';

const BidSubmissionPage: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const tenderIdParam = params?.tenderId;
    const tenderId = Array.isArray(tenderIdParam) ? tenderIdParam[0] : tenderIdParam;
    const { isAuthenticated, isReady } = useAuth();

    const [financialBid, setFinancialBid] = useState<number>(0);
    const [technicalProposal, setTechnicalProposal] = useState<string>('');
    const [technicalProposalFile, setTechnicalProposalFile] = useState<File | null>(null);
    const [validityPeriod, setValidityPeriod] = useState<number>(90); // Default validity period
    const [loading, setLoading] = useState<boolean>(false);
    const [checkingExisting, setCheckingExisting] = useState<boolean>(false);
    const [hasExistingBid, setHasExistingBid] = useState<boolean>(false);
    const [existingBidId, setExistingBidId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [successBidId, setSuccessBidId] = useState<string | null>(null);
    const [vendorId, setVendorId] = useState<string | null>(null);

    // Fetch tender details if needed, to display tenderTitle. For now, assume it's passed or derived.
    // In a real app, you might fetch tender details here using tenderId.

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (hasExistingBid) {
            setError("You have already submitted a bid for this tender.");
            setLoading(false);
            return;
        }

        if (!tenderId) {
            setError("Tender ID is missing for bid submission.");
            setLoading(false);
            return;
        }

        if (!vendorId) {
            setError("Vendor session is missing. Please log in again.");
            setLoading(false);
            return;
        }

        if (!technicalProposalFile && !technicalProposal.trim()) {
            setError('Provide a technical proposal text or attach a file.');
            setLoading(false);
            return;
        }

        try {
            const bidData: BidSubmission = {
                TenderId: tenderId, // Use tenderId from useParams
                VendorId: vendorId,
                FinancialBid: financialBid,
                TechnicalProposal: technicalProposalFile ? '' : technicalProposal,
                ValidityPeriodDays: validityPeriod,
            };
            const response = await submitBid(bidData, technicalProposalFile); // Call the actual service
            const bidId = response?.BidId ?? response?.bidId ?? null;
            setSuccessBidId(bidId);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Bid submission failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isReady) {
            return;
        }

        if (!isAuthenticated) {
            return;
        }

        const storedVendorId = localStorage.getItem('vendorId');
        setVendorId(storedVendorId);

        if (!storedVendorId) {
            setError('Vendor session is missing. Please log in again.');
        }
    }, [isAuthenticated, isReady, tenderId]);

    useEffect(() => {
        if (!vendorId || !tenderId) {
            return;
        }

        let active = true;
        const checkExisting = async () => {
            setCheckingExisting(true);
            try {
                const bids = await getSubmittedBids(vendorId);
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
    }, [tenderId, vendorId]);

    useEffect(() => {
        if (success && successBidId) {
            router.push(`/submission-confirmation/${successBidId}`);
        }
    }, [router, success, successBidId]);

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

    if (!isReady) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
                    Checking authentication...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        const nextPath = tenderId ? `/bid-submission/${tenderId}` : '/bid-submission';
        return (
            <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-800 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Login Required</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Sign in to submit a bid</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        You must be logged in to continue.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <button
                            type="button"
                            onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                            className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
                        >
                            Go to Login
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/tenders')}
                            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                        >
                            Browse Tenders
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Submit Bid</h2>
                <p className="text-gray-600 mb-6 text-center">Tender ID: {tenderId ?? 'Unavailable'}</p>
                {checkingExisting && (
                    <p className="text-center text-sm text-gray-500 mb-4">Checking existing bids...</p>
                )}
                {hasExistingBid && (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        You have already submitted a bid for this tender. Multiple submissions are not allowed.
                        {existingBidId && (
                            <div className="mt-2">
                                <a
                                    href={`/submission-confirmation/${existingBidId}`}
                                    className="text-sm font-semibold text-emerald-700 hover:underline"
                                >
                                    View my submitted bid
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="financialBid" className="block text-gray-700 text-sm font-bold mb-2">Financial Bid (NGN)</label>
                        <input
                            type="number"
                            id="financialBid"
                            value={financialBid}
                            onChange={(e) => setFinancialBid(Number(e.target.value))}
                            required
                            min="0"
                            step="0.01"
                            disabled={hasExistingBid}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="technicalProposal" className="block text-gray-700 text-sm font-bold mb-2">Technical Proposal</label>
                        <textarea
                            id="technicalProposal"
                            value={technicalProposal}
                            onChange={(e) => setTechnicalProposal(e.target.value)}
                            rows={8}
                            placeholder="Describe your technical approach, qualifications, and how you meet the tender requirements."
                            disabled={hasExistingBid || Boolean(technicalProposalFile)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                        <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-3">
                            <label htmlFor="technicalProposalFile" className="block text-sm font-semibold text-gray-700 mb-2">
                                Attach technical proposal (PDF/DOC/DOCX)
                            </label>
                            <input
                                id="technicalProposalFile"
                                type="file"
                                accept=".pdf,.doc,.docx"
                                disabled={hasExistingBid}
                                onChange={handleProposalFileChange}
                                className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                            />
                            {technicalProposalFile && (
                                <div className="mt-2 flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs text-gray-600">
                                    <span>{technicalProposalFile.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setTechnicalProposalFile(null)}
                                        className="font-semibold text-red-600 hover:underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                            {technicalProposalFile && (
                                <p className="mt-2 text-xs text-gray-500">Text entry is disabled while a file is attached.</p>
                            )}
                        </div>
                    </div>
                    <div className="mb-6">
                        <label htmlFor="validityPeriod" className="block text-gray-700 text-sm font-bold mb-2">Bid Validity Period (days)</label>
                        <input
                            type="number"
                            id="validityPeriod"
                            value={validityPeriod}
                            onChange={(e) => setValidityPeriod(Number(e.target.value))}
                            required
                            min="1"
                            disabled={hasExistingBid}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>

                    {error && <p className="text-red-500 text-center text-sm mb-4">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || hasExistingBid}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full focus:outline-none focus:shadow-outline transition duration-300"
                    >
                        {loading ? 'Submitting...' : 'Submit Bid'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push(tenderId ? `/tenders/${tenderId}` : '/tenders')}
                        className="mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg w-full focus:outline-none focus:shadow-outline transition duration-300"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BidSubmissionPage;
