import { useMemo, useState } from 'react';
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

type ProcurementFilter = 'All' | 'Goods' | 'Works' | 'Services';

const procurementFilters: ProcurementFilter[] = ['All', 'Goods', 'Works', 'Services'];

const defaultThresholdForm: ThresholdFormState = {
  procurementType: 'Goods',
  minAmount: '',
  maxAmount: '',
  approvalRoute: '',
  approvalAuthorityCode: '',
  approvalAuthorityLabel: '',
  status: 'Active',
  notes: '',
  requiresCgisApproval: true,
  requiresBoard: false,
  requiresBpp: false,
  governanceBodyId: ''
};

const toThresholdForm = (threshold: WorkflowConfigurationThreshold): ThresholdFormState => ({
  procurementType: threshold.ProcurementType ?? 'Goods',
  minAmount: String(threshold.MinAmount),
  maxAmount: threshold.MaxAmount == null ? '' : String(threshold.MaxAmount),
  approvalRoute: threshold.ApprovalRoute,
  approvalAuthorityCode: threshold.ApprovalAuthorityCode,
  approvalAuthorityLabel: threshold.ApprovalAuthorityLabel,
  status: threshold.Status,
  notes: threshold.Notes ?? '',
  requiresCgisApproval: threshold.RequiresCgisApproval,
  requiresBoard: threshold.RequiresBoard,
  requiresBpp: threshold.RequiresBpp,
  governanceBodyId: threshold.GovernanceBodyId ?? ''
});

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
}: Props) => {
  const [activeFilter, setActiveFilter] = useState<ProcurementFilter>('All');

  const filteredThresholds = useMemo(
    () =>
      thresholds.filter((threshold) =>
        activeFilter === 'All'
          ? true
          : String(threshold.ProcurementType || '').toLowerCase() === activeFilter.toLowerCase()
      ),
    [activeFilter, thresholds]
  );

  const directRouteCount = filteredThresholds.filter((threshold) => threshold.RequiresCgisApproval).length;
  const boardRouteCount = filteredThresholds.filter((threshold) => threshold.RequiresBoard).length;
  const bppRouteCount = filteredThresholds.filter((threshold) => threshold.RequiresBpp).length;

  const startNewThreshold = () => {
    setSelectedThresholdId('');
    setThresholdForm(defaultThresholdForm);
  };

  const handleSelectThreshold = (threshold: WorkflowConfigurationThreshold) => {
    setSelectedThresholdId(threshold.ThresholdId);
    setThresholdForm(toThresholdForm(threshold));
  };

  return (
    <div className="admin-grid">
      <article className="admin-card admin-card--wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
          <div>
            <h3>Threshold Bands</h3>
            <p className="plan-muted" style={{ margin: '6px 0 0' }}>
              Configure approval routing by procurement type for goods, works, and services.
            </p>
          </div>
          <button type="button" className="plan-button plan-button--secondary" onClick={startNewThreshold}>
            New Threshold
          </button>
        </div>

        <div className="workflow-config-tabs" style={{ marginTop: '16px' }}>
          {procurementFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={activeFilter === filter ? 'active' : ''}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="admin-tags" style={{ marginTop: '12px' }}>
          <span className="admin-tag">{filteredThresholds.length} bands</span>
          <span className="admin-tag">{directRouteCount} CGIS direct</span>
          <span className="admin-tag">{boardRouteCount} board routes</span>
          <span className="admin-tag">{bppRouteCount} BPP routes</span>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Band</th>
                <th>Authority</th>
                <th>Route</th>
                <th>Body</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredThresholds.map((threshold) => (
                <tr
                  key={threshold.ThresholdId}
                  className={selectedThresholdId === threshold.ThresholdId ? 'plan-row--selected' : undefined}
                  onClick={() => handleSelectThreshold(threshold)}
                >
                  <td>{threshold.ProcurementType || 'All'}</td>
                  <td>
                    {formatCurrency(threshold.MinAmount)} -{' '}
                    {threshold.MaxAmount == null ? 'and above' : formatCurrency(threshold.MaxAmount)}
                  </td>
                  <td>{threshold.ApprovalAuthorityLabel}</td>
                  <td>{threshold.ApprovalRoute}</td>
                  <td>{threshold.GovernanceBodyName || 'Direct executive route'}</td>
                  <td>{threshold.Status}</td>
                </tr>
              ))}
              {!filteredThresholds.length ? (
                <tr>
                  <td colSpan={6} className="plan-empty">No threshold bands found for {activeFilter}.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="admin-card admin-card--mid">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
          <h3>{selectedThreshold ? 'Edit Threshold' : 'Create Threshold'}</h3>
          {selectedThreshold ? <span className="admin-tag">{selectedThreshold.ProcurementType || 'All'}</span> : null}
        </div>

        <div className="plan-form-grid">
          <label className="plan-field">
            <span>Procurement Type</span>
            <select
              className="plan-select"
              value={thresholdForm.procurementType}
              onChange={(event) => setThresholdForm((prev) => ({ ...prev, procurementType: event.target.value }))}
            >
              <option value="Goods">Goods</option>
              <option value="Works">Works</option>
              <option value="Services">Services</option>
            </select>
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
              placeholder="Leave blank for and above"
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
              rows={4}
              value={thresholdForm.notes}
              onChange={(event) => setThresholdForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
        </div>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(148, 163, 184, 0.24)'
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <strong>Threshold Actions</strong>
            <p className="plan-muted" style={{ margin: '6px 0 0' }}>
              Save changes to the selected threshold, create a new band, or remove the current one.
            </p>
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
        </div>
      </article>
    </div>
  );
};
