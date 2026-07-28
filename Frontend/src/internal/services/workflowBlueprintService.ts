import { WorkflowBlueprint } from '../types/internal';

const normalizeBasePath = (value: string): string => {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const APP_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '');

const API_ENDPOINT = `${APP_BASE_PATH}/api/workflow-blueprint`;

export const fetchWorkflowBlueprint = async (token: string): Promise<WorkflowBlueprint> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.ErrorMessage || payload?.message || 'Unable to load workflow blueprint.');
  }

  return {
    Title: 'Workflow Blueprint',
    Summary: 'System workflow configuration',
    ThresholdSource: '',
    CurrentRole: null,
    DatabaseTables: [],
    Phases: payload?.Phases ?? [],
    States: payload?.States ?? [],
    Transitions: payload?.Transitions ?? [],
    RoleTasks: payload?.RoleTasks ?? [],
    Thresholds: payload?.Thresholds ?? []
  } as WorkflowBlueprint;
};
