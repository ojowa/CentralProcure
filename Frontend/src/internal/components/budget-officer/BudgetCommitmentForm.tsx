'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBudgetCommitment, fetchBudgetAppropriations, fetchBudgetCommitments } from '../../services/budgetService';
import type {
  BudgetAppropriationResponse,
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
  appropriationId: string;
  amount: string;
  committedAt: string;
};

const defaultFormState: FormState = {
  appropriationId: '',
  amount: '',
  committedAt: new Date().toISOString().slice(0, 10)
};

export const BudgetCommitmentForm = ({ token, onSuccess }: Props) => {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [appropriations, setAppropriations] = useState<BudgetAppropriationResponse[]>([]);
  const [commitments, setCommitments] = useState<BudgetCommitmentResponse[]>([]);
  const [isLoadingAppropriations, setIsLoadingAppropriations] = useState(false);
  const [isLoadingCommitments, setIsLoadingCommitments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountValue = useMemo(() => {
    const parsed = Number(form.amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [form.amount]);

  const canSubmit = Boolean(token && form.appropriationId && amountValue > 0);

  const selectedAppropriation = useMemo(
    () => appropriations.find((item) => item.AppropriationId === form.appropriationId) ?? null,
    [appropriations, form.appropriationId]
  );

  const committedAmount = useMemo(
    () => commitments.reduce((sum, item) => sum + item.Amount, 0),
    [commitments]
  );

  const remainingAmount = selectedAppropriation ? selectedAppropriation.Amount - committedAmount : 0;

  useEffect(() => {
    if (!token) {
      setAppropriations([]);
      return;
    }

    let isMounted = true;
    setIsLoadingAppropriations(true);
    fetchBudgetAppropriations(token, { status: 'Active', page: 1, pageSize: 100 })
      .then((response) => {
        if (isMounted) {
          setAppropriations(response.Items);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setAppropriations([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load appropriations.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAppropriations(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !form.appropriationId) {
      setCommitments([]);
      return;
    }

    let isMounted = true;
    setIsLoadingCommitments(true);
    fetchBudgetCommitments(token, { appropriationId: form.appropriationId, page: 1, pageSize: 20 })
      .then((response: BudgetCommitmentListResponse) => {
        if (!isMounted) return;
        setCommitments(response.Items);
      })
      .catch(() => {
        if (!isMounted) return;
        setCommitments([]);
        setError('Unable to load commitment history.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCommitments(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, form.appropriationId]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canSubmit) {
      setError('Select an appropriation and enter a valid commitment amount.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const payload: BudgetCommitmentCreateRequest = {
      AppropriationId: form.appropriationId,
      Amount: amountValue,
      CommittedAt: form.committedAt ? new Date(form.committedAt).toISOString() : undefined
    };

    try
    {
      const response = await createBudgetCommitment(token, payload);
      setSuccess(`Commitment of ${formatCurrency(response.Amount)} recorded.`);
      onSuccess(response);
      setForm((prev) => ({ ...defaultFormState, committedAt: prev.committedAt }));
      if (response.AppropriationId)
      {
        const history = await fetchBudgetCommitments(token, {
          appropriationId: response.AppropriationId,
          page: 1,
          pageSize: 20
        });
        setCommitments(history.Items);
      }
    }
    catch (saveError)
    {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save budget commitment.');
    }
    finally
    {
      setIsSaving(false);
    }
  };

  return (
    <article className="portal-module-card">
      <div className="view-header">
        <h3>Create a commitment</h3>
        <p style={{ marginBottom: '0.5rem' }}>Reserve funds against an appropriation.</p>
      </div>

      <form className="plan-toolbar" onSubmit={handleSubmit}>
        <div className="plan-filters">
          <label className="plan-field">
            <span>Appropriation</span>
            <select
              className="plan-select"
              value={form.appropriationId}
              onChange={(event) => handleChange('appropriationId', event.target.value)}
              disabled={isLoadingAppropriations}
            >
              <option value="">
                {isLoadingAppropriations ? 'Loading appropriations...' : 'Select appropriation'}
              </option>
              {appropriations.map((item) => (
                <option key={item.AppropriationId} value={item.AppropriationId}>
                  {item.BudgetCode} - {item.Department} - FY {item.FiscalYear}
                </option>
              ))}
            </select>
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
            <span>Commitment Date</span>
            <input
              className="plan-input"
              type="date"
              value={form.committedAt}
              onChange={(event) => handleChange('committedAt', event.target.value)}
            />
          </label>
        </div>

        {selectedAppropriation ? (
          <div className="plan-loading" style={{ margin: '0 16px 12px' }}>
            {isLoadingCommitments ? 'Loading commitment history...' : `Current committed total ${formatCurrency(committedAmount)} (remaining ${formatCurrency(remainingAmount)}).`}
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
