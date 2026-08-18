'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  decideVendorApproval,
  deleteVendor,
  downloadVendorApprovalDocument,
  fetchVendorApprovalDetail,
  fetchVendorApprovals,
  verifyComplianceDocument
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
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const statusTone = (status?: string | null) => {
  switch ((status ?? '').toLowerCase()) {
    case 'active': return 'admin-status--good';
    case 'rejected': case 'deleted': return 'admin-status--alert';
    default: return 'admin-status--warn';
  }
};

const summaryTone = (key: string) => {
  switch (key) {
    case 'good': return 'va-summary__card--good';
    case 'warn': return 'va-summary__card--warn';
    case 'alert': return 'va-summary__card--alert';
    default: return '';
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
  const [filters, setFilters] = useState({ status: '', query: '' });
  const [reviewNote, setReviewNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<VendorApprovalStatus | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [verifyingDocumentId, setVerifyingDocumentId] = useState<string | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalFeedback, setModalFeedback] = useState('');

  const grantedActions = useMemo(() => new Set(module.actions ?? []), [module.actions]);
  const canReview = Boolean(token) && (
    grantedActions.has('admin.vendor_approval') || hasPermission('admin.vendor_approval')
  );

  const summary = useMemo(() => {
    const counts = records.reduce<Record<string, number>>((acc, r) => {
      acc[r.VendorStatus] = (acc[r.VendorStatus] ?? 0) + 1;
      return acc;
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
    if (!token) { setRecords([]); return; }
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

  useEffect(() => { void loadRecords(); }, [token, filters.query, filters.status]);

  const openDetail = async (vendorId: string) => {
    if (!token) return;
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
    setShowDeleteConfirm(false);
    setDeleteReason('');
    setFeedback('');
    setError('');
    setModalError('');
    setModalFeedback('');
  };

  const refreshSelection = async (vendorId: string) => {
    await Promise.all([loadRecords(), openDetail(vendorId)]);
  };

  const handleDecision = async (decision: VendorApprovalStatus) => {
    if (!token || !detail) { setModalError('Select a vendor record before applying a decision.'); return; }
    if (!canReview) { setModalError('Your current role does not have vendor approval authority.'); return; }
    setIsSaving(true);
    setPendingDecision(decision);
    setModalError('');
    setModalFeedback('');
    try {
      await decideVendorApproval(token, detail.VendorId, { Decision: decision, Notes: reviewNote.trim() || undefined });
      await refreshSelection(detail.VendorId);
      setModalFeedback(
        decision === 'Active' ? `${detail.CompanyName} has been approved and activated.`
          : decision === 'Rejected' ? `${detail.CompanyName} has been rejected.`
            : `${detail.CompanyName} has been returned to pending approval.`
      );
    } catch (saveError) {
      setModalError(saveError instanceof Error ? saveError.message : 'Unable to update vendor approval status.');
    } finally {
      setIsSaving(false);
      setPendingDecision(null);
    }
  };

  const handleDownload = async (complianceDocument: VendorComplianceReviewItem) => {
    if (!token || !detail) { setModalError('Open a vendor record before downloading compliance documents.'); return; }
    setDownloadingDocumentId(complianceDocument.DocumentId);
    setModalError('');
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
      setModalError(downloadError instanceof Error ? downloadError.message : 'Unable to download compliance document.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleDelete = async () => {
    if (!token || !detail) { setModalError('Select a vendor record before deleting.'); return; }
    if (!canReview) { setModalError('Your current role does not have vendor approval authority.'); return; }
    setIsDeleting(true);
    setModalError('');
    setModalFeedback('');
    try {
      const result = await deleteVendor(token, detail.VendorId, deleteReason.trim() || undefined);
      setModalFeedback(result.Message || `${detail.CompanyName} has been deleted.`);
      setShowDeleteConfirm(false);
      setDeleteReason('');
      closeDetail();
      await loadRecords();
    } catch (deleteError) {
      setModalError(deleteError instanceof Error ? deleteError.message : 'Unable to delete vendor account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerifyDocument = async (documentId: string, status: 'Approved' | 'Rejected') => {
    if (!token || !detail) return;
    if (!canReview) { setModalError('Your current role does not have vendor approval authority.'); return; }

    setVerifyingDocumentId(documentId);
    setModalError('');
    setModalFeedback('');

    try {
      await verifyComplianceDocument(token, documentId, status, status === 'Rejected' ? rejectReason.trim() || undefined : undefined);
      setModalFeedback(`Document has been ${status.toLowerCase()}.`);
      setRejectDocId(null);
      setRejectReason('');
      await openDetail(detail.VendorId);
    } catch (verifyError) {
      setModalError(verifyError instanceof Error ? verifyError.message : 'Unable to verify document.');
    } finally {
      setVerifyingDocumentId(null);
    }
  };

  return (
    <section className="portal-module">
      <h2>{module.title}</h2>
      <p>{module.description}</p>

      {/* Summary cards */}
      <div className="va-summary">
        <article className="va-summary__card">
          <span className="va-summary__value">{summary.total}</span>
          <span className="va-summary__label">Total Vendors</span>
        </article>
        <article className={`va-summary__card ${summaryTone('warn')}`}>
          <span className="va-summary__value">{summary.pending}</span>
          <span className="va-summary__label">Pending Approval</span>
        </article>
        <article className={`va-summary__card ${summaryTone('good')}`}>
          <span className="va-summary__value">{summary.active}</span>
          <span className="va-summary__label">Active Vendors</span>
        </article>
        <article className={`va-summary__card ${summaryTone('alert')}`}>
          <span className="va-summary__value">{summary.rejected}</span>
          <span className="va-summary__label">Rejected Vendors</span>
        </article>
      </div>

      {/* Toolbar */}
      <div className="va-toolbar">
        <label className="plan-field">
          <span>Status</span>
          <select
            className="plan-select"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>Search</span>
          <input
            className="plan-input"
            value={filters.query}
            onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
            placeholder="Company, registration no, tax id, email"
          />
        </label>
        <div className="plan-actions">
          <button type="button" className="plan-button plan-button--secondary" onClick={() => void loadRecords()} disabled={!token || isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {!token ? <div className="portal-alert">Authentication token is missing.</div> : null}
      {!canReview && token ? (
        <div className="portal-alert" style={{ marginTop: '12px' }}>
          Your current role can view the workspace shell but does not have vendor approval authority.
        </div>
      ) : null}
      {feedback ? <div className="plan-success" style={{ marginTop: '12px' }}>{feedback}</div> : null}
      {error ? <div className="portal-alert" style={{ marginTop: '12px' }}>{error}</div> : null}

      {/* Vendor table */}
      <div className="va-table-card">
        <div className="va-table-card__header">
          <h3>Vendor Approval Queue</h3>
          <span className="va-table-card__count">{records.length} vendor{records.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="va-table-scroll">
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
                    <div className="va-company">
                      <button type="button" className="va-company__name" onClick={() => void openDetail(record.VendorId)}>
                        {record.CompanyName}
                      </button>
                      <span className="va-company__reg">{record.RegistrationNumber}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status ${statusTone(record.VendorStatus)}`}>{record.VendorStatus}</span>
                  </td>
                  <td>
                    <div className="va-docs">
                      <span className="va-docs__total">{record.ComplianceDocumentsCount} uploaded</span>
                      <span className="va-docs__breakdown">
                        {record.ApprovedDocumentsCount} approved &middot; {record.PendingDocumentsCount} pending &middot; {record.RejectedDocumentsCount} rejected
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="va-contact">
                      <span className="va-contact__name">{record.ContactPerson}</span>
                      <span className="va-contact__email">{record.Email}</span>
                    </div>
                  </td>
                  <td>{formatDateTimeShort(record.LastComplianceUpdateAt ?? record.RegistrationDate)}</td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={5} className="va-empty">
                    No vendor registrations match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selectedId ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={closeDetail} />
          <div className="plan-modal__content va-modal__content">
            <div className="va-modal__header">
              <div className="va-modal__header-text">
                <h3>{detail?.CompanyName || 'Vendor Registration Review'}</h3>
                <p>{detail?.RegistrationNumber || 'Loading vendor detail.'}</p>
              </div>
              <button type="button" className="va-modal__close" onClick={closeDetail}>Close</button>
            </div>

            <div className="va-modal__body">
              {isDetailLoading ? <div className="plan-loading">Loading vendor registration detail...</div> : null}
              {modalError ? <div className="portal-alert animate-shake">{modalError}</div> : null}
              {modalFeedback ? <div className="plan-success">{modalFeedback}</div> : null}

              {detail ? (
                <>
                  {/* Meta grid */}
                  <div className="va-meta">
                    <div className="va-meta__item">
                      <span className="va-meta__label">Status</span>
                      <span className="va-meta__value">
                        <span className={`admin-status ${statusTone(detail.VendorStatus)}`}>{detail.VendorStatus}</span>
                      </span>
                    </div>
                    <div className="va-meta__item">
                      <span className="va-meta__label">Account State</span>
                      <span className="va-meta__value">{detail.IsActive ? 'Active' : 'Disabled'}</span>
                    </div>
                    <div className="va-meta__item">
                      <span className="va-meta__label">Registered</span>
                      <span className="va-meta__value">{formatDateTimeShort(detail.RegistrationDate)}</span>
                    </div>
                    <div className="va-meta__item">
                      <span className="va-meta__label">Last Login</span>
                      <span className="va-meta__value">{formatDateTimeShort(detail.LastLogin)}</span>
                    </div>
                    <div className="va-meta__item">
                      <span className="va-meta__label">Tax ID</span>
                      <span className="va-meta__value">{detail.TaxId}</span>
                    </div>
                    <div className="va-meta__item">
                      <span className="va-meta__label">Phone</span>
                      <span className="va-meta__value">{detail.PhoneNumber || 'Not provided'}</span>
                    </div>
                  </div>

                  {/* Contact card */}
                  <div className="va-contact-card">
                    <h4>Company Contact</h4>
                    <p>{detail.ContactPerson} &middot; {detail.Email}</p>
                    <p>{detail.CompanyAddress}</p>
                  </div>

                  {/* Compliance documents */}
                  <div className="va-section">
                    <div className="va-section__header">
                      <h4>Compliance Documents</h4>
                    </div>
                    <div className="va-section__body">
                      <div className="portal-table-container">
                        <table className="plan-table">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>Status</th>
                              <th>Expiry</th>
                              <th>Updated</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.ComplianceDocuments.map((item) => (
                              <tr key={item.DocumentId}>
                                <td>{item.DocumentType}</td>
                                <td>
                                  <span className={`admin-status ${statusTone(item.VerificationStatus)}`}>{item.VerificationStatus}</span>
                                  {item.VerificationStatus === 'Rejected' && item.RejectionReason ? (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--portal-slate)', marginTop: '4px' }}>
                                      Reason: {item.RejectionReason}
                                    </div>
                                  ) : null}
                                </td>
                                <td>{formatDateTimeShort(item.ExpiryDate)}</td>
                                <td>{formatDateTimeShort(item.UpdatedAt)}</td>
                                <td>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="plan-link"
                                      onClick={() => void handleDownload(item)}
                                      disabled={downloadingDocumentId === item.DocumentId}
                                    >
                                      {downloadingDocumentId === item.DocumentId ? 'Downloading...' : 'Download'}
                                    </button>
                                    {canReview && item.VerificationStatus !== 'Approved' ? (
                                      <button
                                        type="button"
                                        className="plan-button plan-button--small"
                                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                        onClick={() => void handleVerifyDocument(item.DocumentId, 'Approved')}
                                        disabled={verifyingDocumentId === item.DocumentId}
                                      >
                                        {verifyingDocumentId === item.DocumentId ? 'Approving...' : 'Approve'}
                                      </button>
                                    ) : null}
                                    {canReview && item.VerificationStatus !== 'Rejected' ? (
                                      <button
                                        type="button"
                                        className="plan-button plan-button--danger plan-button--small"
                                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                        onClick={() => setRejectDocId(rejectDocId === item.DocumentId ? null : item.DocumentId)}
                                        disabled={verifyingDocumentId === item.DocumentId}
                                      >
                                        Reject
                                      </button>
                                    ) : null}
                                  </div>
                                  {rejectDocId === item.DocumentId ? (
                                    <div style={{ marginTop: '8px' }}>
                                      <input
                                        className="plan-input"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Rejection reason..."
                                        style={{ fontSize: '0.75rem', marginBottom: '6px' }}
                                      />
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          type="button"
                                          className="plan-button plan-button--danger plan-button--small"
                                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                          onClick={() => void handleVerifyDocument(item.DocumentId, 'Rejected')}
                                          disabled={verifyingDocumentId === item.DocumentId}
                                        >
                                          {verifyingDocumentId === item.DocumentId ? 'Rejecting...' : 'Confirm Reject'}
                                        </button>
                                        <button
                                          type="button"
                                          className="plan-button plan-button--secondary plan-button--small"
                                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                          onClick={() => { setRejectDocId(null); setRejectReason(''); }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                            {!detail.ComplianceDocuments.length ? (
                              <tr>
                                <td colSpan={5} className="va-empty">
                                  No compliance documents were uploaded for this vendor.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Decision panel */}
                  <div className="va-decision">
                    <div className="va-decision__header">
                      <h4>Admin Decision</h4>
                      <p>Review the registration pack and apply the current onboarding decision.</p>
                    </div>
                    <div className="va-decision__body">
                      <label className="plan-field">
                        <span>Review Note</span>
                        <textarea
                          className="plan-textarea"
                          rows={3}
                          value={reviewNote}
                          disabled={!canReview}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="Record the basis for approval, rejection, or return to pending review."
                        />
                      </label>
                      <div className="va-decision__actions">
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

                      <hr className="va-decision__divider" />

                      {/* Danger zone */}
                      <div className="va-danger-zone">
                        <p className="va-danger-zone__text">
                          Permanently remove this vendor account. This action cannot be undone.
                        </p>
                        {!showDeleteConfirm ? (
                          <button type="button" className="plan-button plan-button--danger" onClick={() => setShowDeleteConfirm(true)} disabled={!canReview || isSaving || isDeleting}>
                            Delete Vendor Account
                          </button>
                        ) : (
                          <>
                            <label className="plan-field" style={{ marginBottom: '12px' }}>
                              <span>Reason for deletion (optional)</span>
                              <textarea
                                className="plan-textarea"
                                rows={2}
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="Enter reason for deleting this vendor account..."
                              />
                            </label>
                            <div className="va-danger-zone__actions">
                              <button type="button" className="plan-button plan-button--secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteReason(''); }} disabled={isDeleting}>
                                Cancel
                              </button>
                              <button type="button" className="plan-button plan-button--danger" onClick={() => void handleDelete()} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
