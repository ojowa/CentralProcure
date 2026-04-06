'use client';

import type { ReactNode } from 'react';
import {
  requisitionFundingSources,
  requisitionPriorities,
  requisitionStatuses,
  requisitionTypes,
  type BudgetLineItem,
  type ThresholdBand
} from '../../data/internalData';
import type {
  InternalOrganizationalUnitRecord,
  RequisitionDetail,
  RequisitionLineItem,
  RequisitionSummary
} from '../../types/internal';
import { formatCurrency, formatDate, getBudgetCheck, requisitionStatusTone } from '../../utils/procureUtils';
import { toNumber, type FiltersState, type RequisitionFormState } from './helpers';

type FilterChangeHandler = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
type FormFieldChangeHandler = <K extends keyof RequisitionFormState>(key: K, value: RequisitionFormState[K]) => void;

interface RequisitionCreateViewProps {
  editingId: string | null;
  form: RequisitionFormState;
  units: InternalOrganizationalUnitRecord[];
  catalog: BudgetLineItem[];
  selectedAppItem: BudgetLineItem | null;
  budgetCheck: ReturnType<typeof getBudgetCheck>;
  budgetDepartment: string;
  budgetCode: string;
  fiscalYear: number;
  routingBand: ThresholdBand;
  formError: string;
  feedback: string;
  isSaving: boolean;
  canSaveCurrentForm: boolean;
  isListLoading: boolean;
  isCatalogLoading: boolean;
  isBudgetLoading: boolean;
  budgetError: string;
  catalogError: string;
  guidance?: { focus: string; checks: string[] };
  userEmail?: string | null;
  isDepartmentHead: boolean;
  departmentHeadQueueCard?: ReactNode;
  onFormFieldChange: FormFieldChangeHandler;
  onLineItemChange: (index: number, key: keyof RequisitionLineItem, value: string | number) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onAppItemSelect: (itemId: string) => void;
  onSaveDraft: (status: 'Draft' | 'Submitted') => void;
  onResetForm: () => void;
  onOpenDetail: (requisitionId: string, modal?: boolean) => void;
}

