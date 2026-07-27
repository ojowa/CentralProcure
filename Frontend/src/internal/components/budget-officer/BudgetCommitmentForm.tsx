'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBudgetCommitment, fetchBudgetReleases, fetchBudgetCommitments } from '../../services/budgetService';
import type {
  BudgetReleaseResponse,
  BudgetCommitmentCreateRequest,
  BudgetCommitmentListResponse,
  BudgetCommitmentResponse
} from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  token?: string | null;
  onSuccess: (response: BudgetCommitmentResponse) => void;
};

type FormState = {
  releaseId: string;
  commitmentCode: string;
  amount: string;
  description: string;
  beneficiary: string;
};

const defaultFormState: FormState = {
  releaseId: '',
  commitmentCode: '',
  amount: '',
  description: '',
  beneficiary: ''
};

export const BudgetCommitmentForm = ({ token, onSuccess }: Props) => {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [releases, setReleases] = useState<BudgetReleaseResponse[]>([]);
  const [commitments, setCommitments] = useState<BudgetCommitmentResponse[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [isLoadingCommitments, setIsLoadingCommitments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountValue = useMemo(() => {
    const parsed = Number(form.amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [form.amount]);

  const canSubmit = Boolean(token && form.releaseId && form.commitmentCode.trim() && amountValue > 0);

  useEffect(() => {
    if (!token) {
      setReleases([]);
      return;
    }

    let isMounted = true;
    setIsLoadingReleases(true);
    fetchBudgetReleases(token, { status: 'Active', page: 1, pageSize: 100 })
      .then((response) => {
        if (isMounted) {
          setReleases(response.Items);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setReleases([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load releases.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingReleases(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !form.releaseId) {
      setCommitments([]);
      return;
    }

    let isMounted = true;
    setIsLoadingCommitments(true);
    fetchBudgetCommitments(token, { releaseId: form.releaseId, page: 1, pageSize: 20 })
      .then((response: BudgetCommitmentListResponse) => {
        if (!isMounted) return;
        setCommitments(response.Items);
      })
      .catch(() => {
        if (!isMounted) return;
        setCommitments([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCommitments(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, form.releaseId]);

  const committedAmount = useMemo(
    () => commitments.reduce((sum, item) => sum + item.Amount, 0),
    [commitments]
  );

  const selectedRelease = useMemo(
    () => releases.find((item) => item.ReleaseId === form.releaseId) ?? null,
    [releases, form.releaseId]
  );

  const remainingAmount = selectedRelease ? selectedRelease.Amount - committedAmount : 0;

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canSubmit) {
      setError('Select a release, enter a commitment code, and a valid amount.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const payload: BudgetCommitmentCreateRequest = {
      ReleaseId: form.releaseId,
      CommitmentCode: form.commitmentCode.trim(),
      Description: form.description.trim() || undefined,
      Amount: amountValue,
      Beneficiary: form.beneficiary.trim() || undefined
    };

    try {
      const response = await createBudgetCommitment(token, payload);
      setSuccess(`Commitment ${response.CommitmentCode} of ${formatCurrency(response.Amount)} recorded.`);
      onSuccess(response);
      setForm(defaultFormState);
      if (response.ReleaseId) {
        const history = await fetchBudgetCommitments(token, {
          releaseId: response.ReleaseId,
          page: 1,
          pageSize: 20
        });
        setCommitments(history.Items);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save budget commitment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="portal-module-card">
      <div className="view-header">
        <h3>Create a commitment</h3>
        <p style={{ marginBottom: '0.5rem' }}>Reserve funds against a release.</p>
      </div>

      <form className="plan-toolbar" onSubmit={handleSubmit}>
        <div className="plan-filters">
          <label className="plan-field">
            <span>Release</span>
            <select
              className="plan-select"
              value={form.releaseId}
              onChange={(event) => handleChange('releaseId', event.target.value)}
              disabled={isLoadingReleases}
            >
              <option value="">
                {isLoadingReleases ? 'Loading releases...' : 'Select release'}
              </option>
              {releases.map((item) => (
                <option key={item.ReleaseId} value={item.ReleaseId}>
                  {item.ReleaseCode} - {formatCurrency(item.Amount)}
                </option>
              ))}
            </select>
          </label>

          <label className="plan-field">
            <span>Commitment Code</span>
            <input
              className="plan-input"
              value={form.commitmentCode}
              onChange={(event) => handleChange('commitmentCode', event.target.value)}
              placeholder="e.g. COM-2026-001"
            />
          </label>

          <label className="plan-field">
            <span>Commitment Amount (NGN)</span>
            <input
              className="plan-input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => handleChange('amount', event.target.value)}
              placeholder="1000000"
            />
          </label>

          <label className="plan-field">
            <span>Description (optional)</span>
            <input
              className="plan-input"
              value={form.description}
              onChange={(event) => handleChange('description', event.target.value)}
            />
          </label>

          <label className="plan-field">
            <span>Beneficiary (optional)</span>
            <input
              className="plan-input"
              value={form.beneficiary}
              onChange={(event) => handleChange('beneficiary', event.target.value)}
            />
          </label>
        </div>

        {selectedRelease ? (
          <div className="plan-loading" style={{ margin: '0 16px 12px' }}>
            {isLoadingCommitments ? 'Loading commitment history...' : `Committed: ${formatCurrency(committedAmount)} / ${formatCurrency(selectedRelease.Amount)} (remaining ${formatCurrency(remainingAmount)}).`}
          </div>
        ) : null}

        {error ? (
          <div className="portal-alert animate-shake" style={{ margin: '0 16px 12px' }}>
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="plan-loading" style={{ margin: '0 16px 12px' }}>
            {success}
          </div>
        ) : null}

        <div style={{ padding: '0 16px 16px' }}>
          <button
            type="submit"
            className="plan-button plan-button--large"
            disabled={!canSubmit || isSaving}
            style={{ width: '100%' }}
          >
            {isSaving ? 'Saving commitment...' : 'Save commitment'}
          </button>
        </div>
      </form>
    </article>
  );
};
