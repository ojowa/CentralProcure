import type { Dispatch, SetStateAction } from 'react';
import type { WorkflowConfigurationGovernanceBody, WorkflowConfigurationThreshold } from '../../types/internal';
import type { ThresholdFormState } from './shared';

type Props = {
  thresholds: WorkflowConfigurationThreshold[];
  selectedThresholdId: string;
  setSelectedThresholdId: Dispatch<SetStateAction<string>>;
  thresholdForm: ThresholdFormState;
  setThresholdForm: Dispatch<SetStateAction<ThresholdFormState>>;
  governanceBodies: WorkflowConfigurationGovernanceBody[];
  formatCurrency: (value: number) => string;
  isSaving: boolean;
  selectedThreshold: WorkflowConfigurationThreshold | null;
  onSave: () => Promise<void>;
  onCreate: () => Promise<void>;
  onDelete: () => Promise<void>;
};

export const WorkflowConfigurationThresholdsTab = ({
  thresholds,
  selectedThresholdId,
  setSelectedThresholdId,
  thresholdForm,
  setThresholdForm,
  governanceBodies,
  formatCurrency,
  isSaving,
  selectedThreshold,
  onSave,
  onCreate,
  onDelete
}: Props) => (
  <div className="admin-grid">
    <article className="admin-card admin-card--wide">
      <h3>Threshold Bands</h3>
      <table className="plan-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Band</th>
            <th>Authority</th>
            <th>Body</th>
            <th>CGIS</th>
            <th>BPP</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((threshold) => (
            <tr
              key={threshold.ThresholdId}
              className={selectedThresholdId === threshold.ThresholdId ? 'plan-row--selected' : undefined}
              onClick={() => setSelectedThresholdId(threshold.ThresholdId)}
            >
              <td>{threshold.ProcurementType || 'All'}</td>
              <td>
                {formatCurrency(threshold.MinAmount)} -{' '}
                {threshold.MaxAmount == null ? 'and above' : formatCurrency(threshold.MaxAmount)}
              </td>
              <td>{threshold.ApprovalAuthorityLabel}</td>
              <td>{threshold.GovernanceBodyName || 'Direct executive route'}</td>
              <td>{threshold.RequiresCgisApproval ? 'Yes' : 'No'}</td>
              <td>{threshold.RequiresBpp ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
    <article className="admin-card admin-card--mid">
      <h3>Edit Threshold</h3>
      <div className="plan-form-grid">
        <label className="plan-field">
          <span>Procurement Type</span>
          <input
            className="plan-input"
            value={thresholdForm.procurementType}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, procurementType: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Min Amount</span>
          <input
            className="plan-input"
            type="number"
            min="0"
            value={thresholdForm.minAmount}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, minAmount: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Max Amount</span>
          <input
            className="plan-input"
            type="number"
            min="0"
            value={thresholdForm.maxAmount}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, maxAmount: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Approval Route</span>
          <input
            className="plan-input"
            value={thresholdForm.approvalRoute}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, approvalRoute: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Authority Code</span>
          <input
            className="plan-input"
            value={thresholdForm.approvalAuthorityCode}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, approvalAuthorityCode: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Authority Label</span>
          <input
            className="plan-input"
            value={thresholdForm.approvalAuthorityLabel}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, approvalAuthorityLabel: event.target.value }))}
          />
        </label>
        <label className="plan-field">
          <span>Governance Body</span>
          <select
            className="plan-select"
            value={thresholdForm.governanceBodyId}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, governanceBodyId: event.target.value }))}
            disabled={!thresholdForm.requiresBoard}
          >
            <option value="">Direct executive route</option>
            {governanceBodies.map((body) => (
              <option key={body.BodyId} value={body.BodyId}>
                {body.BodyName}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>Status</span>
          <select
            className="plan-select"
            value={thresholdForm.status}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={thresholdForm.requiresCgisApproval}
            onChange={(event) =>
              setThresholdForm((prev) => ({
                ...prev,
                requiresCgisApproval: event.target.checked,
                requiresBoard: event.target.checked ? false : prev.requiresBoard,
                governanceBodyId: event.target.checked ? '' : prev.governanceBodyId
              }))
            }
          />
          <span>Requires CGIS Approval</span>
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={thresholdForm.requiresBoard}
            onChange={(event) =>
              setThresholdForm((prev) => ({
                ...prev,
                requiresBoard: event.target.checked,
                requiresCgisApproval: event.target.checked ? false : prev.requiresCgisApproval,
                governanceBodyId: event.target.checked ? prev.governanceBodyId || governanceBodies[0]?.BodyId || '' : ''
              }))
            }
          />
          <span>Requires Board</span>
        </label>
        <label className="plan-field plan-field--checkbox">
          <input
            type="checkbox"
            checked={thresholdForm.requiresBpp}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, requiresBpp: event.target.checked }))}
          />
          <span>Requires BPP</span>
        </label>
        <label className="plan-field plan-field--span">
          <span>Notes</span>
          <textarea
            className="plan-textarea"
            rows={3}
            value={thresholdForm.notes}
            onChange={(event) => setThresholdForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </div>
      <div className="plan-actions">
        <button type="button" className="plan-button" onClick={() => void onSave()} disabled={isSaving || !selectedThreshold}>
          Save Changes
        </button>
        <button type="button" className="plan-button plan-button--secondary" onClick={() => void onCreate()} disabled={isSaving}>
          Create New
        </button>
        <button type="button" className="plan-button plan-button--danger" onClick={() => void onDelete()} disabled={isSaving || !selectedThreshold}>
          Delete
        </button>
      </div>
    </article>
  </div>
);
