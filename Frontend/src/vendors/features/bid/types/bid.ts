export interface BidSubmission {
    TenderId: string;
    VendorId: string;
    BidAmount: number;
    Proposal: string;
    ValidityPeriodDays: number;
}

export interface SubmittedBid {
    BidId: string;
    TenderId: string;
    TenderTitle: string; 
    BidAmount: number;
    Proposal: string;
    ValidityPeriodDays: number;
    SubmissionDate: string;
    BidStatus: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
}
