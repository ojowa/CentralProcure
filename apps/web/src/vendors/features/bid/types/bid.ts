export interface BidSubmission {
    TenderId: string;
    VendorId: string;
    BidAmount: number;
    Proposal: string;
}

export interface SubmittedBid {
    BidId: string;
    TenderId: string;
    BidAmount: number;
    Proposal: string;
    ValidityPeriodDays?: number;
    Status: string;
    SubmittedAt: string;
}
