import { buildCsrfHeaders } from './internalAuthService';
import { send } from './moduleService';

export interface NeedAssessmentSummary {
  NeedAssessmentId: string;
  UnitId: string;
  UnitName: string;
  Title: string;
  FiscalYear: number;
  TotalEstimatedCost: number;
  Status: string;
  CreatedAt: string;
  CreatedBy: string;
}

export interface NeedAssessmentItemDetail {
  ItemId?: string;
  Description: string;
  Quantity: number;
  Unit: string;
  EstimatedUnitCost: number;
  EstimatedTotalCost?: number;
  Priority: string;
  ProcurementType: string;
}

export interface NeedAssessmentDetail extends NeedAssessmentSummary {
  Remarks?: string;
  SubmittedAt?: string;
  EndorsedAt?: string;
  EndorsedBy?: string;
  Items: NeedAssessmentItemDetail[];
  UpdatedAt: string;
}

export const fetchNeedAssessments = (token: string) => 
  send<NeedAssessmentSummary[]>('/needs-collection', token, { method: 'GET' });

export const fetchNeedAssessmentDetail = (id: string, token: string) => 
  send<NeedAssessmentDetail>(`/needs-collection/${id}`, token, { method: 'GET' });

export const createNeedAssessment = (token: string, payload: any) => 
  send<{ NeedAssessmentId: string; Message: string }>('/needs-collection', token, { method: 'POST' }, payload);

export const updateNeedAssessment = (id: string, token: string, payload: any) => 
  send<{ Message: string }>(`/needs-collection/${id}`, token, { method: 'PUT' }, payload);

export const submitNeedAssessmentDecision = (id: string, token: string, decision: string, remarks?: string) => 
  send<{ Status: string; Message: string }>(`/needs-collection/${id}/decision`, token, { method: 'POST' }, { Decision: decision, Remarks: remarks });
