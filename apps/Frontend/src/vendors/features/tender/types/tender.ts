/**
 * Represents the status of a tender.
 */
export type TenderStatus = 'Open' | 'Closed' | 'Under Evaluation' | 'Awarded' | 'Cancelled';

/**
 * Represents the procurement category of a tender.
 */
export type ProcurementCategory = 'Goods' | 'Works' | 'Services';

/**
 * Represents a summary of a tender for listing purposes.
 * This is a lightweight object for displaying in a list.
 */
export interface TenderSummary {
    Id: string;
    Title: string;
    ProcurementCategory: ProcurementCategory;
    Status: TenderStatus;
    SubmissionDeadline: string; // ISO date string
}

/**
 * Represents a detailed tender for the "Tender Details" page.
 */
export interface TenderDetails {
    Id: string;
    Title: string;
    ProcurementCategory: 'Goods' | 'Works' | 'Services';
    Status: TenderStatus;
    SubmissionDeadline: string; // ISO date string
    OpeningDate: string;
    ClosingDate: string;
    Description: string;
    Specifications: string; // Detailed requirements
    Budget: number; // Estimated budget
    Documents: TenderDocument[]; // Attached documents
    EligibilityCriteria: string;
    EvaluationCriteria: string;
}

/**
 * Represents a document attached to a tender.
 */
export interface TenderDocument {
    Id: string;
    Name: string;
    Type: string; // e.g., 'pdf', 'docx'
    Url: string;
}

/**
 * Represents a bid submission for a tender.
 */
export interface BidSubmission {
    TenderId: string;
    FinancialBid: number; // The monetary amount of the bid
    TechnicalProposal: string; // Description of technical approach
    ValidityPeriod: number; // Validity period in days
    // In a real app, this would include file uploads for supporting documents
}

/**
 * Represents the response after a successful bid submission.
 */
export interface BidSubmissionResponse {
    BidId: string;
    Message: string;
}

/**
 * Represents the status of a submitted bid.
 */
export type BidStatus = 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Withdrawn';

/**
 * Represents a submitted bid with its current status and details.
 */
export interface SubmittedBid extends BidSubmission {
    BidId: string;
    SubmissionDate: string; // ISO date string
    BidStatus: BidStatus;
}
