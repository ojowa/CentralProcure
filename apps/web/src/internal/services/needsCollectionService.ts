import { send } from './moduleService.shared';
import { serviceBaseUrls } from './moduleService';

const baseUrl = `${serviceBaseUrls.workflow}/api/needs-collection`;

// ── Collection Types ──────────────────────────
export interface NeedsCollectionSummary {
  CollectionId: string;
  Title: string;
  FiscalYear: number;
  UnitId: string;
  UnitName: string;
  Status: string;
  Remarks?: string;
  CreatedBy: string;
  CreatedAt: string;
  UpdatedAt: string;
  ItemCount: number;
}

export interface NeedsCollectionItem {
  ItemId?: string;
  Description: string;
  Quantity: number;
  Unit: string;
  Priority: string;
  ProcurementType: string;
}

export interface NeedsCollectionDetail extends NeedsCollectionSummary {
  SubmittedAt?: string;
  Items: NeedsCollectionItem[];
}

// ── Analysis Types ────────────────────────────
export interface NeedsAnalysisResult {
  item_description: string;
  procurement_type: string;
  unit: string;
  total_quantity: number;
  occurrence_count: number;
  priority_summary: string;
  source_units: Array<{ unitId: string; unitName: string }>;
}

export interface NeedsCategoryBreakdown {
  procurement_type: string;
  item_count: number;
  total_quantity: number;
  total_collections: number;
  unique_units: number;
}

export interface NeedsUnitStats {
  unit_id: string;
  unit_name: string;
  item_count: number;
  total_quantity: number;
  submitted_at: string | null;
  collection_status: string;
}

export interface NeedsWeightedResult extends NeedsAnalysisResult {
  weighted_score: number;
}

export interface NeedsSimilarGroup {
  group_id: number;
  descriptions: string[];
  procurement_type: string;
  combined_quantity: number;
  occurrence_count: number;
  suggestion: string;
}

export interface NeedsPlanGap {
  item_description: string;
  procurement_type: string;
  total_quantity: number;
  source_units: Array<{ unitId: string; unitName: string }>;
  in_plan: boolean;
  plan_item_id: string | null;
  plan_description: string | null;
  plan_estimated_amount: number | null;
}

export interface NeedsThresholdFlag {
  item_description: string;
  procurement_type: string;
  total_quantity: number;
  estimated_total_value: number;
  threshold_route: string | null;
  requires_board: boolean;
  requires_bpp: boolean;
  threshold_min: number | null;
  threshold_max: number | null;
}

export interface NeedsNonSubmission {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  has_draft: boolean;
  has_submission: boolean;
  submission_status: string;
  last_updated: string | null;
}

// ── Assessment Types ──────────────────────────
export interface NeedsAssessmentSummary {
  AssessmentId: string;
  FiscalYear: number;
  Status: string;
  Remarks?: string;
  AssessedBy?: string;
  AssessedAt?: string;
  CreatedAt: string;
  ItemCount: number;
}

export interface NeedsAssessmentItem {
  ItemId: string;
  Description: string;
  Quantity: number;
  Unit: string;
  Priority: string;
  ProcurementType: string;
  SourceUnits: Array<{ unitId: string; unitName: string }>;
}

export interface NeedsAssessmentDetail extends NeedsAssessmentSummary {
  Items: NeedsAssessmentItem[];
  UpdatedAt: string;
}

// ── Collection API ────────────────────────────
export const fetchCollections = (token: string, params?: { Status?: string; FiscalYear?: number }) => {
  const query = new URLSearchParams();
  if (params?.Status) query.append('Status', params.Status);
  if (params?.FiscalYear) query.append('FiscalYear', String(params.FiscalYear));
  const qs = query.toString();
  return send<{ Items: NeedsCollectionSummary[]; TotalCount: number }>(baseUrl, qs ? `?${qs}` : '', token, { method: 'GET' });
};

export const fetchCollectionDetail = (id: string, token: string) =>
  send<NeedsCollectionDetail>(baseUrl, `/${id}`, token, { method: 'GET' });

export const createCollection = (token: string, payload: { Title: string; FiscalYear: number; UnitId?: string; Remarks?: string; Items?: NeedsCollectionItem[] }) =>
  send<NeedsCollectionSummary>(baseUrl, '', token, { method: 'POST' }, payload);

export const updateCollection = (id: string, token: string, payload: { Title?: string; FiscalYear?: number; UnitId?: string; Remarks?: string; Items?: NeedsCollectionItem[] }) =>
  send<NeedsCollectionSummary>(baseUrl, `/${id}`, token, { method: 'PUT' }, payload);

