'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  downloadComplianceChecklist,
  getComplianceHistory,
  getComplianceRequirements,
  getVendorComplianceDocuments,
  uploadComplianceDocument,
  type ComplianceHistoryResponse
} from '../services/vendorService';
import type { ComplianceDocument, ComplianceStatus } from '../types/vendor';
import { useAuth } from '../../../hooks/useAuth';

type Requirement = {
  id: string;
  name: string;
  required: boolean;
  frequency: string;
  expirable: boolean;
  description: string;
};

type ComplianceDocumentEntry = ComplianceDocument & {
  LastUpdated?: string;
};

const fallbackRequirements: Requirement[] = [
  {
    id: 'cac_certificate',
    name: 'CAC Certificate',
    required: true,
    frequency: 'One-time',
    expirable: false,
    description: 'Corporate Affairs Commission registration certificate.'
  },
  {
    id: 'tax_clearance',
    name: 'Tax Clearance Certificate',
    required: true,
    frequency: 'Annual',
    expirable: true,
    description: 'Most recent tax clearance certificate.'
  },
  {
    id: 'pencom_certificate',
    name: 'PENCOM Compliance Certificate',
    required: true,
    frequency: 'Annual',
    expirable: true,
    description: 'Pension compliance certificate (PENCOM).'
  },
  {
    id: 'itf_certificate',
    name: 'ITF Compliance Certificate',
    required: true,
    frequency: 'Annual',
    expirable: true,
    description: 'Industrial Training Fund compliance certificate.'
  },
  {
    id: 'company_profile',
    name: 'Company Profile',
    required: true,
    frequency: 'As needed',
    expirable: false,
    description: 'Company overview, ownership, and experience.'
  },
  {
    id: 'bank_reference',
    name: 'Bank Reference Letter',
    required: false,
    frequency: 'As needed',
    expirable: true,
    description: 'Bank reference letter or statement of good standing.'
  },
  {
    id: 'insurance_certificate',
    name: 'Insurance Certificate',
    required: false,
    frequency: 'Annual',
    expirable: true,
    description: 'Valid insurance coverage certificate.'
  }
];

const statusStyles: Record<ComplianceStatus, string> = {
  Missing: 'bg-slate-100 text-slate-700 border-slate-200',
  Uploaded: 'bg-amber-100 text-amber-800 border-amber-200',
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  Expired: 'bg-rose-100 text-rose-800 border-rose-200'
};

const normalizeStatus = (value?: string): ComplianceStatus => {
  if (!value) return 'Uploaded';
  const normalized = value.toLowerCase();
  if (normalized.includes('approved')) return 'Approved';
  if (normalized.includes('reject')) return 'Rejected';
  if (normalized.includes('expire')) return 'Expired';
  if (normalized.includes('missing')) return 'Missing';
  if (normalized.includes('pending')) return 'Uploaded';
  return 'Uploaded';
};

