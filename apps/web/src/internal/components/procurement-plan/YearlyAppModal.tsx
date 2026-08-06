import React, { useState, useEffect } from 'react';
import type { YearlyAppCreateRequest, YearlyAppUpdateRequest } from '../../services/procurementPlanService';

interface YearlyAppModalProps {
  mode: 'create' | 'edit';
  initialData?: {
    YearlyAppId?: string;
    Title: string;
    FiscalYear: number;
    Notes?: string | null;
  } | null;
  isOpen: boolean;
  isProcessing: boolean;
  onConfirm: (data: YearlyAppCreateRequest | YearlyAppUpdateRequest) => void;
  onCancel: () => void;
}

const currentYear = new Date().getFullYear();
const fiscalYears = Array.from({ length: 5 }, (_, i) => currentYear + i);

export const YearlyAppModal = ({
  mode,
  initialData,
  isOpen,
  isProcessing,
  onConfirm,
  onCancel
}: YearlyAppModalProps) => {
  const [title, setTitle] = useState('');
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setTitle(initialData.Title || '');
        setFiscalYear(initialData.FiscalYear || currentYear);
        setNotes(initialData.Notes || '');
      } else {
        setTitle('');
        setFiscalYear(currentYear);
        setNotes('');
      }
      setErrors({});
    }
  }, [isOpen, mode, initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!fiscalYear || fiscalYear < 2000 || fiscalYear > 2100) {
      newErrors.fiscalYear = 'Please enter a valid fiscal year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (mode === 'create') {
      onConfirm({
        Title: title.trim(),
        FiscalYear: fiscalYear,
        Notes: notes.trim() || null
      });
    } else {
      onConfirm({
        Title: title.trim(),
        Notes: notes.trim() || null
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal__backdrop" onClick={onCancel} />
      <div className="app-modal__content">
        <div className="app-modal__header">
          <h3 className="app-modal__title">
            {mode === 'create' ? 'Create Yearly APP' : 'Edit Yearly APP'}
          </h3>
          <button
            type="button"
            className="app-modal__close"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="app-form">
          <div className="app-form__group">
            <label htmlFor="yearly-app-title" className="app-form__label">
              APP Title <span className="app-form__required">*</span>
            </label>
            <input
              id="yearly-app-title"
              type="text"
              className={`app-form__input ${errors.title ? 'app-form__input--error' : ''}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., NIS 2026 Annual Procurement Plan"
              disabled={isProcessing}
            />
            {errors.title && <span className="app-form__error">{errors.title}</span>}
          </div>

          <div className="app-form__group">
            <label htmlFor="yearly-app-year" className="app-form__label">
              Fiscal Year <span className="app-form__required">*</span>
            </label>
            <select
              id="yearly-app-year"
              className={`app-form__select ${errors.fiscalYear ? 'app-form__select--error' : ''}`}
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              disabled={isProcessing || mode === 'edit'}
            >
              {fiscalYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {mode === 'edit' && (
              <span className="app-form__hint">Fiscal year cannot be changed after creation</span>
            )}
            {errors.fiscalYear && <span className="app-form__error">{errors.fiscalYear}</span>}
          </div>

          <div className="app-form__group">
            <label htmlFor="yearly-app-notes" className="app-form__label">
              Notes
            </label>
            <textarea
              id="yearly-app-notes"
              className="app-form__textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this yearly APP..."
              disabled={isProcessing}
            />
          </div>

          <div className="app-modal__footer">
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-btn app-btn--primary"
              disabled={isProcessing}
            >
              {isProcessing
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                  ? 'Create Yearly APP'
                  : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default YearlyAppModal;
