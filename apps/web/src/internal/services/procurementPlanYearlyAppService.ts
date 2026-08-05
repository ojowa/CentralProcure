import type {
  YearlyAppCreateRequest,
  YearlyAppDetail,
  YearlyAppDetailsResponse,
  YearlyAppRecommendationResponse,
  YearlyAppSummary,
  YearlyAppUpdateRequest
} from './procurementPlanService.shared';
import { jsonHeaders, parseResponse, yearlyAppBaseUrl } from './procurementPlanService.shared';

export const fetchYearlyApps = async (token: string): Promise<YearlyAppSummary[]> => {
  const response = await fetch(yearlyAppBaseUrl, { headers: { Authorization: `Bearer ${token}` } });
  const data = await parseResponse<{ Items: YearlyAppSummary[]; TotalCount?: number; Page?: number; PageSize?: number }>(response);
  return data.Items ?? [];
};

export const fetchYearlyAppDetails = async (token: string, yearlyAppId: string): Promise<YearlyAppDetailsResponse> => {
  const response = await fetch(`${yearlyAppBaseUrl}/${yearlyAppId}`, { headers: { Authorization: `Bearer ${token}` } });
  return parseResponse<YearlyAppDetailsResponse>(response);
};

export const recommendYearlyAppForApproval = async (
  token: string,
  yearlyAppId: string
): Promise<YearlyAppRecommendationResponse> => {
  const response = await fetch(`${yearlyAppBaseUrl}/${yearlyAppId}/recommend-for-approval`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  return parseResponse<YearlyAppRecommendationResponse>(response);
};

export const createYearlyApp = async (token: string, payload: YearlyAppCreateRequest): Promise<YearlyAppDetail> => {
  const response = await fetch(yearlyAppBaseUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parseResponse<YearlyAppDetail>(response);
};

export const updateYearlyApp = async (
  token: string,
  yearlyAppId: string,
  payload: YearlyAppUpdateRequest
): Promise<YearlyAppDetail> => {
  const response = await fetch(`${yearlyAppBaseUrl}/${yearlyAppId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return parseResponse<YearlyAppDetail>(response);
};

export const submitYearlyAppForApproval = async (
  token: string,
  yearlyAppId: string
): Promise<YearlyAppRecommendationResponse> => {
  const response = await fetch(`${yearlyAppBaseUrl}/${yearlyAppId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...jsonHeaders() },
    credentials: 'include'
  });
  return parseResponse<YearlyAppRecommendationResponse>(response);
};
