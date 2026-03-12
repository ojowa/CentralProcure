import { useEffect, useMemo, useState } from 'react';
import type {
  InternalModule,
  WorkflowConfiguration,
  WorkflowConfigurationRoleTask,
  WorkflowConfigurationStage,
  WorkflowConfigurationThreshold
} from '../types/internal';
import {
  createWorkflowRoleTask,
  createWorkflowThreshold,
  createWorkflowTransition,
  deleteWorkflowRoleTask,
  deleteWorkflowThreshold,
  deleteWorkflowTransition,
  fetchWorkflowConfiguration,
  updateWorkflowStage,
  updateWorkflowThreshold
} from '../services/workflowConfigurationService';

const toTitle = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

type Props = {
  module: InternalModule;
  moduleData: unknown;
  moduleError: string | null;
  token?: string | null;
};

type TabKey = 'overview' | 'thresholds' | 'stages' | 'routing' | 'tasks';

export const WorkflowConfigurationModulePage = ({ module, moduleData, moduleError, token }: Props) => {
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
      ? (candidate as WorkflowConfiguration)
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

  const [stageForm, setStageForm] = useState({
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

  const [thresholdForm, setThresholdForm] = useState({
    procurementType: '',
    minAmount: '',
    maxAmount: '',
    approvalRoute: '',
    status: 'Active',
    notes: '',
    requiresBoard: false,
    requiresBpp: false
  });

  const [transitionForm, setTransitionForm] = useState({
    fromStageKey: '',
    toStageKey: '',
    transitionCondition: ''
  });

  const [roleTaskForm, setRoleTaskForm] = useState({
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
      const next = await fetchWorkflowConfiguration(token);
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
    () => [...(config?.Roles ?? [])].filter((role) => role.IsActive).sort((left, right) => left.RoleName.localeCompare(right.RoleName)),
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
      status: selectedThreshold.Status,
      notes: selectedThreshold.Notes ?? '',
      requiresBoard: selectedThreshold.RequiresBoard,
      requiresBpp: selectedThreshold.RequiresBpp
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
        Status: thresholdForm.status,
        Notes: thresholdForm.notes,
        RequiresBoard: thresholdForm.requiresBoard,
        RequiresBpp: thresholdForm.requiresBpp
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
        Status: thresholdForm.status,
        Notes: thresholdForm.notes,
        RequiresBoard: thresholdForm.requiresBoard,
        RequiresBpp: thresholdForm.requiresBpp
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

  return (
    <section className="admin-hub">
      <div className="admin-hero">
        <div>
          <div className="admin-kicker">System Administration</div>
          <h2>{module.title}</h2>
          <p>{config?.Summary ?? module.description}</p>
          <div className="admin-tags">
            <span className="admin-tag">{module.microservice}</span>
            <span className="admin-tag">{stages.length} stages</span>
            <span className="admin-tag">{thresholds.length} thresholds</span>
          </div>
        </div>
        <div className="admin-metrics">
          <div className="admin-metric">
            <strong>{stages.filter((stage) => stage.IsDecisionGate).length}</strong>
            <span>Decision gates</span>
          </div>
          <div className="admin-metric">
            <strong>{thresholds.filter((threshold) => threshold.RequiresBpp).length}</strong>
            <span>BPP bands</span>
          </div>
          <div className="admin-metric">
            <strong>{roles.length}</strong>
            <span>Active roles</span>
          </div>
        </div>
      </div>

      {moduleError ? <div className="portal-alert">{moduleError}</div> : null}
      {actionError ? <div className="portal-alert">{actionError}</div> : null}
      {actionMessage ? <div className="plan-success">{actionMessage}</div> : null}

      <div className="workflow-config-tabs">
        {[
          ['overview', 'Overview'],
          ['thresholds', 'Thresholds'],
          ['stages', 'Stages'],
          ['routing', 'Routing'],
          ['tasks', 'Role Tasks']
        ].map(([tabId, label]) => (
          <button key={tabId} type="button" className={activeTab === tabId ? 'active' : ''} onClick={() => setActiveTab(tabId as TabKey)}>
            {label}
          </button>
        ))}
        <button type="button" className="workflow-config-refresh" onClick={refreshConfig} disabled={isRefreshing || !token}>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Phase Coverage</h3>
            <ul className="admin-list">
              {Object.entries(phaseCounts).map(([phaseKey, count]) => (
                <li key={phaseKey}>
                  <div>
                    <strong>{toTitle(phaseKey)}</strong>
                    <span>Configured workflow stages</span>
                  </div>
                  <span className="admin-status admin-status--good">{count}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Signals</h3>
            <ul className="admin-list">
              <li><div><strong>{transitions.length}</strong><span>Transitions</span></div></li>
              <li><div><strong>{roleTasks.length}</strong><span>Role tasks</span></div></li>
              <li><div><strong>{thresholds.filter((threshold) => threshold.RequiresBoard).length}</strong><span>Board bands</span></div></li>
            </ul>
          </article>
        </div>
      ) : null}

      {activeTab === 'thresholds' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Threshold Bands</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Band</th>
                  <th>Route</th>
                  <th>BPP</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((threshold) => (
                  <tr key={threshold.ThresholdId} className={selectedThresholdId === threshold.ThresholdId ? 'plan-row--selected' : undefined} onClick={() => setSelectedThresholdId(threshold.ThresholdId)}>
                    <td>{threshold.ProcurementType || 'All'}</td>
                    <td>{formatCurrency(threshold.MinAmount)} - {threshold.MaxAmount == null ? 'and above' : formatCurrency(threshold.MaxAmount)}</td>
                    <td>{threshold.ApprovalRoute}</td>
                    <td>{threshold.RequiresBpp ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Edit Threshold</h3>
            <div className="plan-form-grid">
              <label className="plan-field"><span>Procurement Type</span><input className="plan-input" value={thresholdForm.procurementType} onChange={(event) => setThresholdForm((prev) => ({ ...prev, procurementType: event.target.value }))} /></label>
              <label className="plan-field"><span>Min Amount</span><input className="plan-input" type="number" min="0" value={thresholdForm.minAmount} onChange={(event) => setThresholdForm((prev) => ({ ...prev, minAmount: event.target.value }))} /></label>
              <label className="plan-field"><span>Max Amount</span><input className="plan-input" type="number" min="0" value={thresholdForm.maxAmount} onChange={(event) => setThresholdForm((prev) => ({ ...prev, maxAmount: event.target.value }))} /></label>
              <label className="plan-field"><span>Approval Route</span><input className="plan-input" value={thresholdForm.approvalRoute} onChange={(event) => setThresholdForm((prev) => ({ ...prev, approvalRoute: event.target.value }))} /></label>
              <label className="plan-field"><span>Status</span><select className="plan-select" value={thresholdForm.status} onChange={(event) => setThresholdForm((prev) => ({ ...prev, status: event.target.value }))}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
              <label className="plan-field plan-field--checkbox"><input type="checkbox" checked={thresholdForm.requiresBoard} onChange={(event) => setThresholdForm((prev) => ({ ...prev, requiresBoard: event.target.checked }))} /><span>Requires Board</span></label>
              <label className="plan-field plan-field--checkbox"><input type="checkbox" checked={thresholdForm.requiresBpp} onChange={(event) => setThresholdForm((prev) => ({ ...prev, requiresBpp: event.target.checked }))} /><span>Requires BPP</span></label>
              <label className="plan-field plan-field--span"><span>Notes</span><textarea className="plan-textarea" rows={3} value={thresholdForm.notes} onChange={(event) => setThresholdForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleThresholdSave} disabled={isSaving || !selectedThreshold}>Save Changes</button>
              <button type="button" className="plan-button plan-button--secondary" onClick={handleThresholdCreate} disabled={isSaving}>Create New</button>
              <button type="button" className="plan-button plan-button--danger" onClick={handleThresholdDelete} disabled={isSaving || !selectedThreshold}>Delete</button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'stages' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Stage Catalog</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Phase</th>
                  <th>Owner</th>
                  <th>Sequence</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={stage.StageKey} className={selectedStageKey === stage.StageKey ? 'plan-row--selected' : undefined} onClick={() => setSelectedStageKey(stage.StageKey)}>
                    <td>{stage.StageTitle}</td>
                    <td>{toTitle(stage.PhaseKey)}</td>
                    <td>{toTitle(stage.PrimaryOwnerRole)}</td>
                    <td>{stage.SequenceNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Edit Stage</h3>
            <div className="plan-form-grid">
              <label className="plan-field"><span>Phase</span><input className="plan-input" value={stageForm.phaseKey} onChange={(event) => setStageForm((prev) => ({ ...prev, phaseKey: event.target.value }))} /></label>
              <label className="plan-field"><span>Stage Title</span><input className="plan-input" value={stageForm.stageTitle} onChange={(event) => setStageForm((prev) => ({ ...prev, stageTitle: event.target.value }))} /></label>
              <label className="plan-field"><span>Sequence</span><input className="plan-input" type="number" min="1" value={stageForm.sequenceNo} onChange={(event) => setStageForm((prev) => ({ ...prev, sequenceNo: event.target.value }))} /></label>
              <label className="plan-field"><span>Primary Owner</span><select className="plan-select" value={stageForm.primaryOwnerRole} onChange={(event) => setStageForm((prev) => ({ ...prev, primaryOwnerRole: event.target.value }))}>{roles.map((role) => (<option key={role.RoleName} value={role.RoleName}>{role.RoleName}</option>))}</select></label>
              <label className="plan-field"><span>PPA Reference</span><input className="plan-input" value={stageForm.ppaReference} onChange={(event) => setStageForm((prev) => ({ ...prev, ppaReference: event.target.value }))} /></label>
              <label className="plan-field plan-field--checkbox"><input type="checkbox" checked={stageForm.isDecisionGate} onChange={(event) => setStageForm((prev) => ({ ...prev, isDecisionGate: event.target.checked }))} /><span>Decision Gate</span></label>
              <label className="plan-field plan-field--checkbox"><input type="checkbox" checked={stageForm.isStart} onChange={(event) => setStageForm((prev) => ({ ...prev, isStart: event.target.checked }))} /><span>Start Stage</span></label>
              <label className="plan-field plan-field--checkbox"><input type="checkbox" checked={stageForm.isTerminal} onChange={(event) => setStageForm((prev) => ({ ...prev, isTerminal: event.target.checked }))} /><span>Terminal Stage</span></label>
              <label className="plan-field plan-field--span"><span>Description</span><textarea className="plan-textarea" rows={4} value={stageForm.stageDescription} onChange={(event) => setStageForm((prev) => ({ ...prev, stageDescription: event.target.value }))} /></label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleStageSave} disabled={isSaving || !selectedStage}>Save Stage</button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'routing' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Routing Rules</h3>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Condition</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transitions.map((transition) => (
                  <tr key={transition.TransitionId}>
                    <td>{stageLookup.get(transition.FromStageKey)?.StageTitle ?? transition.FromStageKey}</td>
                    <td>{stageLookup.get(transition.ToStageKey)?.StageTitle ?? transition.ToStageKey}</td>
                    <td>{transition.TransitionCondition}</td>
                    <td><button type="button" className="plan-link plan-link--danger" onClick={() => handleTransitionDelete(transition.TransitionId)} disabled={isSaving}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Add Transition</h3>
            <div className="plan-form-grid">
              <label className="plan-field"><span>From Stage</span><select className="plan-select" value={transitionForm.fromStageKey} onChange={(event) => setTransitionForm((prev) => ({ ...prev, fromStageKey: event.target.value }))}><option value="">Select stage</option>{stages.map((stage) => (<option key={stage.StageKey} value={stage.StageKey}>{stage.StageTitle}</option>))}</select></label>
              <label className="plan-field"><span>To Stage</span><select className="plan-select" value={transitionForm.toStageKey} onChange={(event) => setTransitionForm((prev) => ({ ...prev, toStageKey: event.target.value }))}><option value="">Select stage</option>{stages.map((stage) => (<option key={stage.StageKey} value={stage.StageKey}>{stage.StageTitle}</option>))}</select></label>
              <label className="plan-field plan-field--span"><span>Condition</span><textarea className="plan-textarea" rows={4} value={transitionForm.transitionCondition} onChange={(event) => setTransitionForm((prev) => ({ ...prev, transitionCondition: event.target.value }))} /></label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleTransitionCreate} disabled={isSaving}>Add Transition</button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'tasks' ? (
        <div className="admin-grid">
          <article className="admin-card admin-card--wide">
            <h3>Role Responsibility Matrix</h3>
            <div className="plan-toolbar">
              <div className="plan-filters">
                <label className="plan-field">
                  <span>Role Filter</span>
                  <select
                    className="plan-select"
                    value={selectedRoleFilter}
                    onChange={(event) => {
                      setSelectedRoleFilter(event.target.value);
                      const matchedRole = roles.find((role) => role.RoleName === event.target.value);
                      setRoleTaskForm((prev) => ({
                        ...prev,
                        roleKey: event.target.value,
                        displayName: matchedRole ? toTitle(matchedRole.RoleName) : prev.displayName
                      }));
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role.RoleName} value={role.RoleName}>
                        {role.RoleName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Task</th>
                  <th>Outcome</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRoleTasks.map((task) => (
                  <tr key={task.RoleTaskId}>
                    <td>{stageLookup.get(task.StageKey)?.StageTitle ?? task.StageKey}</td>
                    <td>{task.TaskDescription}</td>
                    <td>{task.ExpectedOutcome}</td>
                    <td><button type="button" className="plan-link plan-link--danger" onClick={() => handleRoleTaskDelete(task.RoleTaskId)} disabled={isSaving}>Remove</button></td>
                  </tr>
                ))}
                {!filteredRoleTasks.length ? (
                  <tr>
                    <td colSpan={4} className="plan-empty">No role tasks found for the selected role.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </article>
          <article className="admin-card admin-card--mid">
            <h3>Add Role Task</h3>
            <div className="plan-form-grid">
              <label className="plan-field"><span>Role</span><select className="plan-select" value={roleTaskForm.roleKey} onChange={(event) => { const matchedRole = roles.find((role) => role.RoleName === event.target.value); setRoleTaskForm((prev) => ({ ...prev, roleKey: event.target.value, displayName: matchedRole ? toTitle(matchedRole.RoleName) : prev.displayName })); }}><option value="">Select role</option>{roles.map((role) => (<option key={role.RoleName} value={role.RoleName}>{role.RoleName}</option>))}</select></label>
              <label className="plan-field"><span>Display Name</span><input className="plan-input" value={roleTaskForm.displayName} onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, displayName: event.target.value }))} /></label>
              <label className="plan-field"><span>Stage</span><select className="plan-select" value={roleTaskForm.stageKey} onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, stageKey: event.target.value }))}><option value="">Select stage</option>{stages.map((stage) => (<option key={stage.StageKey} value={stage.StageKey}>{stage.StageTitle}</option>))}</select></label>
              <label className="plan-field plan-field--span"><span>Task Description</span><textarea className="plan-textarea" rows={3} value={roleTaskForm.taskDescription} onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, taskDescription: event.target.value }))} /></label>
              <label className="plan-field plan-field--span"><span>Expected Outcome</span><textarea className="plan-textarea" rows={3} value={roleTaskForm.expectedOutcome} onChange={(event) => setRoleTaskForm((prev) => ({ ...prev, expectedOutcome: event.target.value }))} /></label>
            </div>
            <div className="plan-actions">
              <button type="button" className="plan-button" onClick={handleRoleTaskCreate} disabled={isSaving}>Add Role Task</button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
};
