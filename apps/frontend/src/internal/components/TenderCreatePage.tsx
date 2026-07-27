import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { InternalModule, RequisitionDetail, RequisitionSummary, TenderSummary } from '../types/internal';
import { fetchApprovedRequisitions, createTender, deleteTender, publishTender, fetchTenderDetails } from '../services/moduleService.tenders';
import { fetchTenderWorkflowDisplay } from '../services/tenderWorkflowService';
import { fetchTenders } from '../services/tenderService';
import { fetchRequisitionDetail } from '../services/requisitionService';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import type { WorkflowRuntimeDisplay } from './workflowDisplayTypes';
import { getInternalDashboardPath } from '../utils/internalRoutes';

interface Props {
  token: string | null;
  module?: InternalModule;
}

export const TenderCreatePage: React.FC<Props> = ({ token, module }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit');
  const sourceModuleId = searchParams?.get('source') || module?.id || 'create-tender';
  const tabParam = searchParams?.get('tab');
  const activeTab = tabParam === 'drafts' ? 'drafts' : tabParam === 'published' ? 'published' : 'create';

  const [step, setStep] = useState<'select' | 'existing' | 'draft' | 'publish'>(editId ? 'publish' : 'select');
  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [existingTenders, setExistingTenders] = useState<TenderSummary[]>([]);
  const [publishedTenders, setPublishedTenders] = useState<TenderSummary[]>([]);
  const [tenderId, setTenderId] = useState<string | null>(editId);
  const [tender, setTender] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    RequisitionId: '',
    Title: '',
    Description: '',
    Category: 'Goods',
    Requirements: '',
    EvaluationCriteria: '',
    EstimatedValue: 0
  });

  const [publishForm, setPublishForm] = useState({
    PublishDate: new Date().toISOString().split('T')[0],
    OpeningDate: '',
    ClosingDate: ''
  });

  const buildSpecificationsFromLineItems = (detail: RequisitionDetail) => {
    if (!detail.LineItems?.length) {
      return '';
    }

    return detail.LineItems
      .map((item, index) => {
        const quantity = Number(item.Quantity || 0);
        const unit = String(item.Unit || '').trim();
        const description = String(item.Description || '').trim();
        const quantityLabel = quantity > 0 ? `${quantity}` : '';
        return `${index + 1}. ${quantityLabel}${unit ? ` ${unit}` : ''} ${description}`.replace(/\s+/g, ' ').trim();
      })
      .join('\n');
  };

  const buildEligibilityCriteriaTemplate = () => [
    'Valid CAC registration or equivalent business registration document.',
    'Current Tax Clearance Certificate.',
    'PENCOM compliance certificate where applicable.',
    'ITF compliance certificate where applicable.',
    'NSITF compliance evidence where applicable.',
    'Evidence of similar contract experience.',
    'Relevant professional, technical, or regulatory licenses where applicable.',
    'Signed bid declaration and conflict-of-interest disclosure.'
  ].join('\n');

  const buildEvaluationCriteriaByProcurementType = (procurementType?: string | null) => {
    switch ((procurementType || '').trim().toLowerCase()) {
      case 'works':
        return [
          'Preliminary examination: responsiveness to mandatory submission requirements.',
          'Technical evaluation: methodology, work programme, key personnel, equipment, and relevant experience.',
          'Financial evaluation: comparison of responsive bids and arithmetic checks.',
          'Post-qualification: validation of capacity, references, and statutory compliance before award.'
        ].join('\n');
      case 'services':
        return [
          'Preliminary examination: responsiveness to mandatory submission requirements.',
          'Technical evaluation: understanding of assignment, methodology, team composition, and relevant experience.',
          'Financial evaluation: comparison of financial proposals for technically responsive bidders.',
          'Final recommendation based on the applicable quality and cost assessment method.'
        ].join('\n');
      default:
        return [
          'Preliminary examination: responsiveness to mandatory submission requirements.',
          'Technical evaluation: compliance with specifications, delivery capacity, warranty, and relevant experience.',
          'Financial evaluation: comparison of responsive bids and arithmetic checks.',
          'Post-qualification: validation of statutory compliance and vendor capacity before award.'
        ].join('\n');
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchApprovedRequisitions(token).then(setRequisitions).catch(() => setError('Failed to load requisitions'));
  }, [token]);

  useEffect(() => {
    if (!token || editId) return;

    fetchTenders(token, {
      page: 1,
      pageSize: 50,
      sortBy: 'created_at',
      sortDir: 'desc'
    })
      .then((response) => {
        setExistingTenders((response.Items || []).filter((item) => item.Status === 'Draft'));
      })
      .catch(() => setError('Failed to load tender drafts'));
  }, [editId, token]);

  useEffect(() => {
    if (!token || editId) return;

    fetchTenders(token, {
      status: 'Published',
      page: 1,
      pageSize: 50,
      sortBy: 'publish_date',
      sortDir: 'desc'
    })
      .then((response) => {
        setPublishedTenders(response.Items || []);
      })
      .catch(() => setError('Failed to load published tenders'));
  }, [editId, token]);

  useEffect(() => {
    if (!editId || !token) return;
    loadTender(editId);
  }, [editId, token]);

  useEffect(() => {
    if (editId) {
      setStep('publish');
      return;
    }

    if (activeTab === 'drafts') {
      setTenderId(null);
      setTender(null);
      setWorkflow(null);
      setStep('existing');
      return;
    }

    if (activeTab === 'published') {
      setTenderId(null);
      setTender(null);
      setWorkflow(null);
      setStep('publish');
      return;
    }

    setTenderId(null);
    setTender(null);
    setWorkflow(null);
    setStep('select');
  }, [activeTab, editId]);

  const loadTender = async (id: string) => {
    setLoading(true);
    try {
      const [tenderData, workflowData] = await Promise.all([
        fetchTenderDetails(id, token!),
        fetchTenderWorkflowDisplay(id, token!)
      ]);
      setTender(tenderData);
      setWorkflow(workflowData);
      if (tenderData.Status === 'Draft') setStep('publish');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildWorkspacePath = (
    tab: 'create' | 'drafts' | 'published',
    options?: { editId?: string | null }
  ) => {
    const params = new URLSearchParams();
    params.set('source', sourceModuleId);
    params.set('tab', tab);

    if (options?.editId) {
      params.set('edit', options.editId);
    }

    return `${getInternalDashboardPath('create-tender')}?${params.toString()}`;
  };

  const navigateToTab = (tab: 'create' | 'drafts' | 'published') => {
    router.push(buildWorkspacePath(tab));
  };

  const handleCloseTender = () => {
    if (tender?.Status === 'Published') {
      navigateToTab('published');
      return;
    }

    navigateToTab('drafts');
  };

  const refreshDraftTenders = async () => {
    if (!token) return;

    const response = await fetchTenders(token, {
      page: 1,
      pageSize: 50,
      sortBy: 'created_at',
      sortDir: 'desc'
    });

    setExistingTenders((response.Items || []).filter((item) => item.Status === 'Draft'));
  };

  const handleDeleteDraft = async (id: string) => {
    if (!token) return;
    if (!confirm('Delete this draft tender? This action cannot be undone.')) return;

    setLoading(true);
    setError(null);
    try {
      await deleteTender(id, token);
      setExistingTenders((current) => current.filter((item) => item.TenderId !== id));
      if (tenderId === id) {
        setTenderId(null);
        setTender(null);
        setWorkflow(null);
        navigateToTab('drafts');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRequisition = async (id: string) => {
    if (!token) return;

    const req = requisitions.find(r => r.RequisitionId === id);
    setLoading(true);
    setError(null);

    try {
      const detail = await fetchRequisitionDetail(token, id);
      setForm({
        RequisitionId: id,
        Title: req?.Title ?? detail.Title ?? '',
        Description: req ? `Tender for ${req.Title}` : `Tender for ${detail.Title}`,
        Category: detail.ProcurementType || 'Goods',
        Requirements: buildSpecificationsFromLineItems(detail),
        EvaluationCriteria: buildEvaluationCriteriaByProcurementType(detail.ProcurementType),
        EstimatedValue: 0
      });
      setStep('draft');
      router.replace(buildWorkspacePath('create'));
    } catch (err: any) {
      setError(err.message || 'Failed to load requisition detail.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const created = await createTender(form, token);
      setTenderId(created.TenderId);
      setTender(created);
      setStep('publish');
      router.replace(buildWorkspacePath('drafts', { editId: created.TenderId }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateTimeline = () => {
    if (!publishForm.PublishDate || !publishForm.ClosingDate) return true;
    const start = new Date(publishForm.PublishDate);
    const end = new Date(publishForm.ClosingDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) >= 42;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tenderId) return;

    const timelineValid = validateTimeline();
    console.log('[Authorize Publication] submit', {
      tenderId,
      publishForm,
      timelineValid
    });

    if (!timelineValid) {
      console.warn('[Authorize Publication] timeline validation failed', {
        tenderId,
        publishForm
      });
      if (!confirm('Advertising period is less than mandatory 42 days (6 weeks). Proceed anyway?')) return;
    }

    setLoading(true);
    try {
      const result = await publishTender(tenderId, {
        PublishedAt: publishForm.PublishDate,
        ClosingDate: publishForm.ClosingDate
      }, token);
      console.log('[Authorize Publication] publish succeeded', {
        tenderId,
        result
      });
      await refreshDraftTenders();
      router.push(backPath);
    } catch (err: any) {
      console.error('[Authorize Publication] publish failed', {
        tenderId,
        publishForm,
        error: err
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedReq = requisitions.find(r => r.RequisitionId === form.RequisitionId);
  const backPath = getInternalDashboardPath(sourceModuleId);
  const pageTitle = module?.title || 'Tender Management';

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{pageTitle}</h2>
        </div>
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {!editId && (
        <nav className="workflow-config-tabs" aria-label="Tender management views" style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className={activeTab === 'create' ? 'active' : undefined}
            onClick={() => navigateToTab('create')}
          >
            Create Tender
          </button>
          <button
            type="button"
            className={activeTab === 'drafts' ? 'active' : undefined}
            onClick={() => navigateToTab('drafts')}
          >
            Draft Tenders
          </button>
          <button
            type="button"
            className={activeTab === 'published' ? 'active' : undefined}
            onClick={() => navigateToTab('published')}
          >
            Published Tenders
          </button>
        </nav>
      )}

      {step === 'existing' && (
        <div className="app-card">
          <h3 className="app-card__title">Select Draft Tender to Publish</h3>
          <div className="requisition-grid">
            {existingTenders.map((item) => (
              <div key={item.TenderId} className="requisition-card">
                <div className="requisition-card__title">{item.Title}</div>
                <div className="requisition-card__meta">
                  {item.Category} • {(item.EstimatedValue ?? 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                </div>
                <div className="portal-form-actions" style={{ marginTop: '12px', gap: '8px' }}>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    onClick={() => {
                      router.push(buildWorkspacePath('drafts', { editId: item.TenderId }));
                    }}
                  >
                    Open Draft
                  </button>
                  <button
                    type="button"
                    className="plan-button plan-button--secondary"
                    onClick={() => void handleDeleteDraft(item.TenderId)}
                    style={{ marginLeft: '8px' }}
                    disabled={loading}
                  >
                    Delete Draft
                  </button>
                </div>
              </div>
            ))}
            {existingTenders.length === 0 && <p className="plan-empty">No draft tenders are currently available for publication.</p>}
          </div>
        </div>
      )}

      {step === 'publish' && !tender && !editId && (
        <div className="app-card">
          <h3 className="app-card__title">Published Tenders</h3>
          <div className="requisition-grid">
            {publishedTenders.map((item) => (
              <button
                key={item.TenderId}
                className="requisition-card"
                onClick={() => {
                  router.push(buildWorkspacePath('published', { editId: item.TenderId }));
                }}
              >
                <div className="requisition-card__title">{item.Title}</div>
                <div className="requisition-card__meta">
                  {item.Category} • Closes {item.ClosingDate ? new Date(item.ClosingDate).toLocaleDateString() : 'Not set'}
                </div>
              </button>
            ))}
            {publishedTenders.length === 0 && <p className="plan-empty">No published tenders are currently available.</p>}
          </div>
        </div>
      )}

      {step === 'select' && (
        <div className="app-card">
          <h3 className="app-card__title">Create New Tender</h3>
          <div className="requisition-grid">
            {requisitions.map(req => (
              <button
                key={req.RequisitionId}
                className="requisition-card"
                onClick={() => handleSelectRequisition(req.RequisitionId)}
              >
                <div className="requisition-card__title">{req.Title}</div>
                <div className="requisition-card__meta">{req.Department} • {req.TotalEstimate?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</div>
              </button>
            ))}
            {requisitions.length === 0 && <p className="plan-empty">No approved requisitions available.</p>}
          </div>
        </div>
      )}

      {step === 'draft' && selectedReq && (
        <form className="portal-form app-card" onSubmit={handleCreate}>
          <h3 className="app-card__title">Tender Draft Details</h3>
          <div className="portal-form-grid">
            <label className="plan-field">
              <span>Requisition</span>
              <input className="plan-input" value={selectedReq.Title} disabled />
            </label>
            <label className="plan-field">
              <span>Tender Title</span>
              <input className="plan-input" required value={form.Title} onChange={e => setForm({ ...form, Title: e.target.value })} />
            </label>
            <label className="plan-field">
              <span>Category</span>
              <select className="plan-input" value={form.Category} onChange={e => setForm({ ...form, Category: e.target.value })}>
                <option>Goods</option>
                <option>Works</option>
                <option>Services</option>
              </select>
            </label>
          </div>
          <label className="plan-field">
            <span>Scope & Instructions</span>
            <textarea className="plan-input" rows={4} value={form.Description} onChange={e => setForm({ ...form, Description: e.target.value })} />
          </label>
          <label className="plan-field">
            <span>Requirements</span>
            <textarea
              className="plan-input"
              rows={5}
              value={form.Requirements}
              onChange={e => setForm({ ...form, Requirements: e.target.value })}
              placeholder="Enter technical specifications, scope details, deliverables, standards, or bill of quantities."
            />
          </label>
          <label className="plan-field">
            <span>Evaluation Criteria</span>
            <textarea
              className="plan-input"
              rows={4}
              value={form.EvaluationCriteria}
              onChange={e => setForm({ ...form, EvaluationCriteria: e.target.value })}
              placeholder="Enter the evaluation basis, such as pass/fail compliance, technical weighting, financial weighting, delivery timeline, or post-qualification rules."
            />
          </label>
          <div className="requisition-seed">
            <h4>Requisition Seed</h4>
            <ul>
              <li><strong>Department:</strong> {selectedReq.Department}</li>
              <li><strong>Approved Estimate:</strong> {selectedReq.TotalEstimate?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</li>
            </ul>
          </div>
          <div className="portal-form-actions" style={{ marginTop: '16px', gap: '20px' }}>
            <button type="button" className="plan-button plan-button--secondary" onClick={() => navigateToTab('create')}>Back</button>
            <button type="submit" className="plan-button" style={{ marginLeft: '16px' }} disabled={loading}>Create Draft</button>
          </div>
        </form>
      )}

      {step === 'publish' && tender && (
        <div className="app-card">
          <div className="portal-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '12px' }}>
            <button
              type="button"
              className="plan-button plan-button--secondary"
              onClick={handleCloseTender}
            >
              Close
            </button>
          </div>
          <div className="plan-summary-card">
            <h3>{tender.Title}</h3>
            <div className="plan-summary-card__grid">
              <div><small>Reference</small><p>{tender.TenderId?.slice(0, 8).toUpperCase()}</p></div>
              <div><small>Status</small><p>{workflow?.CurrentStageTitle || tender.Status || 'Unknown'}</p></div>
              <div><small>Estimated Value</small><p>{tender.EstimatedValue?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</p></div>
            </div>
          </div>

          {workflow?.CurrentStageKey && (
            <WorkflowProgressStepper
              currentStageKey={workflow.CurrentStageKey}
              display={workflow.WorkflowDisplay as WorkflowRuntimeDisplay | null | undefined}
            />
          )}

          {tender.Status === 'Draft' ? (
            <form className="portal-form" onSubmit={handlePublish}>
              <h4>PPA 2007 Publication Control</h4>
              <div className="portal-form-grid">
                <label className="plan-field">
                  <span>Publication Date</span>
                  <input type="date" className="plan-input" required value={publishForm.PublishDate} onChange={e => setPublishForm({ ...publishForm, PublishDate: e.target.value })} />
                </label>
                <label className="plan-field">
                  <span>Closing Date</span>
                  <input type="date" className="plan-input" required value={publishForm.ClosingDate} onChange={e => setPublishForm({ ...publishForm, ClosingDate: e.target.value })} />
                </label>
                <label className="plan-field">
                  <span>Public Bid Opening</span>
                  <input type="date" className="plan-input" required value={publishForm.OpeningDate} onChange={e => setPublishForm({ ...publishForm, OpeningDate: e.target.value })} />
                </label>
              </div>

              <div className="ppa-checklist">
                <h4>Compliance Checklist</h4>
                <label><input type="checkbox" required /> Bidding documents ready for download</label>
                <label><input type="checkbox" required /> Eligibility criteria stated (CAC, Tax, PENCOM)</label>
                <label className={validateTimeline() ? 'valid' : 'invalid'}>
                  <input type="checkbox" checked={validateTimeline()} readOnly />
                  {validateTimeline() ? '6-week advertising period met' : 'Period less than 6 weeks (PPA violation)'}
                </label>
              </div>

              <div className="portal-form-actions" style={{ marginTop: '16px' }}>
                {!editId && (
                  <button type="button" className="plan-button plan-button--secondary" onClick={() => navigateToTab('create')}>
                    Back
                  </button>
                )}
                <button
                  type="button"
                  className="plan-button plan-button--secondary"
                  onClick={() => {
                    if (!tenderId) {
                      return;
                    }
                    void handleDeleteDraft(tenderId);
                  }}
                  disabled={loading}
                >
                  Delete Draft
                </button>
                <button type="submit" className="plan-button" style={{ marginLeft: '16px' }} disabled={loading}>Authorize Publication</button>
              </div>
            </form>
          ) : (
            <div className="portal-alert portal-alert--success">This tender is LIVE. Bidders can submit until {new Date(tender.ClosingDate!).toLocaleDateString()}.</div>
          )}
        </div>
      )}
    </section>
  );
};
