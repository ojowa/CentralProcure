export type WorkflowPhase = 'Planning' | 'Advert / Invitation / EOI / RFP' | 'Evaluation' | 'Approval' | 'Post-Award' | 'Unknown';

export interface PhaseInfo {
  phase: WorkflowPhase;
  color: string;
  displayLabel: string;
}

const PHASE_MAP: Record<string, WorkflowPhase> = {
  // Planning
  draft_requisition: 'Planning',
  needs_assessment: 'Planning',
  budget_reservation: 'Planning',
  department_need_capture: 'Planning',
  department_head_endorsement: 'Planning',
  budget_code_allocation: 'Planning',
  comptroller_procurement_review: 'Planning',
  planning_committee_review: 'Planning',
  app_approval: 'Planning',
  procurement_initiation: 'Planning',
  threshold_resolution: 'Planning',
  method_validation: 'Planning',
  
  // Advert / Invitation / EOI / RFP
  tender_preparation: 'Advert / Invitation / EOI / RFP',
  advertisement: 'Advert / Invitation / EOI / RFP',
  bid_submission: 'Advert / Invitation / EOI / RFP',
  solicitation: 'Advert / Invitation / EOI / RFP',
  
  // Evaluation
  bid_opening: 'Evaluation',
  technical_evaluation: 'Evaluation',
  financial_comparison: 'Evaluation',
  evaluation_report: 'Evaluation',
  evaluation: 'Evaluation',
  
  // Approval
  tenders_board_review: 'Approval',
  accounting_officer_approval: 'Approval',
  accounting_officer_review: 'Approval',
  bpp_no_objection: 'Approval',
  award_notification: 'Approval',
  
  // Post-Award
  contract_execution: 'Post-Award',
  inspection_and_payment: 'Post-Award',
  closeout_and_audit: 'Post-Award',
  archived: 'Post-Award',
  award_and_publication: 'Post-Award',
  administrative_review: 'Post-Award'
};

export const getWorkflowPhase = (stageKey?: string | null): WorkflowPhase => {
  if (!stageKey) return 'Unknown';
  return PHASE_MAP[stageKey.toLowerCase()] || 'Unknown';
};

export const getPhaseInfo = (phase: WorkflowPhase): PhaseInfo => {
  switch (phase) {
    case 'Planning':
      return { phase, color: '#3b82f6', displayLabel: 'Procurement Planning' };
    case 'Advert / Invitation / EOI / RFP':
      return { phase, color: '#f59e0b', displayLabel: 'Advert / Invitation / EOI / RFP' };
    case 'Evaluation':
      return { phase, color: '#a855f7', displayLabel: 'Bid Evaluation' };
    case 'Approval':
      return { phase, color: '#eab308', displayLabel: 'Governance Approval' };
    case 'Post-Award':
      return { phase, color: '#10b981', displayLabel: 'Contract & Closeout' };
    default:
      return { phase, color: '#6b7280', displayLabel: 'Unknown Phase' };
  }
};

export const getHumanStatus = (stageKey?: string | null, workflowStatus?: string | null): string => {
  if (!stageKey) return workflowStatus || 'Unknown';
  
  const key = stageKey.toLowerCase();
  
  // Custom mapping for technical keys to user-friendly status
  const friendlyMap: Record<string, string> = {
    contract_execution: 'Active Execution',
    inspection_and_payment: 'Awaiting Final Payment',
    closeout_and_audit: 'Ready for Archiving',
    bid_opening: 'Bid Opening Session',
    technical_evaluation: 'Under Technical Review',
    financial_comparison: 'Financial Comparison',
    bpp_no_objection: 'BPP Review Pending'
  };

  return friendlyMap[key] || workflowStatus || stageKey;
};
