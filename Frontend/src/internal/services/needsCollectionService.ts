import { send } from './moduleService.shared';
import { serviceBaseUrls } from './moduleService';

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

const baseUrl = `${serviceBaseUrls.workflow}/api/needs-collection`;

export const fetchNeedAssessments = (token: string) => 
  send<NeedAssessmentSummary[]>(baseUrl, '', token, { method: 'GET' });

export const fetchNeedAssessmentDetail = (id: string, token: string) => 
  send<NeedAssessmentDetail>(baseUrl, `/${id}`, token, { method: 'GET' });

export const createNeedAssessment = (token: string, payload: any) => 
  send<{ NeedAssessmentId: string; Message: string }>(baseUrl, '', token, { method: 'POST' }, payload);

export const updateNeedAssessment = (id: string, token: string, payload: any) => 
  send<{ Message: string }>(baseUrl, `/${id}`, token, { method: 'PUT' }, payload);

export const submitNeedAssessmentDecision = (id: string, token: string, decision: string, remarks?: string) => 
  send<{ Status: string; Message: string }>(baseUrl, `/${id}/decision`, token, { method: 'POST' }, { Decision: decision, Remarks: remarks });

export interface NeedAssessmentAuthorizedUser {
  InternalUserId: string;
  Email: string;
  FullName: string;
  RoleName: string;
  UnitName: string;
  AccessType: string;
}

export const fetchAuthorizedUsers = (token: string) =>
  send<NeedAssessmentAuthorizedUser[]>(baseUrl, '/authorized-users', token, { method: 'GET' });

export interface NeedAssessmentAnalysisResult {
  ItemDescription: string;
  ProcurementType: string;
  Unit: string;
  TotalQuantity: number;
  AvgUnitCost: number;
  TotalEstimatedCost: number;
  OccurrenceCount: number;
  PrioritySummary: string;
}

export const fetchNeedsAnalysis = (token: string, fiscalYear: number, unitId?: string, status: string = 'Endorsed') => {
  const query = new URLSearchParams({ fiscalYear: String(fiscalYear), status });
  if (unitId) query.append('unitId', unitId);
  return send<NeedAssessmentAnalysisResult[]>(baseUrl, `/analysis?${query.toString()}`, token, { method: 'GET' });
};
