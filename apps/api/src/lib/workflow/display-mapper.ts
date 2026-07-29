import type { WorkflowPhaseDisplayItem, WorkflowRuntimeDisplay, WorkflowRuntimeSnapshot } from './types.js';

interface PhaseDef {
  id: string;
  title: string;
  sequence: number;
}

const PHASES: PhaseDef[] = [
  { id: 'app_planning', title: 'APP Planning', sequence: 1 },
  { id: 'threshold_control', title: 'Threshold Control', sequence: 2 },
  { id: 'procurement_execution', title: 'Procurement Execution', sequence: 3 },
  { id: 'post_award', title: 'Post-Award', sequence: 4 },
  { id: 'review_and_oversight', title: 'Review and Oversight', sequence: 5 },
];

const StagePhaseMap: Record<string, string> = {
  needs_collection: 'app_planning',
  needs_analysis: 'app_planning',
  needs_assessment: 'app_planning',
  department_need_capture: 'app_planning',
  department_head_endorsement: 'app_planning',
  budget_allocation_and_confirmation: 'app_planning',
  comptroller_procurement_review: 'app_planning',
  planning_committee_review: 'app_planning',
  app_approval: 'app_planning',
  procurement_initiation: 'threshold_control',
  threshold_resolution: 'threshold_control',
  method_validation: 'threshold_control',
  solicitation: 'procurement_execution',
  bid_opening: 'procurement_execution',
  evaluation: 'procurement_execution',
  tenders_board_review: 'procurement_execution',
  accounting_officer_review: 'procurement_execution',
  bpp_no_objection: 'procurement_execution',
  award_and_publication: 'post_award',
  contract_execution: 'post_award',
  inspection_and_payment: 'post_award',
  closeout_and_audit: 'review_and_oversight',
  administrative_review: 'review_and_oversight',
};

const PhaseColors: Record<string, string> = {
  app_planning: '#3b82f6',
  threshold_control: '#f59e0b',
  procurement_execution: '#a855f7',
  post_award: '#10b981',
  review_and_oversight: '#64748b',
};

export function mapStageToPhase(stageKey: string): string {
  return StagePhaseMap[stageKey.toLowerCase()] ?? 'review_and_oversight';
}

export function getPhaseColor(phaseKey: string): string {
  return PhaseColors[phaseKey.toLowerCase()] ?? '#64748b';
}

function resolvePhaseStatus(
  orderedPhases: PhaseDef[],
  currentPhaseKey: string,
  phaseKey: string,
  currentStageKey: string,
): string {
  if (
    currentStageKey.toLowerCase() === 'administrative_review' &&
    phaseKey.toLowerCase() === 'review_and_oversight'
  ) {
    return 'active';
  }

  const currentIndex = orderedPhases.findIndex(
    (p) => p.id.toLowerCase() === currentPhaseKey.toLowerCase(),
  );
  const phaseIndex = orderedPhases.findIndex(
    (p) => p.id.toLowerCase() === phaseKey.toLowerCase(),
  );

  if (currentIndex < 0 || phaseIndex < 0) return 'pending';

  if (phaseIndex < currentIndex) return 'completed';
  return phaseIndex === currentIndex ? 'active' : 'pending';
}

export function getPhaseStatus(
  currentStageKey: string,
  targetStageKey: string,
): string {
  const currentPhaseKey = mapStageToPhase(currentStageKey);
  const targetPhaseKey = mapStageToPhase(targetStageKey);
  return resolvePhaseStatus(PHASES, currentPhaseKey, targetPhaseKey, currentStageKey);
}

export function buildDisplay(snapshot: WorkflowRuntimeSnapshot): WorkflowRuntimeDisplay;
export function buildDisplay(
  currentStageKey: string,
  currentStageTitle: string,
  currentPhaseKey?: string,
): WorkflowRuntimeDisplay;
export function buildDisplay(
  ...args:
    | [WorkflowRuntimeSnapshot]
    | [string, string, string?]
): WorkflowRuntimeDisplay {
  let currentStageKey: string;
  let currentStageTitle: string;
  let currentPhaseKey: string | undefined;

  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const snapshot = args[0] as WorkflowRuntimeSnapshot;
    currentStageKey = snapshot.current_stage_key;
    currentStageTitle = snapshot.current_stage_title;
    currentPhaseKey = snapshot.current_phase_key;
  } else {
    currentStageKey = args[0] as string;
    currentStageTitle = args[1] as string;
    currentPhaseKey = args[2] as string | undefined;
  }

  const resolvedPhaseKey =
    currentPhaseKey && currentPhaseKey.trim()
      ? currentPhaseKey
      : mapStageToPhase(currentStageKey);

  const orderedPhases = [...PHASES].sort((a, b) => a.sequence - b.sequence);

  const phases: WorkflowPhaseDisplayItem[] = orderedPhases.map((phase) => ({
    phase_key: phase.id,
    phase_label: phase.title,
    sequence: phase.sequence,
    color: getPhaseColor(phase.id),
    status: resolvePhaseStatus(orderedPhases, resolvedPhaseKey, phase.id, currentStageKey),
  }));

  const currentPhase =
    phases.find((p) => p.phase_key.toLowerCase() === resolvedPhaseKey.toLowerCase()) ?? {
      phase_key: resolvedPhaseKey,
      phase_label: resolvedPhaseKey,
      sequence: 0,
      color: '#64748b',
      status: 'active',
    };

  return {
    current_stage_key: currentStageKey,
    current_stage_title: currentStageTitle,
    current_phase_key: resolvedPhaseKey,
    current_phase_label: currentPhase.phase_label,
    phases,
  };
}
