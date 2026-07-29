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
  return send<{ Collections: NeedsCollectionSummary[]; TotalCount: number }>(baseUrl, qs ? `?${qs}` : '', token, { method: 'GET' });
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

// ── Assessment API ────────────────────────────
export const fetchAssessments = (token: string, params?: { FiscalYear?: number; Status?: string }) => {
  const query = new URLSearchParams();
  if (params?.FiscalYear) query.append('FiscalYear', String(params.FiscalYear));
  if (params?.Status) query.append('Status', params.Status);
  const qs = query.toString();
  return send<NeedsAssessmentSummary[]>(`${baseUrl}/assessments`, qs ? `?${qs}` : '', token, { method: 'GET' });
};

export const fetchAssessmentDetail = (id: string, token: string) =>
  send<NeedsAssessmentDetail>(`${baseUrl}/assessments`, `/${id}`, token, { method: 'GET' });

export const createAssessmentFromAnalysis = (token: string, fiscalYear: number) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, '', token, { method: 'POST' }, { FiscalYear: fiscalYear });

export const updateAssessment = (id: string, token: string, payload: { Remarks?: string }) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, `/${id}`, token, { method: 'PUT' }, payload);

export const submitAssessmentDecision = (id: string, token: string, decision: 'Endorsed' | 'Rejected', remarks?: string) =>
  send<NeedsAssessmentSummary>(`${baseUrl}/assessments`, `/${id}/decision`, token, { method: 'POST' }, { Decision: decision, Remarks: remarks });
