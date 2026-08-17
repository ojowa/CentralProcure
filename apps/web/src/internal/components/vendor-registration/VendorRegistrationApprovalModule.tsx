'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  decideVendorApproval,
  deleteVendor,
  downloadVendorApprovalDocument,
  fetchVendorApprovalDetail,
  fetchVendorApprovals
} from '../../services/vendorApprovalService';
import type {
  InternalModule,
  RoleKey,
  VendorApprovalDetail,
  VendorApprovalStatus,
  VendorApprovalSummary,
  VendorComplianceReviewItem
} from '../../types/internal';
import { usePermission } from '../../hooks/usePermission';

const REVIEW_STATUSES: VendorApprovalStatus[] = ['Pending Approval', 'Active', 'Rejected', 'Deleted'];

const formatDateTimeShort = (value?: string | null) => {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusTone = (status?: string | null) => {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return 'admin-status--good';
    case 'rejected':
    case 'deleted':
      return 'admin-status--alert';
    default:
      return 'admin-status--warn';
  }
};

const sanitizeFileName = (value: string): string => value.replace(/[^a-z0-9.-]+/gi, '_');

type Props = {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
};

export const VendorRegistrationApprovalModule = ({ module, token, role, userEmail }: Props) => {
  const { hasPermission } = usePermission(token);
  const [records, setRecords] = useState<VendorApprovalSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VendorApprovalDetail | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    query: ''
  });
  const [reviewNote, setReviewNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<VendorApprovalStatus | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canReview = Boolean(token) && (
    grantedActions.has('admin.vendor_approval') ||
    hasPermission('admin.vendor_approval')
  );

  const summary = useMemo(() => {
    const counts = records.reduce<Record<string, number>>((accumulator, record) => {
      accumulator[record.VendorStatus] = (accumulator[record.VendorStatus] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      total: records.length,
      pending: counts['Pending Approval'] ?? 0,
      active: counts.Active ?? 0,
      rejected: counts.Rejected ?? 0,
      deleted: counts.Deleted ?? 0
    };
  }, [records]);

  const loadRecords = async () => {
    if (!token) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const next = await fetchVendorApprovals(token, {
        status: filters.status || undefined,
        query: filters.query.trim() || undefined
      });
      setRecords(next.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor approvals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [token, filters.query, filters.status]);

  const openDetail = async (vendorId: string) => {
    if (!token) {
      return;
    }

    setSelectedId(vendorId);
    setIsDetailLoading(true);
    setError('');

    try {
      const next = await fetchVendorApprovalDetail(token, vendorId);
      setDetail(next);
      setReviewNote('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor approval detail.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setReviewNote('');
    setFeedback('');
    setError('');
  };

  const refreshSelection = async (vendorId: string) => {
    await Promise.all([loadRecords(), openDetail(vendorId)]);
  };

  const handleDecision = async (decision: VendorApprovalStatus) => {
    if (!token || !detail) {
      setError('Select a vendor record before applying a decision.');
      return;
    }

    if (!canReview) {
      setError('Your current role does not have vendor approval authority.');
      return;
    }

    setIsSaving(true);
    setPendingDecision(decision);
    setError('');
    setFeedback('');

    try {
      await decideVendorApproval(token, detail.VendorId, {
        Decision: decision,
        Notes: reviewNote.trim() || undefined
      });

      await refreshSelection(detail.VendorId);
      setFeedback(
        decision === 'Active'
          ? `${detail.CompanyName} has been approved and activated.`
          : decision === 'Rejected'
            ? `${detail.CompanyName} has been rejected.`
            : `${detail.CompanyName} has been returned to pending approval.`
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update vendor approval status.');
    } finally {
      setIsSaving(false);
      setPendingDecision(null);
    }
  };

  const handleDownload = async (complianceDocument: VendorComplianceReviewItem) => {
    if (!token || !detail) {
      setError('Open a vendor record before downloading compliance documents.');
      return;
    }

    setDownloadingDocumentId(complianceDocument.DocumentId);
    setError('');

    try {
      const blob = await downloadVendorApprovalDocument(token, complianceDocument.FileUrl);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = sanitizeFileName(`${detail.CompanyName}-${complianceDocument.DocumentType}-${complianceDocument.DocumentId}.bin`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download compliance document.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleDelete = async () => {
    if (!token || !detail) {
      setError('Select a vendor record before deleting.');
      return;
    }

    if (!canReview) {
      setError('Your current role does not have vendor approval authority.');
      return;
    }

    setIsDeleting(true);
    setError('');
    setFeedback('');

    try {
      const result = await deleteVendor(token, detail.VendorId, deleteReason.trim() || undefined);
      setFeedback(result.Message || `${detail.CompanyName} has been deleted.`);
      setShowDeleteConfirm(false);
      setDeleteReason('');
      closeDetail();
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete vendor account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      <div className="portal-module-grid portal-module-grid--4" style={{ marginTop: '16px' }}>
        <article className="portal-module-card">
          <h3>Total Vendors</h3>
          <p>{summary.total}</p>
        </article>
        <article className="portal-module-card">
          <h3>Pending Approval</h3>
          <p>{summary.pending}</p>
        </article>
        <article className="portal-module-card">
          <h3>Active Vendors</h3>
          <p>{summary.active}</p>
        </article>
        <article className="portal-module-card">
          <h3>Rejected Vendors</h3>
          <p>{summary.rejected}</p>
        </article>
      </div>

      <div className="plan-toolbar">
        <div className="plan-filters">
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={filters.status}
              onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {REVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Search</span>
            <input
              className="plan-input"
              value={filters.query}
              onChange={(event) => setFilters((previous) => ({ ...previous, query: event.target.value }))}
              placeholder="Company, registration no, tax id, email"
            />
          </label>
          <div className="plan-actions">
            <button type="button" className="plan-button plan-button--secondary" onClick={() => void loadRecords()} disabled={!token || isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {!canReview && token ? (
        <div className="portal-alert" style={{ marginTop: '16px' }}>
          Your current role can view the workspace shell but does not have vendor approval authority.
        </div>
      ) : null}
      {feedback ? <div className="plan-success" style={{ marginTop: '16px' }}>{feedback}</div> : null}
      {error ? <div className="portal-alert" style={{ marginTop: '16px' }}>{error}</div> : null}

      <div className="admin-grid">
        <article className="admin-card admin-card--wide">
          <h3>Vendor Approval Queue</h3>
          <div className="portal-table-container">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Contact</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.VendorId}>
                  <td>
                    <button type="button" className="plan-link" onClick={() => void openDetail(record.VendorId)}>
                      {record.CompanyName}
                    </button>
                    <div className="plan-muted">{record.RegistrationNumber}</div>
                  </td>
                  <td>
                    <span className={`admin-status ${statusTone(record.VendorStatus)}`}>{record.VendorStatus}</span>
                  </td>
                  <td>
                    <div>{record.ComplianceDocumentsCount} uploaded</div>
                    <div className="plan-muted">
                      {record.ApprovedDocumentsCount} approved · {record.PendingDocumentsCount} pending · {record.RejectedDocumentsCount} rejected
                    </div>
                  </td>
                  <td>
                    <div>{record.ContactPerson}</div>
                    <div className="plan-muted">{record.Email}</div>
                  </td>
                  <td>{formatDateTimeShort(record.LastComplianceUpdateAt ?? record.RegistrationDate)}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={5} className="plan-empty">
                    No vendor registrations match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </article>

        <article className="admin-card admin-card--mid">
          <h3>Review Guidance</h3>
          <ul className="admin-list">
            <li>
              <strong>Pending Approval</strong>
              <span>Use when documentation is incomplete or still being validated.</span>
            </li>
            <li>
              <strong>Active</strong>
              <span>Only approve vendors whose uploaded records are satisfactory.</span>
            </li>
            <li>
              <strong>Rejected</strong>
              <span>Reject vendors that fail compliance checks or submit invalid records.</span>
            </li>
            <li>
              <strong>Reviewer</strong>
              <span>{userEmail || 'Signed-in admin user'}</span>
            </li>
          </ul>
        </article>
      </div>

      {selectedId ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content requisition-detail-modal">
            <div className="requisition-card__header">
              <div>
                <h3>{detail?.CompanyName || 'Vendor Registration Review'}</h3>
                <p>{detail?.RegistrationNumber || 'Loading vendor detail.'}</p>
              </div>
              <button type="button" className="plan-link" onClick={closeDetail}>
                Close
              </button>
            </div>

            {isDetailLoading ? <div className="plan-loading">Loading vendor registration detail...</div> : null}
            {error && selectedId ? <div className="portal-alert animate-shake" style={{ margin: '16px 0' }}>{error}</div> : null}

            {detail ? (
              <>
                <div className="requisition-detail-grid">
                  <div>
                    <span>Status</span>
                    <strong>
                      <span className={`admin-status ${statusTone(detail.VendorStatus)}`}>{detail.VendorStatus}</span>
                    </strong>
                  </div>
                  <div>
                    <span>Account State</span>
                    <strong>{detail.IsActive ? 'Active' : 'Disabled'}</strong>
                  </div>
                  <div>
                    <span>Registered</span>
                    <strong>{formatDateTimeShort(detail.RegistrationDate)}</strong>
                  </div>
                  <div>
                    <span>Last Login</span>
                    <strong>{formatDateTimeShort(detail.LastLogin)}</strong>
                  </div>
                  <div>
                    <span>Tax ID</span>
                    <strong>{detail.TaxId}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{detail.PhoneNumber || 'Not provided'}</strong>
                  </div>
                </div>

                <div className="requisition-detail-note">
                  <h4>Company Contact</h4>
                  <p>{detail.ContactPerson} · {detail.Email}</p>
                  <p>{detail.CompanyAddress}</p>
                </div>

                <div className="requisition-detail-note">
                  <h4>Compliance Documents</h4>
                  <div className="portal-table-container">
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th>Status</th>
                        <th>Expiry</th>
                        <th>Updated</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.ComplianceDocuments.map((item) => (
                        <tr key={item.DocumentId}>
                          <td>{item.DocumentType}</td>
                          <td>
                            <span className={`admin-status ${statusTone(item.VerificationStatus)}`}>{item.VerificationStatus}</span>
                          </td>
                          <td>{formatDateTimeShort(item.ExpiryDate)}</td>
                          <td>{formatDateTimeShort(item.UpdatedAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="plan-link"
                              onClick={() => void handleDownload(item)}
                              disabled={downloadingDocumentId === item.DocumentId}
                            >
                              {downloadingDocumentId === item.DocumentId ? 'Downloading...' : 'Download'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!detail.ComplianceDocuments.length ? (
                        <tr>
                          <td colSpan={5} className="plan-empty">
                            No compliance documents were uploaded for this vendor.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  </div>
                </div>

                <div className="plan-form plan-form--edit">
                  <div className="plan-form__header">
                    <div>
                      <h3>Admin Decision</h3>
                      <p>Review the registration pack and apply the current onboarding decision.</p>
                    </div>
                  </div>
                  <div className="plan-form-grid">
                    <label className="plan-field plan-field--span">
                      <span>Review Note</span>
                      <textarea
                        className="plan-textarea"
                        rows={4}
                        value={reviewNote}
                        disabled={!canReview}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder="Record the basis for approval, rejection, or return to pending review."
                      />
                    </label>
                  </div>
                  <div className="plan-actions" style={{ marginTop: '24px' }}>
                    <button type="button" className="plan-button plan-button--secondary" onClick={() => void handleDecision('Pending Approval')} disabled={!canReview || isSaving}>
                      {pendingDecision === 'Pending Approval' ? 'Saving...' : 'Mark Pending'}
                    </button>
                    <button type="button" className="plan-button" onClick={() => void handleDecision('Active')} disabled={!canReview || isSaving}>
                      {pendingDecision === 'Active' ? 'Saving...' : 'Approve Vendor'}
                    </button>
                    <button type="button" className="plan-button plan-button--danger" onClick={() => void handleDecision('Rejected')} disabled={!canReview || isSaving}>
                      {pendingDecision === 'Rejected' ? 'Saving...' : 'Reject Vendor'}
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--portal-border)', marginTop: '20px', paddingTop: '16px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--portal-slate)', marginBottom: '12px' }}>
                      Permanently remove this vendor account. This action cannot be undone.
                    </p>
                    {!showDeleteConfirm ? (
                      <button type="button" className="plan-button plan-button--danger" onClick={() => setShowDeleteConfirm(true)} disabled={!canReview || isSaving || isDeleting}>
                        Delete Vendor Account
                      </button>
                    ) : (
                      <div>
                        <label className="plan-field" style={{ marginBottom: '12px' }}>
                          <span>Reason for deletion (optional)</span>
                          <textarea
                            className="plan-textarea"
                            rows={2}
                            value={deleteReason}
                            onChange={(event) => setDeleteReason(event.target.value)}
                            placeholder="Enter reason for deleting this vendor account..."
                          />
                        </label>
                        <div className="plan-actions">
                          <button type="button" className="plan-button plan-button--secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteReason(''); }} disabled={isDeleting}>
                            Cancel
                          </button>
                          <button type="button" className="plan-button plan-button--danger" onClick={() => void handleDelete()} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
