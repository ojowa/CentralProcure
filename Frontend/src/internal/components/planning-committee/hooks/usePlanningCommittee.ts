import { useState, useEffect, useCallback } from 'react';
import type { RequisitionSummary } from '../../../types/internal';
import {
  fetchPlanDetails,
  fetchProcurementPlans
} from '../../../services/moduleService';
import { fetchRequisitionDetail } from '../../../services/requisitionService';
import {
  fetchPlanningCommitteeQueue,
  fetchPlanningCommitteeWorkspace,
  finalizePlanningCommitteeReview,
  linkPlanningCommitteeWorkspaceRequisition,
  submitPlanningCommitteeMemberReview,
  unlinkPlanningCommitteeWorkspaceRequisition
} from '../../../services/planningCommitteeService';
import type {
  CommitteeState,
  LoadingState
} from './planningCommitteeTypes';

const defaultState: CommitteeState = {
  requisitions: [],
  linkedRequisitions: [],
  availablePlans: [],
  plans: [],
  selectedRequisition: null,
  selectedRequisitionDetail: null,
  selectedPlan: null,
  planItems: [],
  appItems: [],
  memberReviews: [],
  memberStatuses: [],
  selectedDecision: null,
  workspaceAuthority: null
};

export function usePlanningCommittee(token: string | null) {
  const [state, setState] = useState<CommitteeState>(defaultState);
  const [loading, setLoading] = useState<LoadingState>({ initial: false, action: false });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearNotifications = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  const loadRequisitions = useCallback(async () => {
    if (!token) return;
    setLoading((prev) => ({ ...prev, initial: true }));
    try {
      const data = await fetchPlanningCommitteeQueue(token);
      setState((prev) => ({
        ...prev,
        requisitions: data.PendingRequisitions ?? [],
        linkedRequisitions: data.LinkedRequisitions ?? [],
        availablePlans: data.AvailablePlans ?? []
      }));
    } catch (err: any) {
      showError(err.message || 'Unable to load requisitions.');
    } finally {
      setLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [token, showError]);

  const loadPlans = useCallback(async (status?: string) => {
    if (!token) return [];
    try {
      const data = await fetchProcurementPlans(token, status);
      const items = Array.isArray(data) ? data : data.Items ?? [];
      setState((prev) => ({ ...prev, plans: items }));
      return items;
    } catch (err: any) {
      showError(err.message || 'Unable to load procurement plans.');
      return [];
    }
  }, [token, showError]);

  const loadRequisitionDetail = useCallback(async (requisitionId: string) => {
    if (!token) return null;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      const detail = await fetchRequisitionDetail(token, requisitionId);
      setState((prev) => ({ ...prev, selectedRequisitionDetail: detail }));
      return detail;
    } catch (err: any) {
      showError(err.message || 'Unable to load requisition details.');
      return null;
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [token, showError]);

  const loadWorkspaceData = useCallback(async (requisition: RequisitionSummary) => {
    if (!token) return;
    setLoading((prev) => ({ ...prev, initial: true }));
    try {
      const workspace = await fetchPlanningCommitteeWorkspace(token, requisition.RequisitionId);
      setState((prev) => ({
        ...prev,
        selectedRequisition: workspace.Requisition,
        selectedPlan: workspace.Plan,
        planItems: workspace.PlanItems ?? [],
        memberReviews: workspace.MemberReviews ?? [],
        memberStatuses: workspace.MemberStatuses ?? [],
        selectedDecision: workspace.Decision ?? null,
        workspaceAuthority: workspace.Authority ?? null
      }));
    } catch (err: any) {
      showError(err.message || 'Unable to load committee review data.');
    } finally {
      setLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [token, showError]);

  const loadAppItems = useCallback(async (planId: string) => {
    if (!token) return;
    setLoading((prev) => ({ ...prev, initial: true }));
    try {
      const detailData = await fetchPlanDetails(planId, token);
      setState((prev) => ({ ...prev, appItems: detailData.Items || [] }));
    } catch (err: any) {
      showError(err.message || 'Unable to load APP items.');
    } finally {
      setLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [token, showError]);

  const submitReview = useCallback(async (decision: string, remarks: string) => {
    if (!token || !state.selectedRequisition) return false;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await submitPlanningCommitteeMemberReview(token, state.selectedRequisition.RequisitionId, {
        Decision: decision,
        Remarks: remarks
      });
      await loadWorkspaceData(state.selectedRequisition);
      showSuccess('Review submitted successfully');
      return true;
    } catch (err: any) {
      showError(err.message || 'Unable to submit review.');
      return false;
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [token, state.selectedRequisition, loadWorkspaceData, showSuccess, showError]);

  const submitFinalDecision = useCallback(async (decision: string, remarks: string) => {
    if (!token || !state.selectedRequisition) {
      return { success: false, error: 'A requisition must be selected before submitting a final decision.' };
    }
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await finalizePlanningCommitteeReview(token, state.selectedRequisition.RequisitionId, {
        OverallDecision: decision,
        CommitteeRemarks: remarks
      });
      await loadRequisitions();
      await loadWorkspaceData(state.selectedRequisition);
      showSuccess(
        decision === 'ReturnedToDepartment'
          ? 'Requisition returned to department for correction.'
          : 'Final requisition decision submitted successfully'
      );
      return { success: true, error: null };
    } catch (err: any) {
      const detail = `Requisition: ${state.selectedRequisition.Title} (${state.selectedRequisition.RequisitionId}).`;
      const message = `${err.message || 'Unable to submit final decision.'} ${detail}`;
      showError(message);
      return { success: false, error: message };
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [token, state.selectedRequisition, loadRequisitions, loadWorkspaceData, showSuccess, showError]);

  const linkToPlan = useCallback(async (
    requisition: RequisitionSummary,
    mode: 'create' | 'attach',
    planConfig: { title?: string; fiscalYear?: number; existingPlanId?: string },
    onNotice?: (notice: string | null) => void
  ) => {
    if (!token) {
      return { success: false, error: 'Authentication is required to assign this requisition to a committee plan.' };
    }
    setLoading((prev) => ({ ...prev, action: true }));
    setError(null);
    onNotice?.(null);
    try {
      const payload = mode === 'attach'
        ? {
            Mode: mode,
            ExistingPlanId: planConfig.existingPlanId
          }
        : {
            Mode: mode,
            PlanTitle: planConfig.title,
            FiscalYear: planConfig.fiscalYear
          };

      const result = await linkPlanningCommitteeWorkspaceRequisition(token, requisition.RequisitionId, {
        ...payload
      });
      onNotice?.(result.Notice ?? null);
      await loadRequisitions();
      await loadWorkspaceData(requisition);
      showSuccess('Requisition linked to committee plan. APP item will be created only after finalized review.');
      return { success: true, error: null };
    } catch (err: any) {
      const message = err.message || 'Unable to assign requisition to committee plan.';
      showError(message);
      return { success: false, error: message };
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [token, loadRequisitions, loadWorkspaceData, showSuccess, showError]);

  const unlinkRequisition = useCallback(async (requisition: RequisitionSummary, reason: string) => {
    if (!token) return false;
    setLoading((prev) => ({ ...prev, action: true }));
    try {
      await unlinkPlanningCommitteeWorkspaceRequisition(token, requisition.RequisitionId, reason);
      await loadRequisitions();
      await loadWorkspaceData({
        ...requisition,
        AppItemId: null,
        AppItemDescription: null,
        CommitteePlanId: null,
        CommitteePlanTitle: null
      });
      showSuccess(requisition.AppItemId ? 'APP link removed from requisition.' : 'Committee plan link removed from requisition.');
      return true;
    } catch (err: any) {
      showError(err.message || 'Unable to unlink requisition.');
      return false;
    } finally {
      setLoading((prev) => ({ ...prev, action: false }));
    }
  }, [token, loadRequisitions, loadWorkspaceData, showSuccess, showError]);

  useEffect(() => {
    if (token) {
      loadRequisitions();
    }
  }, [token, loadRequisitions]);

  return {
    state,
    loading,
    error,
    success,
    clearNotifications,
    loadRequisitions,
    loadPlans,
    loadRequisitionDetail,
    loadWorkspaceData,
    loadAppItems,
    submitReview,
    submitFinalDecision,
    linkToPlan,
    unlinkRequisition
  };
}
