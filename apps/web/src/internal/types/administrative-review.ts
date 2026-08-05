export interface AdministrativeReviewSummary {
    ComplaintId: string;
    ComplaintReference: string;
    EntityType: string;
    EntityId: string;
    StageKeyAtFiling: string;
    Status: string;
    Subject: string;
    FiledBy?: string | null;
    AssignedTo?: string | null;
    FiledAt: string;
    ResolutionOutcome?: string | null;
    ResolvedAt?: string | null;
    ParentRecordTitle?: string | null;
    ParentCurrentStageKey?: string | null;
    ParentCurrentStageTitle?: string | null;
    ParentCurrentStatus?: string | null;
}

export interface AdministrativeReviewDetail extends AdministrativeReviewSummary {
    Summary: string;
    Details: string;
    ComplaintChannel?: string | null;
    RequestedRemedy?: string | null;
    ReviewedBy?: string | null;
    ResolutionStageKey?: string | null;
    ResolutionNotes?: string | null;
    ReviewedAt?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface AdministrativeReviewCreateRequest {
    EntityType: string;
    EntityId: string;
    Subject: string;
    Summary: string;
    Details: string;
    ComplaintChannel?: string | null;
    RequestedRemedy?: string | null;
    FiledBy?: string | null;
    AssignedTo?: string | null;
}

export interface AdministrativeReviewUpdateRequest {
    Status?: string | null;
    AssignedTo?: string | null;
    ReviewedBy?: string | null;
    ResolutionOutcome?: string | null;
    ResolutionStageKey?: string | null;
    ResolutionNotes?: string | null;
}