export interface BppNoObjectionDetail {
    NoObjectionId: string;
    TenderId?: string | null;
    Amount: number;
    ProcurementType?: string | null;
    Status: string;
    RequestedBy?: string | null;
    RequestedAt: string;
    DecisionBy?: string | null;
    DecisionAt?: string | null;
    DecisionNotes?: string | null;
    ReferenceCode?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface BppNoObjectionCreateRequest {
    TenderId?: string | null;
    Amount: number;
    ProcurementType?: string | null;
    Status?: string | null;
    RequestedBy?: string | null;
    RequestedAt?: string | null;
    ReferenceCode?: string | null;
}

export interface BppNoObjectionUpdateRequest {
    Status?: string | null;
    DecisionBy?: string | null;
    DecisionAt?: string | null;
    DecisionNotes?: string | null;
    ReferenceCode?: string | null;
}