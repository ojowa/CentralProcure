import React, { useState, useEffect, useMemo } from 'react';
import styles from '../styles/planning-committee.module.css';
import { AppItemCard } from '../components/AppItemCard';
import type { ProcurementPlanSummary, ProcurementPlanItemDetail } from '../../../types/internal';

interface AppItemsBrowserProps {
  plans: ProcurementPlanSummary[];
  appItems: ProcurementPlanItemDetail[];
  selectedPlanId: string;
  onPlanChange: (planId: string) => void;
  onLoadItems: (planId: string) => void;
  formatCurrency: (value: number) => string;
  downloadCsv: () => void;
}

export const AppItemsBrowser: React.FC<AppItemsBrowserProps> = ({
  plans,
  appItems,
  selectedPlanId,
  onPlanChange,
  onLoadItems,
  formatCurrency,
  downloadCsv
}) => {
  useEffect(() => {
    if (selectedPlanId) {
      onLoadItems(selectedPlanId);
    }
  }, [selectedPlanId, onLoadItems]);

  const totalAmount = useMemo(
    () => appItems.reduce((sum, item) => sum + item.EstimatedAmount, 0),
    [appItems]
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>APP Items</h3>
          <p className="plan-muted">Review APP line items by plan.</p>
        </div>
        <button
          className="plan-button plan-button--secondary"
          onClick={downloadCsv}
          disabled={appItems.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label>Select Plan</label>
          <select
            className="plan-input"
            value={selectedPlanId}
            onChange={(e) => onPlanChange(e.target.value)}
            style={{ minWidth: '300px' }}
          >
            <option value="">Select a plan...</option>
            {plans.map((p) => (
              <option key={p.PlanId} value={p.PlanId}>
                {p.PlanTitle} ({p.FiscalYear})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Items</span>
            <strong className={styles.metricValue}>{appItems.length}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Total</span>
            <strong className={styles.metricValue}>{formatCurrency(totalAmount)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.appItemsGrid}>
        {appItems.map((item) => (
          <AppItemCard
            key={item.PlanItemId}
            item={item}
            formatCurrency={formatCurrency}
          />
        ))}
        {appItems.length === 0 && selectedPlanId && (
          <div className={styles.empty}>No APP items found for this plan.</div>
        )}
        {!selectedPlanId && (
          <div className={styles.empty}>Select a plan to view its APP items.</div>
        )}
      </div>
    </div>
  );
};
