import apiClient from '../../shared/services/apiClient';
import { BidSubmission, SubmittedBid } from '../types/bid';

const API_ENDPOINTS = {
    BIDS_SUBMIT: '/api/bids',
    BIDS_VENDOR: (vendorId: string) => `/api/vendors/${vendorId}/bids`,
    BIDS_DETAIL: (bidId: string) => `/api/bids/${bidId}`,
};

/**
 * Submits a bid for a tender.
 * This function communicates with the backend's Post-Award Service.
 *
 * @param bid The bid submission data.
 * @returns A promise that resolves with the submitted bid data.
 */
export const submitBid = async (bid: BidSubmission, technicalProposalFile?: File | null): Promise<any> => {
    try {
        const formData = new FormData();
        formData.append('TenderId', bid.TenderId);
        formData.append('VendorId', bid.VendorId);
        formData.append('FinancialBid', String(bid.FinancialBid));
        formData.append('TechnicalProposal', bid.TechnicalProposal ?? '');
        formData.append('ValidityPeriodDays', String(bid.ValidityPeriodDays));
        if (technicalProposalFile) {
            formData.append('TechnicalProposalFile', technicalProposalFile);
        }

        // Use multipart form data for optional file uploads
        const response = await apiClient.post(API_ENDPOINTS.BIDS_SUBMIT, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error: any) {
        console.error("Failed to submit bid:", error);
        const errorMessage = error.response?.data?.message || "Could not submit bid. Please try again later.";
        throw new Error(errorMessage);
    }
};

/**
 * Fetches all bids submitted by a specific vendor.
 * This function communicates with the backend's Post-Award Service.
 *
 * @param vendorId The ID of the vendor whose bids are to be fetched.
 * @returns A promise that resolves to an array of submitted bids.
 */
export const getSubmittedBids = async (vendorId: string): Promise<SubmittedBid[]> => {
    try {
        // Use the new vendor-specific endpoint for fetching bids
        const response = await apiClient.get(API_ENDPOINTS.BIDS_VENDOR(vendorId));
        return response.data;
    } catch (error: any) {
        console.error("Failed to fetch submitted bids:", error);
        const errorMessage = error.response?.data?.message || "Could not load submitted bids. Please try again later.";
        throw new Error(errorMessage);
    }
};

export interface BidDetailResponse {
    BidId: string;
    TenderId: string;
    TenderTitle: string;
    VendorId: string;
    FinancialBid: number;
    TechnicalProposal: string;
    ValidityPeriodDays: number;
    SubmissionDate: string;
    BidStatus: string;
}

export const getBidById = async (bidId: string): Promise<BidDetailResponse> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.BIDS_DETAIL(bidId));
        return response.data as BidDetailResponse;
    } catch (error: any) {
        console.error("Failed to fetch bid details:", error);
        const errorMessage = error.response?.data?.message || "Could not load bid details. Please try again later.";
        throw new Error(errorMessage);
    }
};
