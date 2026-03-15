export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export const toTitle = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(value);

export type TabKey = 'overview' | 'thresholds' | 'stages' | 'routing' | 'tasks';

export type StageFormState = {
  phaseKey: string;
  stageTitle: string;
  stageDescription: string;
  sequenceNo: string;
  primaryOwnerRole: string;
  ppaReference: string;
  isDecisionGate: boolean;
  isStart: boolean;
  isTerminal: boolean;
};

export type ThresholdFormState = {
  procurementType: string;
  minAmount: string;
  maxAmount: string;
  approvalRoute: string;
  approvalAuthorityCode: string;
  approvalAuthorityLabel: string;
  status: string;
  notes: string;
  requiresCgisApproval: boolean;
  requiresBoard: boolean;
  requiresBpp: boolean;
  governanceBodyId: string;
};

export type TransitionFormState = {
  fromStageKey: string;
  toStageKey: string;
  transitionCondition: string;
};

export type RoleTaskFormState = {
  roleKey: string;
  displayName: string;
  stageKey: string;
  taskDescription: string;
  expectedOutcome: string;
};
