import { useEffect, useMemo, useState } from 'react';
import type {
  WorkflowConfiguration,
  WorkflowConfigurationRoleTask,
  WorkflowConfigurationStage,
  WorkflowConfigurationThreshold
} from '../../types/internal';
import {
  RoleTaskFormState,
  StageFormState,
  TabKey,
  ThresholdFormState,
  TransitionFormState
} from './shared';

type Params = {
  moduleData: unknown;
  token?: string | null;
  fetchConfig: (token: string) => Promise<WorkflowConfiguration>;
};

export const useWorkflowConfigurationState = ({ moduleData, token, fetchConfig }: Params) => {
  const initialConfig = useMemo(() => {
    if (!moduleData || typeof moduleData !== 'object') {
      return null;
    }

    const candidate = moduleData as Partial<WorkflowConfiguration>;
    return Array.isArray(candidate.Stages) &&
      Array.isArray(candidate.Transitions) &&
      Array.isArray(candidate.RoleTasks) &&
      Array.isArray(candidate.Thresholds) &&
      Array.isArray(candidate.Roles)
      ? ({
          ...candidate,
          GovernanceBodies: Array.isArray(candidate.GovernanceBodies) ? candidate.GovernanceBodies : []
        } as WorkflowConfiguration)
      : null;
  }, [moduleData]);

  const [config, setConfig] = useState<WorkflowConfiguration | null>(initialConfig);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedStageKey, setSelectedStageKey] = useState('');
  const [selectedThresholdId, setSelectedThresholdId] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  const [stageForm, setStageForm] = useState<StageFormState>({
    phaseKey: '',
    stageTitle: '',
    stageDescription: '',
    sequenceNo: '',
    primaryOwnerRole: '',
    ppaReference: '',
    isDecisionGate: false,
    isStart: false,
    isTerminal: false
  });

  const [thresholdForm, setThresholdForm] = useState<ThresholdFormState>({
    procurementType: '',
    minAmount: '',
    maxAmount: '',
    approvalRoute: '',
    approvalAuthorityCode: '',
    approvalAuthorityLabel: '',
    status: 'Active',
    notes: '',
    requiresCgisApproval: false,
    requiresBoard: false,
    requiresBpp: false,
    governanceBodyId: ''
  });

  const [transitionForm, setTransitionForm] = useState<TransitionFormState>({
    fromStageKey: '',
    toStageKey: '',
    transitionCondition: ''
  });

  const [roleTaskForm, setRoleTaskForm] = useState<RoleTaskFormState>({
    roleKey: '',
    displayName: '',
    stageKey: '',
    taskDescription: '',
    expectedOutcome: ''
  });

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const refreshConfig = async () => {
    if (!token) {
      return;
    }

    try {
      setIsRefreshing(true);
      setActionError(null);
      const next = await fetchConfig(token);
      setConfig(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to refresh workflow configuration.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialConfig && token) {
      void refreshConfig();
    }
  }, [initialConfig, token]);

  const stages = useMemo(
    () => [...(config?.Stages ?? [])].sort((left, right) => left.SequenceNo - right.SequenceNo),
    [config]
  );
  const thresholds = useMemo(
    () => [...(config?.Thresholds ?? [])].sort((left, right) => left.MinAmount - right.MinAmount),
    [config]
  );
  const transitions = config?.Transitions ?? [];
  const roleTasks = config?.RoleTasks ?? [];
  const roles = useMemo(
    () =>
      [...(config?.Roles ?? [])]
        .filter((role) => role.IsActive)
        .sort((left, right) => left.RoleName.localeCompare(right.RoleName)),
    [config]
  );
  const governanceBodies = useMemo(
    () =>
      [...(config?.GovernanceBodies ?? [])]
        .filter((body) => body.IsActive)
        .sort((left, right) => left.BodyName.localeCompare(right.BodyName)),
    [config]
  );

  const stageLookup = useMemo(() => new Map(stages.map((stage) => [stage.StageKey, stage])), [stages]);
  const selectedStage = stages.find((stage) => stage.StageKey === selectedStageKey) ?? null;
  const selectedThreshold = thresholds.find((threshold) => threshold.ThresholdId === selectedThresholdId) ?? null;
  const filteredRoleTasks = selectedRoleFilter ? roleTasks.filter((task) => task.RoleKey === selectedRoleFilter) : roleTasks;

  useEffect(() => {
    if (stages.length && !selectedStageKey) {
      setSelectedStageKey(stages[0].StageKey);
    }
    if (thresholds.length && !selectedThresholdId) {
      setSelectedThresholdId(thresholds[0].ThresholdId);
    }
    if (roles.length && !selectedRoleFilter) {
      setSelectedRoleFilter(roles[0].RoleName);
    }
  }, [roles, selectedRoleFilter, selectedStageKey, selectedThresholdId, stages, thresholds]);

  useEffect(() => {
    if (!selectedStage) {
      return;
    }

    setStageForm({
      phaseKey: selectedStage.PhaseKey,
      stageTitle: selectedStage.StageTitle,
      stageDescription: selectedStage.StageDescription,
      sequenceNo: String(selectedStage.SequenceNo),
      primaryOwnerRole: selectedStage.PrimaryOwnerRole,
      ppaReference: selectedStage.PpaReference ?? '',
      isDecisionGate: selectedStage.IsDecisionGate,
      isStart: selectedStage.IsStart,
      isTerminal: selectedStage.IsTerminal
    });
  }, [selectedStage]);

  useEffect(() => {
    if (!selectedThreshold) {
      return;
    }

    setThresholdForm({
      procurementType: selectedThreshold.ProcurementType ?? '',
      minAmount: String(selectedThreshold.MinAmount),
      maxAmount: selectedThreshold.MaxAmount == null ? '' : String(selectedThreshold.MaxAmount),
      approvalRoute: selectedThreshold.ApprovalRoute,
      approvalAuthorityCode: selectedThreshold.ApprovalAuthorityCode,
      approvalAuthorityLabel: selectedThreshold.ApprovalAuthorityLabel,
      status: selectedThreshold.Status,
      notes: selectedThreshold.Notes ?? '',
      requiresCgisApproval: selectedThreshold.RequiresCgisApproval,
      requiresBoard: selectedThreshold.RequiresBoard,
      requiresBpp: selectedThreshold.RequiresBpp,
      governanceBodyId: selectedThreshold.GovernanceBodyId ?? ''
    });
  }, [selectedThreshold]);

  const replaceStage = (updated: WorkflowConfigurationStage) =>
    setConfig((current) =>
      current
        ? { ...current, Stages: current.Stages.map((stage) => (stage.StageKey === updated.StageKey ? updated : stage)) }
        : current
    );

  const replaceThreshold = (updated: WorkflowConfigurationThreshold) =>
    setConfig((current) =>
      current
        ? {
            ...current,
            Thresholds: current.Thresholds
              .map((threshold) => (threshold.ThresholdId === updated.ThresholdId ? updated : threshold))
              .sort((left, right) => left.MinAmount - right.MinAmount)
          }
        : current
    );

  const addThreshold = (created: WorkflowConfigurationThreshold) =>
    setConfig((current) =>
      current
        ? { ...current, Thresholds: [...current.Thresholds, created].sort((left, right) => left.MinAmount - right.MinAmount) }
        : current
    );

  const removeThreshold = (thresholdId: string) =>
    setConfig((current) =>
      current ? { ...current, Thresholds: current.Thresholds.filter((threshold) => threshold.ThresholdId !== thresholdId) } : current
    );

  const addTransition = (created: WorkflowConfiguration['Transitions'][number]) =>
    setConfig((current) => (current ? { ...current, Transitions: [...current.Transitions, created] } : current));

  const removeTransition = (transitionId: string) =>
    setConfig((current) =>
      current ? { ...current, Transitions: current.Transitions.filter((transition) => transition.TransitionId !== transitionId) } : current
    );

  const addRoleTask = (created: WorkflowConfigurationRoleTask) =>
    setConfig((current) => (current ? { ...current, RoleTasks: [...current.RoleTasks, created] } : current));

  const removeRoleTask = (roleTaskId: string) =>
    setConfig((current) =>
      current ? { ...current, RoleTasks: current.RoleTasks.filter((task) => task.RoleTaskId !== roleTaskId) } : current
    );

  const phaseCounts = stages.reduce<Record<string, number>>((accumulator, stage) => {
    accumulator[stage.PhaseKey] = (accumulator[stage.PhaseKey] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    config,
    isRefreshing,
    setIsRefreshing,
    isSaving,
    setIsSaving,
    activeTab,
    setActiveTab,
    actionError,
    setActionError,
    actionMessage,
    setActionMessage,
    selectedStageKey,
    setSelectedStageKey,
    selectedThresholdId,
    setSelectedThresholdId,
    selectedRoleFilter,
    setSelectedRoleFilter,
    stageForm,
    setStageForm,
    thresholdForm,
    setThresholdForm,
    transitionForm,
    setTransitionForm,
    roleTaskForm,
    setRoleTaskForm,
    refreshConfig,
    stages,
    thresholds,
    transitions,
    roleTasks,
    roles,
    governanceBodies,
    stageLookup,
    selectedStage,
    selectedThreshold,
    filteredRoleTasks,
    replaceStage,
    replaceThreshold,
    addThreshold,
    removeThreshold,
    addTransition,
    removeTransition,
    addRoleTask,
    removeRoleTask,
    phaseCounts
  };
};
