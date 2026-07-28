export interface BidSubmission {
    TenderId: string;
    VendorId: string;
    BidAmount: number;
    Proposal: string;
}

export interface SubmittedBid {
    BidId: string;
    TenderId: string;
    TenderTitle: string; 
    BidAmount: number;
    Proposal: string;
    Status: string;
    SubmittedAt: string;
}