const formatDate = (value?: string) => {
  if (!value) return 'Not specified';
  return new Date(value).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getDaysLeft = (value?: string) => {
  if (!value) return null;
  const diff = new Date(value).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const ComplianceDocumentsPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isReady, hasSessionAttempted, user } = useAuth();
  const [requirements, setRequirements] = useState<Requirement[]>(fallbackRequirements);
  const [documents, setDocuments] = useState<ComplianceDocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeRequirement, setActiveRequirement] = useState<Requirement | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<ComplianceHistoryResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyDoc, setHistoryDoc] = useState<Requirement | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!hasSessionAttempted) {
      return;
    }

    if (!isAuthenticated || !user?.UserId) {
      router.replace('/vendors/login?next=%2Fvendors%2Fdashboard%2Fcompliance-documents');
      return;
    }

    let active = true;
    const loadDocuments = async () => {
      setLoading(true);
      try {
        const [apiRequirements, apiDocs] = await Promise.all([
          getComplianceRequirements().catch(() => []),
          getVendorComplianceDocuments()
        ]);

        const resolvedRequirements = apiRequirements.length
          ? apiRequirements.map((req) => ({
              id: req.Id,
              name: req.Name,
              required: req.Required,
              frequency: req.Frequency,
              expirable: req.Expirable,
              description: req.Description
            }))
          : fallbackRequirements;

        const mapped = resolvedRequirements.map((req) => {
          const match = apiDocs.find((doc) => doc.DocumentType === req.id);
          if (!match) {
            return {
              Id: req.id,
              Name: req.name,
              Status: 'Missing' as ComplianceStatus,
              LastUpdated: undefined
            };
          }

          const normalizedStatus = normalizeStatus(match.Status);
          const expiry = match.ExpiryDate ? new Date(match.ExpiryDate).toISOString() : undefined;
          const resolvedStatus =
            expiry && new Date(expiry).getTime() < new Date().getTime()
              ? 'Expired'
              : normalizedStatus;

          return {
            Id: req.id,
            Name: req.name,
            Status: resolvedStatus,
            ExpiryDate: expiry,
            FileUrl: match.FileUrl,
            RejectionReason: match.RejectionReason ?? undefined,
            LastUpdated: match.CreatedAt ?? match.ExpiryDate ?? undefined
          } satisfies ComplianceDocumentEntry;
        });

        if (active) {
          setRequirements(resolvedRequirements);
          setDocuments(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Unable to load compliance documents.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDocuments();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isReady, hasSessionAttempted, router]);

  const documentsById = useMemo(() => {
    return documents.reduce<Record<string, ComplianceDocumentEntry>>((acc, doc) => {
      acc[doc.Id] = doc;
      return acc;
    }, {});
  }, [documents]);

  const rows = useMemo(() => {
    return requirements.map((req) => {
      const doc = documentsById[req.id];
      const status = doc?.Status ?? 'Missing';
      const daysLeft = getDaysLeft(doc?.ExpiryDate);
      const resolvedStatus =
        req.expirable && daysLeft !== null && daysLeft < 0 ? 'Expired' : status;
      const expiringSoon = daysLeft !== null && daysLeft <= 30;
      return {
        requirement: req,
        doc,
        status: resolvedStatus,
        daysLeft,
        expiringSoon
      };
    });
  }, [documentsById, requirements]);

  const summary = useMemo(() => {
    const approved = rows.filter((row) => row.status === 'Approved').length;
    const uploaded = rows.filter((row) => row.status === 'Uploaded').length;
    const rejected = rows.filter((row) => row.status === 'Rejected').length;
    const expiring = rows.filter((row) => row.expiringSoon).length;
    const requiredAtRisk = rows.some((row) => row.requirement.required && row.status !== 'Approved');
    return {
      approved,
      uploaded,
      rejected,
      expiring,
      requiredAtRisk
    };
  }, [rows]);

  const openUpload = (req: Requirement, doc?: ComplianceDocumentEntry) => {
    setActiveRequirement(req);
    setUploadFile(null);
    setExpiryDate(doc?.ExpiryDate ? doc.ExpiryDate.slice(0, 10) : '');
    setUploadError(null);
  };

  const closeUpload = () => {
    setActiveRequirement(null);
    setUploadFile(null);
    setExpiryDate('');
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!activeRequirement) return;
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (activeRequirement.expirable && !expiryDate) {
      setUploadError('Please provide the expiry date for this document.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const response = await uploadComplianceDocument(activeRequirement.id, uploadFile, expiryDate || undefined);
      const updated: ComplianceDocumentEntry = {
        Id: activeRequirement.id,
        Name: activeRequirement.name,
        Status: normalizeStatus(response.Status),
        ExpiryDate: activeRequirement.expirable && expiryDate ? new Date(expiryDate).toISOString() : undefined,
        FileUrl: response.FileUrl,
        RejectionReason: response.RejectionReason ?? undefined,
        LastUpdated: new Date().toISOString()
      };

      setDocuments((prev) => {
        const next = prev.filter((doc) => doc.Id !== activeRequirement.id);
        next.push(updated);
        return next;
      });
      closeUpload();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadChecklist = async () => {
    setDownloadError(null);
    try {
      const blob = await downloadComplianceChecklist();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'compliance-checklist.txt';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err.message || 'Unable to download checklist.');
    }
  };

  const openHistory = async (req: Requirement) => {
    setHistoryDoc(req);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await getComplianceHistory(req.id);
      setHistoryItems(items);
    } catch (err: any) {
      setHistoryError(err.message || 'Unable to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryItems([]);
    setHistoryError(null);
    setHistoryDoc(null);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading compliance documents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-800 px-6 py-8 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Vendor Compliance</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Compliance Documents</h2>
            <p className="mt-3 max-w-2xl text-sm text-emerald-100 sm:text-base">
              Upload and maintain required documents to remain eligible for tender submissions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadChecklist}
              className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Download Checklist
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Help
            </button>
          </div>
        </div>
      </div>

      {downloadError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {downloadError}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.approved}</p>
              <p className="text-xs text-slate-500">Approved documents</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Review</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.uploaded}</p>
              <p className="text-xs text-slate-500">Awaiting validation</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expiring Soon</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.expiring}</p>
              <p className="text-xs text-slate-500">Within 30 days</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rejected</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.rejected}</p>
              <p className="text-xs text-slate-500">Requires resubmission</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Document Register</h3>
                <p className="text-sm text-slate-500">Keep all documents current and validated.</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  summary.requiredAtRisk
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {summary.requiredAtRisk ? 'Eligibility: At Risk' : 'Eligibility: Eligible'}
              </span>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Document</th>
                    <th className="px-3 py-2">Requirement</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2">Last Updated</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ requirement, doc, status, daysLeft, expiringSoon }) => (
                    <tr key={requirement.id} className={`border-b border-slate-100 ${expiringSoon ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-slate-900">{requirement.name}</p>
                        <p className="text-xs text-slate-500">{requirement.description}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            requirement.required
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {requirement.required ? 'Required' : 'Optional'}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">{requirement.frequency}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                          {status}
                        </span>
                        {status === 'Rejected' && doc?.RejectionReason && (
                          <p className="mt-1 text-xs text-rose-600">Reason: {doc.RejectionReason}</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-slate-900">{requirement.expirable ? formatDate(doc?.ExpiryDate) : 'Not required'}</p>
                        {requirement.expirable && daysLeft !== null && (
                          <p className={`text-xs ${daysLeft <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {daysLeft >= 0 ? `${daysLeft} days left` : 'Expired'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-slate-900">{doc?.FileUrl ? 'Uploaded' : 'Not uploaded'}</p>
                        <p className="text-xs text-slate-500">{doc?.LastUpdated ? formatDate(doc.LastUpdated) : '-'}</p>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openUpload(requirement, doc)}
                            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                          >
                            {doc?.Status && doc.Status !== 'Missing' ? 'Replace' : 'Upload'}
                          </button>
                          {doc?.FileUrl && (
                            <a
                              href={doc.FileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              View
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openHistory(requirement)}
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Requirements</h3>
          <p className="text-sm text-slate-500">Keep required documents valid to maintain eligibility.</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {requirements.map((req) => (
              <li key={req.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{req.name}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {req.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{req.description}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {activeRequirement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Upload Document</p>
                <h3 className="text-xl font-bold text-slate-900">{activeRequirement.name}</h3>
              </div>
              <button
                type="button"
                onClick={closeUpload}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Select file</label>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                />
              </div>

              {activeRequirement.expirable && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expiry date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              )}

              {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeUpload}
                className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Compliance Help</p>
                <h3 className="text-xl font-bold text-slate-900">Document Guidance</h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Upload current documents in PDF or image format. Ensure expiry dates are correct for renewable
              certificates. Any update will reset verification status to Pending.
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {requirements.map((req) => (
                <div key={req.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">{req.name}</h4>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        req.required
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {req.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{req.description}</p>
                  <p className="mt-2 text-xs text-slate-500">Frequency: {req.frequency}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {historyOpen && historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Submission History</p>
                <h3 className="text-xl font-bold text-slate-900">{historyDoc.name}</h3>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {historyLoading && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Loading history...
              </div>
            )}

            {historyError && !historyLoading && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
                {historyError}
              </div>
            )}

            {!historyLoading && !historyError && historyItems.length === 0 && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                No history available yet.
              </div>
            )}

            {!historyLoading && !historyError && historyItems.length > 0 && (
              <div className="mt-6 space-y-3">
                {historyItems.map((item) => (
                  <div key={item.HistoryId} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatDate(item.CreatedAt)}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[normalizeStatus(item.Status)]}`}>
                        {normalizeStatus(item.Status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Expiry: {item.ExpiryDate ? formatDate(item.ExpiryDate) : 'Not specified'}
                    </div>
                    {item.FileUrl && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={item.FileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          View
                        </a>
                        <a
                          href={item.FileUrl}
                          download
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDocumentsPage;
