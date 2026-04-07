import React, { useState, useEffect } from 'react';
import type { InternalModule, ProcurementPlanItemDetail, RoleKey } from '../types/internal';
import { fetchModuleData, applyCgisAction, fetchPlanDetails } from '../services/moduleService';
import { decideMethodChangeException, fetchMethodChangeExceptionQueue } from '../services/moduleService.tenders';
import { CgisDecisionModal } from './cgis/CgisDecisionModal';
import { CgisDocumentsPanel } from './cgis/CgisDocumentsPanel';
import { CgisQueueTable, CgisCaseDetail } from './cgis/CgisComponents';
import { CgisMethodExceptionsPanel } from './cgis/CgisMethodExceptionsPanel';

interface CgisQueueItem {
  InstanceId: string;
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  Department: string;
  Amount: number | null;
  ApprovalRoute: string | null;
  ApprovalAuthorityLabel: string | null;
  Status: string | null;
  VendorName: string | null;
  CreatedAt: string;
  DaysPending: number;
}

interface CgisApprovalModuleProps {
  module: InternalModule;
  token: string | null;
  role: RoleKey | null;
  userEmail?: string | null;
}

interface MethodExceptionQueueItem {
  ExceptionId: string;
  EntityType: string;
  EntityId: string;
  RecordTitle: string | null;
  CurrentStageKey: string;
  CurrentStageTitle: string;
  Amount: number | null;
  CurrentMethod: string;
  RequestedMethod: string;
  RequestReason: string;
  RequestedBy: string | null;
  RequestedAt: string;
  Status: string;
}

export const CgisApprovalModule = ({ module, token, userEmail }: CgisApprovalModuleProps) => {
  const [activeView, setActiveView] = useState<'approvals' | 'exceptions'>('approvals');
  const [queue, setQueue] = useState<CgisQueueItem[]>([]);
  const [exceptionQueue, setExceptionQueue] = useState<MethodExceptionQueueItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CgisQueueItem | null>(null);
  const [selectedException, setSelectedException] = useState<MethodExceptionQueueItem | null>(null);
  const [rationale, setRationale] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'return' | 'escalate' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<ProcurementPlanItemDetail[]>([]);

  const loadQueue = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchModuleData('cgis-approval', token) as CgisQueueItem[];
      setQueue(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CGIS queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [token]);

  const loadExceptionQueue = async () => {
    if (!token) return;
    try {
      const data = await fetchMethodChangeExceptionQueue(token) as MethodExceptionQueueItem[];
      setExceptionQueue(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load method-change exception queue.');
    }
  };

  useEffect(() => {
    void loadExceptionQueue();
  }, [token]);

  useEffect(() => {
    const loadPlanItems = async () => {
      if (!token || !selectedCase || selectedCase.EntityType.toLowerCase() !== 'procurement_plan') {
        setPlanItems([]);
        return;
      }
      try {
        const detail = await fetchPlanDetails(selectedCase.EntityId, token);
        setPlanItems(detail.Items || []);
      } catch {
        setPlanItems([]);
      }
    };
    void loadPlanItems();
  }, [selectedCase, token]);

  const initiateAction = (action: 'approve' | 'reject' | 'return' | 'escalate') => {
    if (!rationale.trim()) {
      setError('Rationale is mandatory for all executive decisions.');
      return;
    }
    setError(null);
    setModalError(null);
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!token || !selectedCase || !pendingAction || !rationale.trim()) return;

    setIsProcessing(true);
    setError(null);
    setModalError(null);
    try {
      await applyCgisAction(pendingAction, {
        EntityType: selectedCase.EntityType,
        EntityId: selectedCase.EntityId,
        Rationale: rationale.trim(),
        Actor: userEmail
      }, token);

      setRationale('');
      setModalError(null);
      setPendingAction(null);
      setSelectedCase(null);
      await loadQueue();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${pendingAction} case.`;
      setError(message);
      setModalError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    setSelectedCase(null);
    setRationale('');
    setError(null);
    setModalError(null);
  };

  const handleExceptionDecision = async (action: 'approve' | 'reject' | 'return') => {
    if (!token || !selectedException) return;
    setIsProcessing(true);
    setError(null);
    try {
      await decideMethodChangeException(action, { ExceptionId: selectedException.ExceptionId, Note: exceptionNote.trim() || undefined }, token);
      setExceptionNote('');
      setSelectedException(null);
      await loadExceptionQueue();
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} method-change exception.`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="app-module">
      <header className="app-module__header">
        <div className="app-module__title-group">
          <h2 className="app-module__title">{module.title}</h2>
          <p className="app-module__description">{module.description}</p>
        </div>
        <button className="app-btn app-btn--secondary" onClick={() => void loadQueue()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </header>

      <div className="app-action-group" style={{ marginBottom: 16 }}>
        <button className={`app-btn ${activeView === 'approvals' ? 'app-btn--success' : 'app-btn--secondary'}`} onClick={() => setActiveView('approvals')}>
          Approval Queue
        </button>
        <button className={`app-btn ${activeView === 'exceptions' ? 'app-btn--success' : 'app-btn--secondary'}`} onClick={() => setActiveView('exceptions')}>
          Method Exceptions
        </button>
      </div>

      {error && (
        <div className="app-alert app-alert--error animate-shake">
          <span className="app-alert__icon">⚠</span>
          {error}
        </div>
      )}

      {activeView === 'approvals' && selectedCase ? (
        <>
          <CgisCaseDetail
            selectedCase={selectedCase}
            planItems={planItems}
            rationale={rationale}
            isProcessing={isProcessing}
            error={null}
            token={token}
            onBack={handleBack}
            onRationaleChange={setRationale}
            onActionInitiate={initiateAction}
          />
          <CgisDocumentsPanel
            entityType={selectedCase.EntityType}
            entityId={selectedCase.EntityId}
            token={token}
          />
          {pendingAction && (
            <CgisDecisionModal
              action={pendingAction}
              recordTitle={selectedCase.RecordTitle || 'Untitled Case'}
              rationale={rationale}
              error={modalError}
              isProcessing={isProcessing}
              onConfirm={() => void confirmAction()}
              onCancel={() => {
                setPendingAction(null);
                setModalError(null);
              }}
            />
          )}
        </>
      ) : activeView === 'approvals' ? (
        <CgisQueueTable
          queue={queue}
          isLoading={isLoading}
          onSelectCase={setSelectedCase}
        />
      ) : (
        <CgisMethodExceptionsPanel
          queue={exceptionQueue}
          isLoading={isLoading}
          selected={selectedException}
          note={exceptionNote}
          isSaving={isProcessing}
          onSelect={setSelectedException}
          onNoteChange={setExceptionNote}
          onDecide={(action) => void handleExceptionDecision(action)}
        />
      )}
    </section>
  );
};
