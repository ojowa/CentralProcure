import type {
  WorkflowConfiguration,
  WorkflowConfigurationRoleTask,
  WorkflowConfigurationStage,
  WorkflowConfigurationThreshold
} from '../../types/internal';
import {
  createWorkflowRoleTask,
  createWorkflowThreshold,
  createWorkflowTransition,
  deleteWorkflowRoleTask,
  deleteWorkflowThreshold,
  deleteWorkflowTransition,
  updateWorkflowStage,
  updateWorkflowThreshold
} from '../../services/workflowConfigurationService';
import { EMPTY_GUID, RoleTaskFormState, StageFormState, ThresholdFormState, TransitionFormState } from './shared';

type Params = {
  token?: string | null;
  setIsSaving: (value: boolean) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
  selectedStage: WorkflowConfigurationStage | null;
  stageForm: StageFormState;
  replaceStage: (updated: WorkflowConfigurationStage) => void;
  selectedThreshold: WorkflowConfigurationThreshold | null;
  thresholdForm: ThresholdFormState;
  replaceThreshold: (updated: WorkflowConfigurationThreshold) => void;
  addThreshold: (created: WorkflowConfigurationThreshold) => void;
  removeThreshold: (thresholdId: string) => void;
  setSelectedThresholdId: (value: string) => void;
  transitionForm: TransitionFormState;
  addTransition: (created: WorkflowConfiguration['Transitions'][number]) => void;
  removeTransition: (transitionId: string) => void;
  setTransitionForm: (value: TransitionFormState) => void;
  roleTaskForm: RoleTaskFormState;
  addRoleTask: (created: WorkflowConfigurationRoleTask) => void;
  removeRoleTask: (roleTaskId: string) => void;
  selectedRoleFilter: string;
  setRoleTaskForm: (value: RoleTaskFormState) => void;
};

export const useWorkflowConfigurationActions = ({
  token,
  setIsSaving,
  setActionError,
  setActionMessage,
  selectedStage,
  stageForm,
  replaceStage,
  selectedThreshold,
  thresholdForm,
  replaceThreshold,
  addThreshold,
  removeThreshold,
  setSelectedThresholdId,
  transitionForm,
  addTransition,
  removeTransition,
  setTransitionForm,
  roleTaskForm,
  addRoleTask,
  removeRoleTask,
  selectedRoleFilter,
  setRoleTaskForm
}: Params) => {
  const handleStageSave = async () => {
    if (!token || !selectedStage) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      const updated = (await updateWorkflowStage(token, selectedStage.StageKey, {
        PhaseKey: stageForm.phaseKey,
        StageTitle: stageForm.stageTitle,
        StageDescription: stageForm.stageDescription,
        SequenceNo: Number(stageForm.sequenceNo),
        PrimaryOwnerRole: stageForm.primaryOwnerRole,
        PpaReference: stageForm.ppaReference,
        IsDecisionGate: stageForm.isDecisionGate,
        IsStart: stageForm.isStart,
        IsTerminal: stageForm.isTerminal
      })) as WorkflowConfigurationStage;
      replaceStage(updated);
      setActionMessage('Stage updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update stage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThresholdSave = async () => {
    if (!token || !selectedThreshold) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      const updated = (await updateWorkflowThreshold(token, selectedThreshold.ThresholdId, {
        ProcurementType: thresholdForm.procurementType || null,
        MinAmount: Number(thresholdForm.minAmount),
        MaxAmount: thresholdForm.maxAmount ? Number(thresholdForm.maxAmount) : null,
        ApprovalRoute: thresholdForm.approvalRoute,
        ApprovalAuthorityCode: thresholdForm.approvalAuthorityCode,
        ApprovalAuthorityLabel: thresholdForm.approvalAuthorityLabel,
        RequiresCgisApproval: thresholdForm.requiresCgisApproval,
        Status: thresholdForm.status,
        Notes: thresholdForm.notes,
        RequiresBoard: thresholdForm.requiresBoard,
        RequiresBpp: thresholdForm.requiresBpp,
        GovernanceBodyId: thresholdForm.governanceBodyId || (selectedThreshold.GovernanceBodyId ? EMPTY_GUID : null)
      })) as WorkflowConfigurationThreshold;
      replaceThreshold(updated);
      setActionMessage('Threshold updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update threshold.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThresholdCreate = async () => {
    if (!token) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      const created = (await createWorkflowThreshold(token, {
        ProcurementType: thresholdForm.procurementType || null,
        MinAmount: Number(thresholdForm.minAmount),
        MaxAmount: thresholdForm.maxAmount ? Number(thresholdForm.maxAmount) : null,
        ApprovalRoute: thresholdForm.approvalRoute,
        ApprovalAuthorityCode: thresholdForm.approvalAuthorityCode,
        ApprovalAuthorityLabel: thresholdForm.approvalAuthorityLabel,
        RequiresCgisApproval: thresholdForm.requiresCgisApproval,
        Status: thresholdForm.status,
        Notes: thresholdForm.notes,
        RequiresBoard: thresholdForm.requiresBoard,
        RequiresBpp: thresholdForm.requiresBpp,
        GovernanceBodyId: thresholdForm.governanceBodyId || null
      })) as WorkflowConfigurationThreshold;
      addThreshold(created);
      setSelectedThresholdId(created.ThresholdId);
      setActionMessage('Threshold created.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create threshold.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThresholdDelete = async () => {
    if (!token || !selectedThreshold) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      await deleteWorkflowThreshold(token, selectedThreshold.ThresholdId);
      removeThreshold(selectedThreshold.ThresholdId);
      setActionMessage('Threshold deleted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete threshold.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransitionCreate = async () => {
    if (!token) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      const created = await createWorkflowTransition(token, {
        FromStageKey: transitionForm.fromStageKey,
        ToStageKey: transitionForm.toStageKey,
        TransitionCondition: transitionForm.transitionCondition
      });
      addTransition(created as WorkflowConfiguration['Transitions'][number]);
      setTransitionForm({ fromStageKey: '', toStageKey: '', transitionCondition: '' });
      setActionMessage('Transition added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create transition.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransitionDelete = async (transitionId: string) => {
    if (!token) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      await deleteWorkflowTransition(token, transitionId);
      removeTransition(transitionId);
      setActionMessage('Transition removed.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete transition.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleTaskCreate = async () => {
    if (!token) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      const created = (await createWorkflowRoleTask(token, {
        RoleKey: roleTaskForm.roleKey,
        DisplayName: roleTaskForm.displayName,
        StageKey: roleTaskForm.stageKey,
        TaskDescription: roleTaskForm.taskDescription,
        ExpectedOutcome: roleTaskForm.expectedOutcome
      })) as WorkflowConfigurationRoleTask;
      addRoleTask(created);
      setRoleTaskForm({
        roleKey: selectedRoleFilter || roleTaskForm.roleKey,
        displayName: '',
        stageKey: '',
        taskDescription: '',
        expectedOutcome: ''
      });
      setActionMessage('Role task added.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create role task.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleTaskDelete = async (roleTaskId: string) => {
    if (!token) {
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      setActionMessage(null);
      await deleteWorkflowRoleTask(token, roleTaskId);
      removeRoleTask(roleTaskId);
      setActionMessage('Role task removed.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete role task.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    handleStageSave,
    handleThresholdSave,
    handleThresholdCreate,
    handleThresholdDelete,
    handleTransitionCreate,
    handleTransitionDelete,
    handleRoleTaskCreate,
    handleRoleTaskDelete
  };
};
