'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSubmittedBids } from '../services/bidService';
import { SubmittedBid } from '../types/bid';
import { useAuth } from '../../../hooks/useAuth';

const SubmittedBidsStatusPage: React.FC = () => {
    const router = useRouter();
    const { isAuthenticated, isReady, hasSessionAttempted, user } = useAuth();
    const [bids, setBids] = useState<SubmittedBid[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isReady) {
            return;
        }

        if (!hasSessionAttempted) {
            return;
        }

        if (!isAuthenticated || !user?.UserId) {
            router.replace('/vendors/login?next=%2Fvendors%2Fdashboard%2Fsubmitted-bids');
            return;
        }

        const fetchBids = async () => {
            try {
                // Pass the authenticated vendor's ID to the service call
                const bidData = await getSubmittedBids(user.UserId);
                setBids(bidData);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch submitted bids.');
            } finally {
                setLoading(false);
            }
        };

        fetchBids();
    }, [isAuthenticated, isReady, hasSessionAttempted, router, user?.UserId]);

    if (loading) {
        return <div className="text-center p-4">Loading submitted bids...</div>;
    }

    if (error) {
        return <div className="text-center p-4 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">My Submitted Bids</h2>
            {bids.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <p className="text-gray-600">You have not submitted any bids yet.</p>
                    <Link href="/vendors/tenders" className="text-blue-600 hover:underline mt-4 inline-block">
                        Browse Open Tenders
                    </Link>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                    <table className="min-w-full leading-normal">
                        <thead>
                            <tr>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Bid ID
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Tender ID
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Financial Bid
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Technical Proposal Summary
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Validity (Days)
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Submission Date
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {bids.map((bid) => (
                                <tr key={bid.BidId} className="hover:bg-gray-50">
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{bid.BidId}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <Link href={`/vendors/tenders/${bid.TenderId}`} className="text-blue-600 hover:underline">
                                            {bid.TenderId}
                                        </Link>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">₦{bid.BidAmount.toLocaleString()}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{bid.Proposal ? bid.Proposal.substring(0, 50) + '...' : 'N/A'}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">—</p>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{new Date(bid.SubmittedAt).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${
                                            bid.Status === 'Approved' ? 'text-green-900' :
                                            bid.Status === 'Rejected' ? 'text-red-900' :
                                            'text-yellow-900'
                                        }`}>
                                            <span aria-hidden className={`absolute inset-0 opacity-50 rounded-full ${
                                                bid.Status === 'Approved' ? 'bg-green-200' :
                                                bid.Status === 'Rejected' ? 'bg-red-200' :
                                                'bg-yellow-200'
                                            }`}></span>
                                            <span className="relative">{bid.Status}</span>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SubmittedBidsStatusPage;
