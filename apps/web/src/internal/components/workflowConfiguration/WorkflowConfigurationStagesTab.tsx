import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowConfigurationRole, WorkflowConfigurationStage } from '../../types/internal';
import type { StageFormState } from './shared';

type Props = {
  stages: WorkflowConfigurationStage[];
  selectedStageKey: string;
  setSelectedStageKey: Dispatch<SetStateAction<string>>;
  stageForm: StageFormState;
  setStageForm: Dispatch<SetStateAction<StageFormState>>;
  roles: WorkflowConfigurationRole[];
  toTitle: (value: string) => string;
  isSaving: boolean;
  selectedStage: WorkflowConfigurationStage | null;
  onSave: () => Promise<void>;
};

export const WorkflowConfigurationStagesTab = ({
  stages,
  selectedStageKey,
  setSelectedStageKey,
  stageForm,
  setStageForm,
  roles,
  toTitle,
  isSaving,
  selectedStage,
  onSave
}: Props) => (
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
            <tr
              key={stage.StageKey}
              className={selectedStageKey === stage.StageKey ? 'plan-row--selected' : undefined}
              onClick={() => setSelectedStageKey(stage.StageKey)}
            >
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
        <label className="plan-field">
          <span>Phase</span>
          <input
            className="plan-input"
            value={stageForm.phaseKey}
            onChange={(event) => setStageForm((prev) => ({ ...prev, phaseKey: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Stage Title</span>
          <input
            className="plan-input"
            value={stageForm.stageTitle}
            onChange={(event) => setStageForm((prev) => ({ ...prev, stageTitle: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Sequence</span>
          <input
            className="plan-input"
            type="number"
            min="1"
            value={stageForm.sequenceNo}
            onChange={(event) => setStageForm((prev) => ({ ...prev, sequenceNo: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Primary Owner</span>
          <select
            className="plan-select"
            value={stageForm.primaryOwnerRole}
            onChange={(event) => setStageForm((prev) => ({ ...prev, primaryOwnerRole: event.target.value }))}
          >
            {roles.map((role) => (
              <option key={role.RoleName} value={role.RoleName}>
                {role.RoleName}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>PPA Reference</span>
          <input
            className="plan-input"
            value={stageForm.ppaReference}
            onChange={(event) => setStageForm((prev) => ({ ...prev, ppaReference: event.target.value }))}
          />
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={stageForm.isDecisionGate}
            onChange={(event) => setStageForm((prev) => ({ ...prev, isDecisionGate: event.target.checked }))}
          />
          <span>Decision Gate</span>
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={stageForm.isStart}
            onChange={(event) => setStageForm((prev) => ({ ...prev, isStart: event.target.checked }))}
          />
          <span>Start Stage</span>
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={stageForm.isTerminal}
            onChange={(event) => setStageForm((prev) => ({ ...prev, isTerminal: event.target.checked }))}
          />
          <span>Terminal Stage</span>
        </label>
        <label className="plan-field plan-field--span">
          <span>Description</span>
          <textarea
            className="plan-textarea"
            rows={4}
            value={stageForm.stageDescription}
            onChange={(event) => setStageForm((prev) => ({ ...prev, stageDescription: event.target.value }))}
          />
        </label>
      </div>
      <div className="plan-actions">
        <button type="button" className="plan-button" onClick={() => void onSave()} disabled={isSaving || !selectedStage}>
          Save Stage
        </button>
      </div>
    </article>
  </div>
);
