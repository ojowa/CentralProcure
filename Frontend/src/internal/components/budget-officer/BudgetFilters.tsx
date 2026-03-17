'use client';

import React from 'react';
import type { BudgetFilters as IBudgetFilters } from '../../types/internal';

type Props = {
  filters: IBudgetFilters;
  onFilterChange: (filters: Partial<IBudgetFilters>) => void;
};

const stageOptions = [
  { value: '', label: 'All active stages' },
  { value: 'planning_committee_review', label: 'Planning Committee Review' },
  { value: 'budget_confirmation', label: 'Budget Confirmation' },
  { value: 'app_approval', label: 'APP Approval' }
];

export const BudgetFilters = ({ filters, onFilterChange }: Props) => {
  return (
    <div className="plan-toolbar">
      <div className="plan-filters">
        <label className="plan-field">
          <span>Fiscal Year</span>
          <input
            className="plan-input"
            inputMode="numeric"
            value={filters.fiscalYear}
            onChange={(event) => onFilterChange({ fiscalYear: event.target.value })}
            placeholder="2026"
          />
        </label>
        <label className="plan-field">
          <span>Department</span>
          <input
            className="plan-input"
            value={filters.department}
            onChange={(event) => onFilterChange({ department: event.target.value })}
            placeholder="Marine Services"
          />
        </label>
        <label className="plan-field">
          <span>Stage</span>
          <select
            className="plan-select"
            value={filters.stage}
            onChange={(event) => onFilterChange({ stage: event.target.value })}
          >
            {stageOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-field">
          <span>Search</span>
          <input
            className="plan-input"
            value={filters.query}
            onChange={(event) => onFilterChange({ query: event.target.value })}
            placeholder="Plan title, department, budget code"
          />
        </label>
      </div>
    </div>
  );
};
