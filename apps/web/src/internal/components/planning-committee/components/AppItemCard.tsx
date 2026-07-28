import React from 'react';
import styles from '../styles/planning-committee.module.css';
import type { ProcurementPlanItemDetail } from '../../../types/internal';

interface AppItemCardProps {
  item: ProcurementPlanItemDetail;
  formatCurrency: (value: number) => string;
}

export const AppItemCard: React.FC<AppItemCardProps> = ({ item, formatCurrency }) => {
  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'statusDone';
      case 'completed': return 'statusDone';
      case 'cancelled': return 'statusRejected';
      default: return 'statusPending';
    }
  };

  return (
    <div className={styles.appItemCard}>
      <div className={styles.appItemHeader}>
        <div>
          <div className={styles.appItemCode}>{item.ItemCode ?? '—'}</div>
          <h4 className={styles.appItemTitle}>{item.Description}</h4>
        </div>
        <span className={`${styles.statusBadge} ${styles[getStatusClass(item.Status)]}`}>
          {item.Status}
        </span>
      </div>
      <div className={styles.appItemMeta}>
        <span>Budget Code</span>
        <strong>{item.BudgetCode}</strong>
      </div>
      <div className={styles.appItemMeta}>
        <span>Estimated Amount</span>
        <strong>{formatCurrency(item.EstimatedAmount)}</strong>
      </div>
    </div>
  );
};