export const RequisitionCreateView = ({
  editingId,
  form,
  units,
  catalog,
  selectedAppItem,
  budgetCheck,
  budgetDepartment,
  budgetCode,
  fiscalYear,
  routingBand,
  formError,
  feedback,
  isSaving,
  canSaveCurrentForm,
  isListLoading,
  isCatalogLoading,
  isBudgetLoading,
  budgetError,
  catalogError,
  guidance,
  userEmail,
  isDepartmentHead,
  departmentHeadQueueCard,
  onFormFieldChange,
  onLineItemChange,
  onAddLineItem,
  onRemoveLineItem,
  onAppItemSelect,
  onSaveDraft,
  onResetForm,
  onOpenDetail
}: RequisitionCreateViewProps) => (
  <div className="requisition-grid">
    <div className="requisition-panel">
      <article className="requisition-card">
        <div className="requisition-card__header">
          <div>
            <h3>{editingId ? 'Update Requisition Draft' : 'Draft New Requisition'}</h3>
            <p>Capture business need, planning linkage, and delivery expectations before submission.</p>
          </div>
          {editingId ? <span className="requisition-tag">Editing existing draft</span> : null}
        </div>

        <div className="requisition-form-grid">
          <label className="plan-field"><span>Title</span><input className="plan-input" value={form.Title} onChange={(event) => onFormFieldChange('Title', event.target.value)} /></label>
          <label className="plan-field">
            <span>Organizational Unit</span>
            <select className="plan-select" value={form.UnitId} onChange={(event) => onFormFieldChange('UnitId', event.target.value)}>
              <option value="">{form.Department ? `Legacy department: ${form.Department}` : 'Select organizational unit'}</option>
              {units.map((unit) => (
                <option key={unit.UnitId} value={unit.UnitId}>
                  {unit.ParentUnitName ? `${unit.UnitName} (${unit.ParentUnitName})` : unit.UnitName}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field"><span>Required By</span><input className="plan-input" type="date" value={form.RequiredBy} onChange={(event) => onFormFieldChange('RequiredBy', event.target.value)} /></label>
          <label className="plan-field">
            <span>Procurement Type</span>
            <select className="plan-select" value={form.ProcurementType} onChange={(event) => onFormFieldChange('ProcurementType', event.target.value)}>
              {requisitionTypes.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="plan-field">
            <span>Priority</span>
            <select className="plan-select" value={form.Priority} onChange={(event) => onFormFieldChange('Priority', event.target.value)}>
              {requisitionPriorities.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="plan-field">
            <span>Funding Source</span>
            <select className="plan-select" value={form.FundingSource} onChange={(event) => onFormFieldChange('FundingSource', event.target.value)}>
              {requisitionFundingSources.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="plan-field"><span>Budget Code</span><input className="plan-input" value={form.BudgetCode} onChange={(event) => onFormFieldChange('BudgetCode', event.target.value)} /></label>
          <label className="plan-field">
            <span>APP Line Item</span>
            <select className="plan-select" value={form.AppItemId} onChange={(event) => onAppItemSelect(event.target.value)}>
              <option value="">Select APP line item</option>
              {catalog.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.planRef}</option>)}
            </select>
          </label>
          <label className="plan-field"><span>Project Code</span><input className="plan-input" value={form.ProjectCode} onChange={(event) => onFormFieldChange('ProjectCode', event.target.value)} /></label>
          <label className="plan-field plan-field--span"><span>Delivery Location</span><input className="plan-input" value={form.DeliveryLocation} onChange={(event) => onFormFieldChange('DeliveryLocation', event.target.value)} /></label>
          <label className="plan-field plan-field--span"><span>Justification</span><textarea className="plan-textarea" rows={4} value={form.Justification} onChange={(event) => onFormFieldChange('Justification', event.target.value)} /></label>
          <label className="plan-field plan-field--span"><span>Risk Notes</span><textarea className="plan-textarea" rows={3} value={form.RiskNotes} onChange={(event) => onFormFieldChange('RiskNotes', event.target.value)} /></label>
        </div>
      </article>

      <article className="requisition-card">
        <div className="requisition-card__header requisition-card__header--inline">
          <div>
            <h3>Line Items</h3>
            <p>Break the requirement into clear commercial units for threshold and budget validation.</p>
          </div>
          <button type="button" className="plan-button plan-button--secondary" onClick={onAddLineItem}>Add Item</button>
        </div>

        <div className="requisition-items">
          <div className="requisition-item-row requisition-item-row--header">
            <div>Description</div><div>Unit</div><div>Qty</div><div>Unit Cost</div><div>Total</div><div>Action</div>
          </div>
          {form.LineItems.map((item, index) => (
            <div key={`line-item-${index}`} className="requisition-item-row">
              <div className="requisition-item-cell--desc"><input className="plan-input" value={item.Description} onChange={(event) => onLineItemChange(index, 'Description', event.target.value)} placeholder="Describe the line item" /></div>
              <div className="requisition-item-cell"><input className="plan-input" value={item.Unit} onChange={(event) => onLineItemChange(index, 'Unit', event.target.value)} placeholder="pcs" /></div>
              <div className="requisition-item-cell"><input className="plan-input" type="number" min="0" step="1" value={item.Quantity} onChange={(event) => onLineItemChange(index, 'Quantity', event.target.value)} /></div>
              <div className="requisition-item-cell"><input className="plan-input" type="number" min="0" step="0.01" value={item.UnitCost} onChange={(event) => onLineItemChange(index, 'UnitCost', event.target.value)} /></div>
              <div className="requisition-item-total">{formatCurrency(toNumber(item.Quantity) * toNumber(item.UnitCost))}</div>
              <div className="requisition-item-cell"><button type="button" className="plan-link plan-link--danger" onClick={() => onRemoveLineItem(index)}>Remove</button></div>
            </div>
          ))}
        </div>

        <div className="requisition-summary">
          <div><span>Total Estimate</span><strong>{formatCurrency(form.LineItems.reduce((sum, item) => sum + toNumber(item.Quantity) * toNumber(item.UnitCost), 0))}</strong></div>
          <div><span>Estimated Route</span><strong>{routingBand.label}</strong></div>
          <div><span>Estimated Approval Level</span><strong>{routingBand.approvalLevel}</strong></div>
        </div>

        {formError ? <div className="req-error req-error--block">{formError}</div> : null}
        {feedback ? <div className="requisition-success">{feedback}</div> : null}

        <div className="requisition-actions">
          <button type="button" className="plan-button" disabled={isSaving || !canSaveCurrentForm} onClick={() => onSaveDraft('Draft')}>
            {isSaving ? 'Saving...' : editingId ? 'Update Draft' : 'Save Draft'}
          </button>
          <button type="button" className="plan-button plan-button--secondary" disabled={isSaving || !canSaveCurrentForm} onClick={() => onSaveDraft('Submitted')}>
            {isSaving ? 'Submitting...' : 'Submit Requisition'}
          </button>
          <button type="button" className="plan-button plan-button--secondary" onClick={onResetForm}>Reset Form</button>
        </div>
      </article>
    </div>

    <div className="requisition-panel">
      <article className="requisition-card">
        <div className="requisition-card__header">
          <div>
            <h3>APP and Budget Check</h3>
            <p>Validate planning linkage and live budget position before submission.</p>
          </div>
          {isCatalogLoading ? <span className="requisition-tag requisition-tag--ghost">Loading APP items</span> : null}
        </div>

        {selectedAppItem ? (
          <div className="budget-app-summary">
            <div><span>APP Line</span><strong>{selectedAppItem.title}</strong></div>
            <div><span>Plan Reference</span><strong>{selectedAppItem.planRef}</strong></div>
            <div><span>Budget Code</span><strong>{selectedAppItem.budgetCode}</strong></div>
          </div>
        ) : null}

        <div className={`budget-check budget-check--${budgetCheck.status}`}>
          <div className="budget-check__header">
            <div><h4>Budget Position</h4><p>{budgetCheck.message}</p></div>
            {isBudgetLoading ? <span className="requisition-tag requisition-tag--ghost">Refreshing</span> : null}
          </div>
          <div className="budget-check__grid">
            <div><span>Request Amount</span><strong>{formatCurrency(budgetCheck.amount)}</strong></div>
            <div><span>Available</span><strong>{formatCurrency(budgetCheck.available)}</strong></div>
            <div><span>Variance</span><strong>{formatCurrency(budgetCheck.variance)}</strong></div>
          </div>
          <div className="budget-check__meta">
            <span>Department: {budgetDepartment || 'Not set'}</span>
            <span>Budget Code: {budgetCode || 'Not set'}</span>
            <span>Fiscal Year: {fiscalYear}</span>
          </div>
        </div>
        {budgetError ? <div className="req-error req-error--block">{budgetError}</div> : null}
        {catalogError ? <div className="req-error req-error--block">{catalogError}</div> : null}
      </article>

      <article className="requisition-card">
        <div className="requisition-card__header">
          <div><h3>Routing Forecast</h3><p>{routingBand.escalation} This preview supports drafting only; backend policy remains authoritative after save.</p></div>
          <span className="requisition-tag requisition-tag--accent">{routingBand.timeline}</span>
        </div>

        <div className="routing-panel routing-panel--empty">
          <div className="routing-panel__header">
            <div><h4>{routingBand.approvalLevel}</h4><p>{routingBand.label}</p></div>
            <div className="routing-panel__badges"><span className="requisition-tag">{routingBand.requiresBpp ? 'BPP Required' : 'Internal Approval'}</span></div>
          </div>
          <div className="routing-steps">
            {routingBand.steps.map((step, index) => (
              <div key={`${routingBand.id}-${step}`} className="routing-step">
                <span className="routing-step__index">{index + 1}</span>
                <div><strong>{step}</strong><span className="routing-step__meta">{routingBand.timeline}</span></div>
              </div>
            ))}
          </div>
        </div>
      </article>

      {departmentHeadQueueCard}

      <article className="requisition-card">
        <div className="requisition-card__header">
          <div><h3>Role Focus</h3><p>{guidance?.focus || 'Prepare complete, defensible requisitions with clear planning and budget linkage.'}</p></div>
        </div>
        <div className="requisition-checklist">
          {(guidance?.checks ?? []).map((check) => <div key={check} className="requisition-check"><input type="checkbox" checked readOnly /><span>{check}</span></div>)}
        </div>
        <div className="requisition-detail-note"><h4>Prepared By</h4><p>{userEmail || 'Current authenticated internal user'}</p></div>
      </article>
    </div>
  </div>
);

interface RequisitionHistoryViewProps {
  filters: FiltersState;
  requisitions: RequisitionSummary[];
  totalItems: number;
  pageStart: number;
  pageEnd: number;
  isListLoading: boolean;
  isDepartmentHead: boolean;
  onFilterChange: FilterChangeHandler;
  onRefresh: () => void;
  onOpenDetail: (requisitionId: string, modal?: boolean) => void;
}

export const RequisitionHistoryView = ({
  filters,
  requisitions,
  totalItems,
  pageStart,
  pageEnd,
  isListLoading,
  isDepartmentHead,
  onFilterChange,
  onRefresh,
  onOpenDetail
}: RequisitionHistoryViewProps) => (
  <>
    <div className="plan-toolbar">
      <div className="plan-filters">
        <label className="plan-field"><span>Search</span><input className="plan-input" value={filters.query} onChange={(event) => onFilterChange('query', event.target.value)} placeholder="Search title, department, or budget code" /></label>
        <label className="plan-field">
          <span>Status</span>
          <select className="plan-select" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">All statuses</option>
            {requisitionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="plan-field">
          <span>Priority</span>
          <select className="plan-select" value={filters.priority} onChange={(event) => onFilterChange('priority', event.target.value)}>
            <option value="">All priorities</option>
            {requisitionPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="plan-field"><span>Date From</span><input className="plan-input" type="date" value={filters.dateFrom} onChange={(event) => onFilterChange('dateFrom', event.target.value)} /></label>
        <label className="plan-field"><span>Date To</span><input className="plan-input" type="date" value={filters.dateTo} onChange={(event) => onFilterChange('dateTo', event.target.value)} /></label>
        <div className="plan-actions"><button type="button" className="plan-button plan-button--secondary" disabled={isListLoading} onClick={onRefresh}>{isListLoading ? 'Refreshing...' : 'Refresh'}</button></div>
      </div>
    </div>

    <table className="plan-table">
      <thead><tr><th>Title</th><th>Department</th><th>Priority</th><th>Status</th><th>Final Decision</th><th>Total</th><th>Required By</th><th>Created</th><th>Action</th></tr></thead>
      <tbody>
        {requisitions.map((record) => (
          <tr key={record.RequisitionId}>
            <td><button type="button" className="plan-link" onClick={() => onOpenDetail(record.RequisitionId, true)}>{record.Title}</button></td>
            <td>{record.Department}</td>
            <td>{record.Priority || 'Not set'}</td>
            <td><span className={`admin-status ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span></td>
            <td>{record.FinalCommitteeDecision || 'Pending'}</td>
            <td>{formatCurrency(record.TotalEstimate)}</td>
            <td>{formatDate(record.RequiredBy)}</td>
            <td>{formatDate(record.CreatedAt)}</td>
            <td><button type="button" className="plan-link" onClick={() => onOpenDetail(record.RequisitionId, true)}>{isDepartmentHead ? 'Review' : 'View'}</button></td>
          </tr>
        ))}
        {!requisitions.length ? <tr><td colSpan={9} className="plan-empty">No requisitions match the current filters.</td></tr> : null}
      </tbody>
    </table>

    <div className="plan-pagination">
      <div className="plan-pagination__meta">Showing {pageStart} - {pageEnd} of {totalItems}</div>
      <div className="plan-pagination__controls">
        <button type="button" className="plan-button plan-button--secondary" disabled={filters.page <= 1} onClick={() => onFilterChange('page', filters.page - 1)}>Previous</button>
        <button type="button" className="plan-button plan-button--secondary" disabled={pageEnd >= totalItems} onClick={() => onFilterChange('page', filters.page + 1)}>Next</button>
      </div>
    </div>
  </>
);

interface RequisitionTrackingViewProps {
  filters: FiltersState;
  requisitions: RequisitionSummary[];
  selectedId: string | null;
  isListLoading: boolean;
  onFilterChange: FilterChangeHandler;
  onRefresh: () => void;
  onOpenDetail: (requisitionId: string, modal?: boolean) => void;
}

export const RequisitionTrackingView = ({
  filters,
  requisitions,
  selectedId,
  isListLoading,
  onFilterChange,
  onRefresh,
  onOpenDetail
}: RequisitionTrackingViewProps) => (
  <>
    <div className="plan-toolbar">
      <div className="plan-filters">
        <label className="plan-field"><span>Search</span><input className="plan-input" value={filters.query} onChange={(event) => onFilterChange('query', event.target.value)} placeholder="Search title, department, or requisition ID" /></label>
        <label className="plan-field">
          <span>Status</span>
          <select className="plan-select" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            <option value="">All statuses</option>
            {requisitionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="plan-field">
          <span>Priority</span>
          <select className="plan-select" value={filters.priority} onChange={(event) => onFilterChange('priority', event.target.value)}>
            <option value="">All priorities</option>
            {requisitionPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <div className="plan-actions"><button type="button" className="plan-button plan-button--secondary" disabled={isListLoading} onClick={onRefresh}>{isListLoading ? 'Refreshing...' : 'Refresh'}</button></div>
      </div>
    </div>

    <div className="plan-table-wrapper" style={{ marginTop: '16px' }}>
      <table className="plan-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Department</th>
            <th>Date</th>
            <th>Status</th>
            <th>Priority</th>
            <th style={{ textAlign: 'right' }}>Total Estimate</th>
            <th style={{ textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requisitions.map((record) => (
            <tr key={record.RequisitionId} className={record.RequisitionId === selectedId ? 'plan-table-row--active' : ''}>
              <td title={record.RequisitionId}>{record.RequisitionId.split('-')[0].toUpperCase()}</td>
              <td><strong>{record.Title}</strong></td>
              <td>{record.Department}</td>
              <td>{formatDate(record.CreatedAt)}</td>
              <td>
                <span className={`req-badge ${requisitionStatusTone(record.Status)}`.trim()}>{record.Status}</span>
              </td>
              <td>
                <span className="req-badge req-badge--soft">{record.Priority}</span>
              </td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(record.TotalEstimate)}</td>
              <td style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="plan-button plan-button--secondary plan-button--small"
                  onClick={() => onOpenDetail(record.RequisitionId, true)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
          {!requisitions.length ? (
            <tr>
              <td colSpan={8} className="plan-empty">No requisitions match the tracking filters.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  </>
);
