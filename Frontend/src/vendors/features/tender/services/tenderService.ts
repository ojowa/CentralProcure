import { TenderSummary, BidSubmission, TenderDetails, BidSubmissionResponse, SubmittedBid } from '../types/tender';
import apiClient from '../../shared/services/apiClient';

const API_ENDPOINTS = {
    TENDERS_OPEN: '/api/Tender/open',
    TENDERS_DETAILS: (id: string) => `/api/Tender/${id}`,
    TENDERS_BID: '/api/Tender/bid',
    TENDERS_SUBMITTED_BIDS: '/api/Tender/submitted-bids',
};

/**
 * Fetches a list of open tenders available for bidding.
 * This function communicates with the backend's Tender Service.
 *
 * @returns A promise that resolves to an array of tender summaries.
 */
export const getOpenTenders = async (): Promise<TenderSummary[]> => {
    try {
        // Next.js rewrites route '/api/Tender/open' to the Tender Service.
        const response = await apiClient.get(API_ENDPOINTS.TENDERS_OPEN);
        
        // Handle different response formats to ensure we always return an array
        let tenderData = response.data;
        
        // If response.data is an object with a data property, use that
        if (tenderData && typeof tenderData === 'object' && !Array.isArray(tenderData)) {
            if (Array.isArray(tenderData.data)) {
                tenderData = tenderData.data;
            } else if (Array.isArray(tenderData.tenders)) {
                tenderData = tenderData.tenders;
            } else if (Array.isArray(tenderData.items)) {
                tenderData = tenderData.items;
            } else {
                // If no array property found, return empty array
                console.warn("Unexpected response format from tenders API:", tenderData);
                return [];
            }
        }
        
        // Ensure we return an array
        if (!Array.isArray(tenderData)) {
            console.warn("Tender data is not an array:", tenderData);
            return [];
        }
        
        return tenderData;
    } catch (error) {
        console.error("Failed to fetch open tenders:", error);
        throw new Error("Could not load open tenders. Please try again later.");
    }
};

/**
 * Fetches detailed information about a specific tender.
 * This function communicates with the backend's Tender Service.
 *
 * @param tenderId The ID of the tender to fetch details for.
 * @returns A promise that resolves to the tender details.
 */
export const getTenderDetails = async (tenderId: string): Promise<TenderDetails> => {
    try {
        // Next.js rewrites route '/api/Tender/{id}' to the Tender Service.
        const response = await apiClient.get(API_ENDPOINTS.TENDERS_DETAILS(tenderId));
        
        // Handle different response formats to ensure we always return an object
        let tenderData = response.data;
        
        if (tenderData && typeof tenderData === 'object' && !Array.isArray(tenderData)) {
            if (tenderData.data) {
                tenderData = tenderData.data;
            }
        }
        
        return tenderData as TenderDetails;
    } catch (error) {
        console.error("Failed to fetch tender details:", error);
        throw new Error("Could not load tender details. Please try again later.");
    }
};

/**
 * Submits a bid for a tender.
 * This function communicates with the backend's Tender Service.
 *
 * @param bid The bid submission data.
 * @returns A promise that resolves with the BidSubmissionResponse containing the bidId.
 */
export const submitBid = async (bid: BidSubmission): Promise<BidSubmissionResponse> => {
    try {
        // Next.js rewrites route '/api/Tender/bid' to the Tender Service.
        const response = await apiClient.post(API_ENDPOINTS.TENDERS_BID, bid);
        return response.data;
    } catch (error) {
        console.error("Failed to submit bid:", error);
        throw new Error("Could not submit bid. Please try again later.");
    }
};

/**
 * Fetches all bids submitted by the currently logged-in vendor.
 * This function communicates with the backend's Tender Service.
 *
 * @returns A promise that resolves to an array of submitted bids.
 */
export const getSubmittedBids = async (): Promise<SubmittedBid[]> => {
    try {
        // Next.js rewrites route '/api/Tender/submitted-bids' to the Tender Service.
        const response = await apiClient.get(API_ENDPOINTS.TENDERS_SUBMITTED_BIDS);
        
        // Handle different response formats to ensure we always return an array
        let bidsData = response.data;
        
        if (bidsData && typeof bidsData === 'object' && !Array.isArray(bidsData)) {
            if (Array.isArray(bidsData.data)) {
                bidsData = bidsData.data;
            } else if (Array.isArray(bidsData.bids)) {
                bidsData = bidsData.bids;
            } else if (Array.isArray(bidsData.items)) {
                bidsData = bidsData.items;
            } else {
                console.warn("Unexpected response format from submitted bids API:", bidsData);
                return [];
            }
        }
        
        if (!Array.isArray(bidsData)) {
            console.warn("Bids data is not an array:", bidsData);
            return [];
        }
        
        return bidsData;
    } catch (error) {
        console.error("Failed to fetch submitted bids:", error);
        throw new Error("Could not load submitted bids. Please try again later.");
    }
};
