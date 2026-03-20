'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBudgetRelease, fetchBudgetAppropriations, fetchBudgetReleases } from '../../services/budgetService';
import type {
  BudgetAppropriationResponse,
  BudgetReleaseCreateRequest,
  BudgetReleaseListResponse,
  BudgetReleaseResponse
} from '../../types/internal';
import { formatCurrency } from '../../utils/procureUtils';

type Props = {
  token?: string | null;
  onSuccess: (response: BudgetReleaseResponse) => void;
};

type FormState = {
  appropriationId: string;
  amount: string;
  releaseDate: string;
  notes: string;
};

const defaultFormState: FormState = {
  appropriationId: '',
  amount: '',
  releaseDate: new Date().toISOString().slice(0, 10),
  notes: ''
};

export const BudgetReleaseForm = ({ token, onSuccess }: Props) => {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [appropriations, setAppropriations] = useState<BudgetAppropriationResponse[]>([]);
  const [releases, setReleases] = useState<BudgetReleaseResponse[]>([]);
  const [isLoadingAppropriations, setIsLoadingAppropriations] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const amountValue = useMemo(() => {
    const parsed = Number(form.amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [form.amount]);

  const canSubmit = Boolean(token && form.appropriationId && amountValue > 0);

  const selectedAppropriation = useMemo(
    () => appropriations.find((item) => item.AppropriationId === form.appropriationId) ?? null,
    [appropriations, form.appropriationId]
  );

  const releasedAmount = useMemo(
    () => releases.reduce((sum, item) => sum + item.Amount, 0),
    [releases]
  );

  const remainingAmount = selectedAppropriation ? selectedAppropriation.Amount - releasedAmount : 0;

  useEffect(() => {
    if (!token || !form.appropriationId) {
      setReleases([]);
      return;
    }

    let isMounted = true;

    fetchBudgetReleases(token, { appropriationId: form.appropriationId, page: 1, pageSize: 10 })
      .then((response: BudgetReleaseListResponse) => {
        if (!isMounted) return;
        setReleases(response.Items);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setReleases([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release history.');
      })
      .finally(() => undefined);

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
      setError('Select an appropriation and enter a valid release amount.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const payload: BudgetReleaseCreateRequest = {
      AppropriationId: form.appropriationId,
      Amount: amountValue,
      ReleaseDate: form.releaseDate ? new Date(form.releaseDate).toISOString() : undefined,
      Notes: form.notes.trim() || undefined
    };

    try {
      const response = await createBudgetRelease(token, payload);
      setSuccess(`Release of ${response.Amount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} recorded.`);
      onSuccess(response);
      setForm((prev) => ({ ...defaultFormState, releaseDate: prev.releaseDate }));
      if (response.AppropriationId) {
        const history = await fetchBudgetReleases(token, {
          appropriationId: response.AppropriationId,
          page: 1,
          pageSize: 10
        });
        setReleases(history.Items);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save budget release.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="portal-module-card">
      <div className="view-header">
        <h3>Record a release</h3>
        <p style={{ marginBottom: '0.5rem' }}>Post the amount released against an active appropriation.</p>
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
            <span>Release Amount (NGN)</span>
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
            <span>Release Date</span>
            <input
              className="plan-input"
              type="date"
              value={form.releaseDate}
              onChange={(event) => handleChange('releaseDate', event.target.value)}
            />
          </label>

          <label className="plan-field">
            <span>Notes (optional)</span>
            <textarea
              className="plan-textarea"
              value={form.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={3}
              placeholder="Memo reference, tranche note, or release instruction."
            />
          </label>
        </div>

        {selectedAppropriation ? (
          <div className="plan-loading" style={{ margin: '0 16px 12px' }}>
            Posting release against {selectedAppropriation.BudgetCode} for {selectedAppropriation.Department}. Remaining balance:{' '}
            {formatCurrency(remainingAmount)}.
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
            {isSaving ? 'Saving release...' : 'Save release'}
          </button>
        </div>
      </form>
    </article>
  );
};
