export interface BidOpeningSessionSummary {
    SessionId: string;
    TenderId: string;
    SessionTitle: string;
    Location?: string | null;
    ScheduledAt: string;
    Status: string;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    CreatedAt: string;
}

export interface BidOpeningSessionDetail extends BidOpeningSessionSummary {
    Notes?: string | null;
    UpdatedAt: string;
}

export interface BidOpeningSessionListResponse {
    Items: BidOpeningSessionSummary[];
    Page: number;
    PageSize: number;
    TotalCount: number;
}

export interface BidOpeningSessionCreateRequest {
    TenderId: string;
    SessionTitle: string;
    Location?: string | null;
    ScheduledAt: string;
    Status?: string | null;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    Notes?: string | null;
}

export interface BidOpeningSessionUpdateRequest {
    SessionTitle?: string | null;
    Location?: string | null;
    ScheduledAt?: string | null;
    Status?: string | null;
    OpenedAt?: string | null;
    ClosedAt?: string | null;
    Notes?: string | null;
}