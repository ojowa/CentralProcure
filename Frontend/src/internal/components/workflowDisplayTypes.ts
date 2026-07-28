export type WorkflowPhaseDisplayItem = {
  PhaseKey: string;
  PhaseLabel: string;
  Sequence: number;
  Color: string;
  Status: string;
};

export type WorkflowRuntimeDisplay = {
  CurrentStageKey: string;
  CurrentStageTitle: string;
  CurrentPhaseKey: string;
  CurrentPhaseLabel: string;
  Phases: WorkflowPhaseDisplayItem[];
};

export type WorkflowRuntimeWithDisplay = {
  CurrentStageKey: string;
  CurrentStageTitle?: string | null;
  CurrentPhaseKey?: string | null;
  Display?: WorkflowRuntimeDisplay | null;
};
