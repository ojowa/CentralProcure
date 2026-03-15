import type { InternalModule } from '../types/internal';
import { fetchWorkflowConfiguration } from '../services/workflowConfigurationService';
import { WorkflowConfigurationOverviewTab } from './workflowConfiguration/WorkflowConfigurationOverviewTab';
import { WorkflowConfigurationRoleTasksTab } from './workflowConfiguration/WorkflowConfigurationRoleTasksTab';
import { WorkflowConfigurationRoutingTab } from './workflowConfiguration/WorkflowConfigurationRoutingTab';
import { WorkflowConfigurationStagesTab } from './workflowConfiguration/WorkflowConfigurationStagesTab';
import { WorkflowConfigurationThresholdsTab } from './workflowConfiguration/WorkflowConfigurationThresholdsTab';
import { formatCurrency, TabKey, toTitle } from './workflowConfiguration/shared';
import { useWorkflowConfigurationActions } from './workflowConfiguration/useWorkflowConfigurationActions';
import { useWorkflowConfigurationState } from './workflowConfiguration/useWorkflowConfigurationState';

type Props = {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  token?: string | null;
};

export const WorkflowConfigurationModulePage = ({ module, moduleData, moduleError, token }: Props) => {
  const state = useWorkflowConfigurationState({
    moduleData,
    token,
    fetchConfig: fetchWorkflowConfiguration
  });

  const actions = useWorkflowConfigurationActions({
    token,
    setIsSaving: state.setIsSaving,
    setActionError: state.setActionError,
    setActionMessage: state.setActionMessage,
    selectedStage: state.selectedStage,
    stageForm: state.stageForm,
    replaceStage: state.replaceStage,
    selectedThreshold: state.selectedThreshold,
    thresholdForm: state.thresholdForm,
    replaceThreshold: state.replaceThreshold,
    addThreshold: state.addThreshold,
    removeThreshold: state.removeThreshold,
    setSelectedThresholdId: state.setSelectedThresholdId,
    transitionForm: state.transitionForm,
    addTransition: state.addTransition,
    removeTransition: state.removeTransition,
    setTransitionForm: state.setTransitionForm,
    roleTaskForm: state.roleTaskForm,
    addRoleTask: state.addRoleTask,
    removeRoleTask: state.removeRoleTask,
    selectedRoleFilter: state.selectedRoleFilter,
    setRoleTaskForm: state.setRoleTaskForm
  });

  return (
    <section className="admin-hub">
      <div className="admin-hero">
        <div>
          <div className="admin-kicker">System Administration</div>
          <h2>{module.title}</h2>
          <p>{state.config?.Summary ?? module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{module.microservice}</span>
            <span className="admin-tag">{state.stages.length} stages</span>
            <span className="admin-tag">{state.thresholds.length} thresholds</span>
          </div>
        </div>
        <div className="admin-metrics">
          <div className="admin-metric">
            <strong>{state.stages.filter((stage) => stage.IsDecisionGate).length}</strong>
            <span>Decision gates</span>
          </div>
          <div className="admin-metric">
            <strong>{state.thresholds.filter((threshold) => threshold.RequiresBpp).length}</strong>
            <span>BPP bands</span>
          </div>
          <div className="admin-metric">
            <strong>{state.thresholds.filter((threshold) => threshold.RequiresCgisApproval).length}</strong>
            <span>CGIS bands</span>
          </div>
        </div>
      </div>

      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}
      {state.actionError ? <div className="portal-alert">{state.actionError}</div> : null}
      {state.actionMessage ? <div className="plan-success">{state.actionMessage}</div> : null}

      <div className="workflow-config-tabs">
        {[
          ['overview', 'Overview'],
          ['thresholds', 'Thresholds'],
          ['stages', 'Stages'],
          ['routing', 'Routing'],
          ['tasks', 'Role Tasks']
        ].map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={state.activeTab === tabId ? 'active' : ''}
            onClick={() => state.setActiveTab(tabId as TabKey)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="workflow-config-refresh"
          onClick={state.refreshConfig}
          disabled={state.isRefreshing || !token}
        >
          {state.isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {state.activeTab === 'overview' ? (
        <WorkflowConfigurationOverviewTab
          phaseCounts={state.phaseCounts}
          transitionsCount={state.transitions.length}
          roleTasksCount={state.roleTasks.length}
          boardBandCount={state.thresholds.filter((threshold) => threshold.RequiresBoard).length}
          governanceBodyCount={state.governanceBodies.length}
          toTitle={toTitle}
        />
      ) : null}

      {state.activeTab === 'thresholds' ? (
        <WorkflowConfigurationThresholdsTab
          thresholds={state.thresholds}
          selectedThresholdId={state.selectedThresholdId}
          setSelectedThresholdId={state.setSelectedThresholdId}
          thresholdForm={state.thresholdForm}
          setThresholdForm={state.setThresholdForm}
          governanceBodies={state.governanceBodies}
          formatCurrency={formatCurrency}
          isSaving={state.isSaving}
          selectedThreshold={state.selectedThreshold}
          onSave={actions.handleThresholdSave}
          onCreate={actions.handleThresholdCreate}
          onDelete={actions.handleThresholdDelete}
        />
      ) : null}

      {state.activeTab === 'stages' ? (
        <WorkflowConfigurationStagesTab
          stages={state.stages}
          selectedStageKey={state.selectedStageKey}
          setSelectedStageKey={state.setSelectedStageKey}
          stageForm={state.stageForm}
          setStageForm={state.setStageForm}
          roles={state.roles}
          toTitle={toTitle}
          isSaving={state.isSaving}
          selectedStage={state.selectedStage}
          onSave={actions.handleStageSave}
        />
      ) : null}

      {state.activeTab === 'routing' ? (
        <WorkflowConfigurationRoutingTab
          transitions={state.transitions}
          stageLookup={state.stageLookup}
          stages={state.stages}
          transitionForm={state.transitionForm}
          setTransitionForm={state.setTransitionForm}
          isSaving={state.isSaving}
          onCreate={actions.handleTransitionCreate}
          onDelete={actions.handleTransitionDelete}
        />
      ) : null}

      {state.activeTab === 'tasks' ? (
        <WorkflowConfigurationRoleTasksTab
          filteredRoleTasks={state.filteredRoleTasks}
          stageLookup={state.stageLookup}
          stages={state.stages}
          selectedRoleFilter={state.selectedRoleFilter}
          setSelectedRoleFilter={state.setSelectedRoleFilter}
          roles={state.roles}
          roleTaskForm={state.roleTaskForm}
          setRoleTaskForm={state.setRoleTaskForm}
          toTitle={toTitle}
          isSaving={state.isSaving}
          onCreate={actions.handleRoleTaskCreate}
          onDelete={actions.handleRoleTaskDelete}
        />
      ) : null}
    </section>
  );
};