export const submitCollection = (id: string, token: string) =>
  send<{ CollectionId: string; Status: string }>(baseUrl, `/${id}/submit`, token, { method: 'POST' });

export const deleteCollection = (id: string, token: string) =>
  send<{ Message: string }>(baseUrl, `/${id}`, token, { method: 'DELETE' });

// ── Analysis API ──────────────────────────────
export const fetchNeedsAnalysis = (token: string, fiscalYear: number) =>
  send<NeedsAnalysisResult[]>(baseUrl, `/analysis?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchCategoryBreakdown = (token: string, fiscalYear: number) =>
  send<NeedsCategoryBreakdown[]>(baseUrl, `/analysis/category?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchUnitStats = (token: string, fiscalYear: number) =>
  send<NeedsUnitStats[]>(baseUrl, `/analysis/unit?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchWeightedAnalysis = (token: string, fiscalYear: number) =>
  send<NeedsWeightedResult[]>(baseUrl, `/analysis/weighted?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchSimilarNeeds = (token: string, fiscalYear: number) =>
  send<NeedsSimilarGroup[]>(baseUrl, `/analysis/similar?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchPlanGap = (token: string, fiscalYear: number) =>
  send<NeedsPlanGap[]>(baseUrl, `/analysis/plan-gap?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

export const fetchThresholdFlags = (token: string, fiscalYear: number, unitPrice?: number) =>
  send<NeedsThresholdFlag[]>(baseUrl, `/analysis/thresholds?FiscalYear=${fiscalYear}${unitPrice ? `&UnitPrice=${unitPrice}` : ''}`, token, { method: 'GET' });

export const fetchNonSubmissions = (token: string, fiscalYear: number) =>
  send<NeedsNonSubmission[]>(baseUrl, `/analysis/non-submissions?FiscalYear=${fiscalYear}`, token, { method: 'GET' });

// ── Assessment API ────────────────────────────
export const fetchAssessments = async (token: string, params?: { FiscalYear?: number; Status?: string }) => {
  const query = new URLSearchParams();
  if (params?.FiscalYear) query.append('FiscalYear', String(params.FiscalYear));
  if (params?.Status) query.append('Status', params.Status);
  const qs = query.toString();
  const data = await send<{ Items: NeedsAssessmentSummary[] }>(`${baseUrl}/assessments`, qs ? `?${qs}` : '', token, { method: 'GET' });
  return data.Items ?? [];
};

export const fetchAssessmentDetail = (id: string, token: string) =>
  send<NeedsAssessmentDetail>(`${baseUrl}/assessments`, `/${id}`, token, { method: 'GET' });

export const createAssessmentFromAnalysis = (token: string, fiscalYear: number) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, '', token, { method: 'POST' }, { FiscalYear: fiscalYear });

export const createManualAssessment = (token: string, fiscalYear: number, items: NeedsAssessmentItem[]) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, '', token, { method: 'POST' }, { FiscalYear: fiscalYear, Items: items });

export const updateAssessment = (id: string, token: string, payload: { Remarks?: string }) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, `/${id}`, token, { method: 'PUT' }, payload);

export const submitAssessmentDecision = (id: string, token: string, decision: 'Endorsed' | 'Rejected', remarks?: string) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, `/${id}/decision`, token, { method: 'POST' }, { Decision: decision, Remarks: remarks });

// ── Assessment Items API ──────────────────────
export const addAssessmentItem = (id: string, token: string, item: { Description: string; Quantity: number; Unit: string; Priority: string; ProcurementType: string; SourceUnits?: Array<{ unitId: string; unitName: string }> }) =>
  send<NeedsAssessmentItem>(`${baseUrl}/assessments`, `/${id}/items`, token, { method: 'POST' }, item);

export const updateAssessmentItem = (id: string, itemId: string, token: string, item: { Description?: string; Quantity?: number; Unit?: string; Priority?: string; ProcurementType?: string; SourceUnits?: Array<{ unitId: string; unitName: string }> }) =>
  send<NeedsAssessmentItem>(`${baseUrl}/assessments`, `/${id}/items/${itemId}`, token, { method: 'PUT' }, item);

export const deleteAssessmentItem = (id: string, itemId: string, token: string) =>
  send<{ Message: string }>(`${baseUrl}/assessments`, `/${id}/items/${itemId}`, token, { method: 'DELETE' });

export const carryForwardNeeds = (id: string, token: string, sourceFiscalYear: number) =>
  send<{ Message: string; Count: number }>(`${baseUrl}/assessments`, `/${id}/carry-forward`, token, { method: 'POST' }, { SourceFiscalYear: sourceFiscalYear });
