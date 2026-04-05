'use client';

import { useEffect, useState } from 'react';
import { fetchTenders } from '../services/tenderService';
import type { InternalModule, TenderSummary, TenderDetail, RoleKey } from '../types/internal';
import { TenderDetailContent } from './tenderWorkspace/detailViews';
import { TenderCreateView } from './tenderWorkspace/sectionViews';
import { WorkflowProgressStepper } from './WorkflowProgressStepper';
import { canEditTenderFromAuthority, toTitle } from './tenderWorkspace/helpers';

interface Props {
  module: InternalModule;
  token?: string | null;
  role?: RoleKey | null;
  userEmail?: string | null;
  availableModuleIds?: string[];
  onModuleChange?: (moduleId: string) => void;
}

export const HighValueTendersPage = ({ module, token, role, userEmail, availableModuleIds = [], onModuleChange }: Props) => {
  const [filters, setFilters] = useState<{
    query: string;
    minValue: number;
    maxValue: number;
    page: number;
  }>({
    query: '',
    minValue: 1000000, // High value threshold: 1,000,000+
    maxValue: 100000000, // Up to 100M
    page: 1
  });

  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TenderDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<any>(null);
  const [workflowError, setWorkflowError] = useState('');
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);

  const pageSize = 10;

  const loadTenders = async (pageOverride?: number) => {
    if (!token) {
      setTenders([]);
      setTotalItems(0);
      return;
    }

    const page = pageOverride ?? filters.page;
    setIsListLoading(true);
    setListError('');

    try {
      const response = await fetchTenders(token, {
        query: filters.query.trim() || undefined,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        page,
        pageSize
      });
      setTenders(response.Items);
      setTotalItems(response.Total);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load high-value tenders.');
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    void loadTenders();
  }, [token, filters.query, filters.minValue, filters.maxValue, filters.page, pageSize]);

  const openDetail = (tenderId: string, modal = false) => {
    setSelectedId(tenderId);
    setIsDetailModalOpen(modal);
  };

  const loadTenderDetail = async () => {
    if (!token || !selectedId) {
      setSelectedDetail(null);
      return;
    }

    setIsDetailLoading(true);
    try {
      // In a real implementation, we would call a fetchTenderDetail service
      // For now, we'll simulate with the list data
      const tender = tenders.find(t => t.TenderId === selectedId);
      if (tender) {
        // Convert summary to detail (in reality, this would come from a detail endpoint)
        setSelectedDetail({
          ...tender,
          Description: `Detailed description for ${tender.Title}`,
          Specifications: 'Technical specifications would be here',
          EligibilityCriteria: 'Eligibility criteria details',
          EvaluationCriteria: 'Evaluation criteria details',
          UpdatedAt: tender.CreatedAt,
          CurrentStage: 'Under BPP Review'
        });
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Unable to load tender detail.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      void loadTenderDetail();
    }
  }, [selectedId, token, tenders]);

  useEffect(() => {
    if (!isDetailModalOpen) {
      setSelectedDetail(null);
    }
  }, [isDetailModalOpen]);

  // Workflow context loading (simplified)
  useEffect(() => {
    if (!role || !token || !selectedId) {
      setWorkflowSnapshot(null);
      setWorkflowError('');
      setIsWorkflowLoading(false);
      return;
    }

    setIsWorkflowLoading(true);
    setWorkflowError('');

    // In a real implementation, we would call workflow context services
    // For now, we'll simulate basic workflow data
    setTimeout(() => {
      setWorkflowSnapshot({
        EntityType: 'tender',
        EntityId: selectedId,
        CurrentStageKey: 'bpp-review',
        CurrentStageTitle: 'Under BPP Review',
        RoleKey: role ?? 'bpp_officer',
        Actions: ['approve', 'reject', 'request-revision']
      });
      setIsWorkflowLoading(false);
    }, 500);

    return () => {
      // Cleanup would go here
    };
  }, [role, token, selectedId]);

  const summary = {
    total: totalItems,
    underReview: tenders.filter(t => t.Status === 'Published' || t.Status === 'Open').length,
    evaluation: tenders.filter(t => t.Status === 'Under Evaluation').length,
    awarded: tenders.filter(t => t.Status === 'Awarded').length
  };

  return (
    <section className="portal-module">
      <div className="tender-header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="tender-badges">
          <span className="tender-badge tender-badge--soft">{module.microservice}</span>
          <span className="tender-badge tender-badge--accent">{summary.total} high-value tenders</span>
        </div>
      </div>

      <div className="tender-metrics" style={{ marginTop: '16px' }}>
        <div><span>Under Review</span><strong>{summary.underReview}</strong></div>
        <div><span>In Evaluation</span><strong>{summary.evaluation}</strong></div>
        <div><span>Awarded</span><strong>{summary.awarded}</strong></div>
        <div><span>Current role</span><strong>{role ? toTitle(role) : 'Unspecified'}</strong></div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div className="filter-controls">
          <label>
            Minimum Value (₦): 
            <input 
              type="number" 
              value={filters.minValue} 
              onChange={(e) => setFilters(prev => ({ ...prev, minValue: Number(e.target.value) || 0, page: 1 }))}
              min="0"
            />
          </label>
          <label>
            Maximum Value (₦): 
            <input 
              type="number" 
              value={filters.maxValue} 
              onChange={(e) => setFilters(prev => ({ ...prev, maxValue: Number(e.target.value) || 100000000, page: 1 }))}
              min="0"
            />
          </label>
        </div>
      </div>

      {!token ? <div className="portal-alert" style={{ marginTop: '16px' }}>Authentication token is missing.</div> : null}
      {listError ? <div className="portal-alert" style={{ marginTop: '16px' }}>{listError}</div> : null}

      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {tenders.map(tender => (
          <div key={tender.TenderId} className="tender-card">
            <div className="tender-card__header">
              <h3>{tender.Title}</h3>
              <p className="tender-card__status">{tender.Status}</p>
            </div>
            <div className="tender-card__body">
              <p><strong>Category:</strong> {tender.Category}</p>
              <p><strong>Published:</strong> {new Date(tender.CreatedAt).toLocaleDateString()}</p>
              {tender.Budget !== null && <p><strong>Budget:</strong> ${tender.Budget.toLocaleString()}</p>}
            </div>
            <div className="tender-card__actions">
              <button 
                type="button" 
                className="tender-button tender-button--secondary"
                onClick={() => openDetail(tender.TenderId, true)}
              >
                Review Details
              </button>
            </div>
          </div>
        ))}
        {tenders.length === 0 && !isListLoading && (
          <div className="portal-empty">
            <p>No high-value tenders match the current filters.</p>
          </div>
        )}
      </div>

      {isDetailModalOpen && selectedDetail ? (
        <div className="plan-modal" role="dialog" aria-modal="true">
          <div className="plan-modal__backdrop" onClick={() => setIsDetailModalOpen(false)} />
          <div className="plan-modal__content tender-detail-modal">
            <div className="tender-card__header">
              <div>
                <h3>High-Value Tender Detail Review</h3>
                <p>Review the complete tender submission before making a BPP decision.</p>
              </div>
              <button type="button" className="plan-link" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
            
            {isDetailLoading ? (
              <div className="plan-loading">Loading tender detail...</div>
            ) : (
              <TenderDetailContent
                detail={selectedDetail}
                isSelectedEditable={false} // Review mode is read-only
                workflowSnapshot={workflowSnapshot}
                isWorkflowLoading={isWorkflowLoading}
                workflowError={workflowError}
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};