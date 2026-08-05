// Authoritative module → dataset endpoint mapping.
// Each renderable internal module may expose a live dataset via `DatasetUrl`.
// Modules without a backing dataset (e.g. management/configuration/self-service
// workspaces) set `HasDataset: false` and rely on their own service calls.
const MODULE_DATASET_URLS: Record<string, string> = {
  'annual-procurement-plan': '/api/procurement-plans',
  'procurement-method-determination': '/api/procurement-methods/queue',
  'create-tender': '/api/tenders',
  'bid-opening-session': '/api/bid-opening/sessions',
  'assigned-tenders': '/api/evaluations/assigned-tenders/default',
  'technical-evaluation': '/api/evaluations/assigned-tenders/default',
  'financial-evaluation': '/api/evaluations/assigned-tenders/default',
  'evaluation-report': '/api/evaluation-reports',
  'tender-review': '/api/tenders-board-approvals/queue',
  'approval-rejection': '/api/tenders-board-approvals/queue',
  'tenders-board-approval': '/api/tenders-board-approvals/queue',
  'high-value-tenders': '/api/workflow-runtime/cgis-queue',
  'cgis-approval': '/api/workflow-runtime/cgis-queue',
  'final-approval': '/api/workflow-runtime/cgis-queue',
  'bpp-escalation': '/api/bpp-no-objections',
  'administrative-review': '/api/administrative-reviews',
  'contract-award': '/api/contracts/awards',
  'contract-management': '/api/contracts',
  'inspection-acceptance': '/api/inspections',
  'payment-tracking': '/api/payments',
  'budget-workspace': '/api/budget/dashboard',
  'audit-dashboard': '/api/audit',
  'audit-trail-viewer': '/api/audit',
  'compliance-reports': '/api/audit',
  'workflow-configuration': '/api/config/workflows',
  'system-monitoring': '/api/monitoring',
};

export const getModuleDataset = (moduleId: string): { datasetUrl: string | null; hasDataset: boolean } => {
  const url = MODULE_DATASET_URLS[moduleId] ?? null;
  return { datasetUrl: url, hasDataset: url !== null };
};

export const withModuleDataset = (module: Record<string, unknown>): Record<string, unknown> => {
  const moduleId = (module.ModuleId ?? module.module_id ?? '') as string;
  const { datasetUrl, hasDataset } = getModuleDataset(moduleId);
  return {
    ...module,
    DatasetUrl: datasetUrl,
    HasDataset: hasDataset,
  };
};