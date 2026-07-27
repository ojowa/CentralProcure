import type {
  WorkflowActionSnapshotResponse,
  WorkflowRuntimeHistoryEntry,
  WorkflowRuntimeSnapshot
} from '../types/internal';
import { serviceBaseUrls } from './moduleService';

const buildHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`
});

const parseBody = async (response: Response): Promise<unknown> => {
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

const parseResponse = async <T>(response: Response, fallbackError: string): Promise<T> => {
  const payload = await parseBody(response);

  if (!response.ok) {
    const messageFromPayload =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error;
    throw new Error(messageFromPayload || fallbackError);
  }

  return payload as T;
};

export const fetchWorkflowActionSnapshot = async (
  token: string,
  entityType: string,
  entityId: string
): Promise<WorkflowActionSnapshotResponse> => {
  const response = await fetch(
    `${serviceBaseUrls.workflow}/api/workflow-actions/${encodeURIComponent(entityType)}/${entityId}`,
    {
      headers: buildHeaders(token)
    }
  );

  const data = await parseResponse<{
    EntityType?: string;
    EntityId?: string;
    CurrentStageKey?: string;
    CurrentStageTitle?: string;
    AvailableTransitions?: WorkflowActionSnapshotResponse['Actions'];
  }>(response, 'Unable to load workflow action snapshot.');

  return {
    EntityType: data.EntityType ?? entityType,
    EntityId: data.EntityId ?? entityId,
    CurrentStageKey: data.CurrentStageKey ?? '',
    CurrentStageTitle: data.CurrentStageTitle ?? '',
    RoleKey: '',
    Actions: data.AvailableTransitions ?? [],
    Authority: null,
    RouteDecision: null
  } as WorkflowActionSnapshotResponse;
};

export const fetchWorkflowRuntime = async (
  token: string,
  entityType: string,
  entityId: string
): Promise<WorkflowRuntimeSnapshot> => {
  const response = await fetch(
    `${serviceBaseUrls.workflow}/api/workflow-runtime/${encodeURIComponent(entityType)}/${entityId}`,
    {
      headers: buildHeaders(token)
    }
  );

  return parseResponse<WorkflowRuntimeSnapshot>(response, 'Unable to load workflow runtime.');
};

export const fetchWorkflowRuntimeHistory = async (
  token: string,
  entityType: string,
  entityId: string
): Promise<WorkflowRuntimeHistoryEntry[]> => {
  const response = await fetch(
    `${serviceBaseUrls.workflow}/api/workflow-runtime/${encodeURIComponent(entityType)}/${entityId}/history`,
    {
      headers: buildHeaders(token)
    }
  );

  return parseResponse<WorkflowRuntimeHistoryEntry[]>(response, 'Unable to load workflow history.');
};
