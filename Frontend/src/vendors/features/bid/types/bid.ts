export interface BidSubmission {
    TenderId: string;
    VendorId: string;
    FinancialBid: number;
    TechnicalProposal: string;
    ValidityPeriodDays: number;
}

export interface SubmittedBid {
    BidId: string;
    TenderId: string;
    TenderTitle: string; 
    FinancialBid: number;
    TechnicalProposal: string;
    ValidityPeriodDays: number;
    SubmissionDate: string;
    BidStatus: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
}
