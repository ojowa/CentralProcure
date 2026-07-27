import {
  WorkflowConfiguration,
  WorkflowRoleTaskCreateRequest,
  WorkflowStageUpdateRequest,
  WorkflowThresholdCreateRequest,
  WorkflowThresholdUpdateRequest,
  WorkflowTransitionCreateRequest
} from '../types/internal';
import { serviceBaseUrls } from './moduleService';

const baseUrl = `${serviceBaseUrls.workflow}/api/config/workflows`;

const parsePayload = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const parseResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await parsePayload(response);

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string; ErrorMessage?: string } | null)?.message ||
          (payload as { message?: string; error?: string; ErrorMessage?: string } | null)?.error ||
          (payload as { message?: string; error?: string; ErrorMessage?: string } | null)?.ErrorMessage;
    throw new Error(message || fallbackMessage);
  }

  return payload as T;
};

const buildHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

export const fetchWorkflowConfiguration = async (token: string): Promise<WorkflowConfiguration> => {
  const response = await fetch(baseUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseResponse<unknown>(response, 'Unable to load workflow configuration.');

  const stages = Array.isArray(data)
    ? data
    : (data as Record<string, unknown>)?.Stages ?? [];

  return {
    Title: 'Workflow Configuration',
    Summary: 'System workflow configuration',
    Stages: stages as WorkflowConfiguration['Stages'],
    Transitions: ((data as Record<string, unknown>)?.Transitions as WorkflowConfiguration['Transitions']) ?? [],
    RoleTasks: ((data as Record<string, unknown>)?.RoleTasks as WorkflowConfiguration['RoleTasks']) ?? [],
    Thresholds: ((data as Record<string, unknown>)?.Thresholds as WorkflowConfiguration['Thresholds']) ?? [],
    Roles: ((data as Record<string, unknown>)?.Roles as WorkflowConfiguration['Roles']) ?? [],
    GovernanceBodies: ((data as Record<string, unknown>)?.GovernanceBodies as WorkflowConfiguration['GovernanceBodies']) ?? []
  } as WorkflowConfiguration;
};

export const createWorkflowThreshold = async (token: string, request: WorkflowThresholdCreateRequest) => {
  const response = await fetch(`${baseUrl}/thresholds`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token),
    body: JSON.stringify(request)
  });

  return parseResponse<WorkflowConfiguration['Thresholds'][number]>(response, 'Unable to create workflow threshold.');
};

export const updateWorkflowThreshold = async (token: string, thresholdId: string, request: WorkflowThresholdUpdateRequest) => {
  const response = await fetch(`${baseUrl}/thresholds/${thresholdId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildHeaders(token),
    body: JSON.stringify(request)
  });

  return parseResponse<WorkflowConfiguration['Thresholds'][number]>(response, 'Unable to update workflow threshold.');
};

export const deleteWorkflowThreshold = async (token: string, thresholdId: string) => {
  const response = await fetch(`${baseUrl}/thresholds/${thresholdId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await parsePayload(response);
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(message || 'Unable to delete workflow threshold.');
  }
};

export const updateWorkflowStage = async (token: string, stageKey: string, request: WorkflowStageUpdateRequest) => {
  const response = await fetch(`${baseUrl}/stages/${stageKey}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildHeaders(token),
    body: JSON.stringify(request)
  });

  return parseResponse(response, 'Unable to update workflow stage.');
};

export const createWorkflowTransition = async (token: string, request: WorkflowTransitionCreateRequest) => {
  const response = await fetch(`${baseUrl}/transitions`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token),
    body: JSON.stringify(request)
  });

  return parseResponse(response, 'Unable to create workflow transition.');
};

export const deleteWorkflowTransition = async (token: string, transitionId: string) => {
  const response = await fetch(`${baseUrl}/transitions/${transitionId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await parsePayload(response);
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(message || 'Unable to delete workflow transition.');
  }
};

export const createWorkflowRoleTask = async (token: string, request: WorkflowRoleTaskCreateRequest) => {
  const response = await fetch(`${baseUrl}/role-tasks`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token),
    body: JSON.stringify(request)
  });

  return parseResponse(response, 'Unable to create workflow role task.');
};

export const deleteWorkflowRoleTask = async (token: string, roleTaskId: string) => {
  const response = await fetch(`${baseUrl}/role-tasks/${roleTaskId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await parsePayload(response);
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(message || 'Unable to delete workflow role task.');
  }
};
