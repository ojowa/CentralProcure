'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBudgetAppropriation } from '../../services/budgetService';
import { fetchInternalUnits } from '../../services/internalAuthService';
import type {
  BudgetAppropriationCreateRequest,
  BudgetAppropriationResponse,
  InternalOrganizationalUnitRecord
} from '../../types/internal';

type FormState = {
  fiscalYear: string;
  department: string;
  budgetCode: string;
  amount: string;
  status: 'Active' | 'Closed';
  notes: string;
};

const currentYear = new Date().getUTCFullYear().toString();

const defaultFormState: FormState = {
  fiscalYear: currentYear,
  department: '',
  budgetCode: '',
  amount: '',
  status: 'Active',
  notes: ''
};

type Props = {
  token?: string | null;
  onSuccess: (response: BudgetAppropriationResponse) => void;
};

export const BudgetAppropriationForm = ({ token, onSuccess }: Props) => {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [units, setUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountValue = useMemo(() => {
    const parsed = Number(form.amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [form.amount]);

  const canSubmit =
    Boolean(token) &&
    form.department.trim().length > 0 &&
    form.budgetCode.trim().length > 0 &&
    amountValue > 0;

  useEffect(() => {
    let isMounted = true;

    setIsLoadingUnits(true);
    fetchInternalUnits()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setUnits(response.filter((unit) => unit.IsAssignable));
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }

        setUnits([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load departments.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingUnits(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value } as FormState));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError('Log in to record budget appropriations.');
      return;
    }

    if (!canSubmit) {
      setError('Complete the department, budget code, and amount before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const payload: BudgetAppropriationCreateRequest = {
      AppropriationCode: form.budgetCode.trim(),
      Description: form.notes.trim() || `${form.department.trim()} - FY ${form.fiscalYear}`,
      TotalAmount: amountValue,
      FiscalYear: Number(form.fiscalYear) || Number(currentYear)
    };

    try {
      const response = await createBudgetAppropriation(token, payload);
      setSuccess(`Appropriation ${response.AppropriationCode} added for FY ${response.FiscalYear}.`);
      onSuccess(response);
      setForm((prev) => ({
        ...defaultFormState,
        fiscalYear: prev.fiscalYear
      }));
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to save budget appropriation at this time.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="portal-module-card">
      <div className="view-header">
        <h3>Record an appropriation</h3>
        <p style={{ marginBottom: '0.5rem' }}>
          Add or refresh the funding lines that requisitions will draw from.
        </p>
      </div>

      <form className="plan-toolbar" onSubmit={handleSubmit}>
        <div className="plan-filters">
          <label className="plan-field">
            <span>Fiscal Year</span>
            <input
              className="plan-input"
              type="number"
              min="2000"
              step="1"
              value={form.fiscalYear}
              onChange={(event) => handleChange('fiscalYear', event.target.value)}
            />
          </label>
          <label className="plan-field">
            <span>Department</span>
            <select
              className="plan-select"
              value={form.department}
              onChange={(event) => handleChange('department', event.target.value)}
              disabled={isLoadingUnits}
            >
              <option value="">
                {isLoadingUnits ? 'Loading departments...' : 'Select department'}
              </option>
              {units.map((unit) => (
                <option key={unit.UnitId} value={unit.UnitName}>
                  {unit.UnitName}
                </option>
              ))}
            </select>
          </label>
          <label className="plan-field">
            <span>Budget Code</span>
            <input
              className="plan-input"
              value={form.budgetCode}
              onChange={(event) => handleChange('budgetCode', event.target.value)}
              placeholder="e.g., CAP-2026-001"
            />
          </label>
          <label className="plan-field">
            <span>Amount (NGN)</span>
            <input
              className="plan-input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => handleChange('amount', event.target.value)}
              placeholder="50000000"
            />
          </label>
          <label className="plan-field">
            <span>Status</span>
            <select
              className="plan-select"
              value={form.status}
              onChange={(event) => handleChange('status', event.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </label>
          <label className="plan-field">
            <span>Notes (optional)</span>
            <textarea
              className="plan-textarea"
              value={form.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={3}
              placeholder="Capture reference, justification or contact for this appropriation."
            />
          </label>
        </div>

        {error && (
          <div className="portal-alert animate-shake" style={{ margin: '0 16px 12px' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="plan-loading" style={{ margin: '0 16px 12px' }}>
            {success}
          </div>
        )}

        <div style={{ padding: '0 16px 16px' }}>
          <button
            type="submit"
            className="plan-button plan-button--large"
            disabled={!canSubmit || isSaving}
            style={{ width: '100%' }}
          >
            {isSaving ? 'Saving appropriation...' : 'Save appropriation'}
          </button>
        </div>
      </form>
    </article>
  );
};
