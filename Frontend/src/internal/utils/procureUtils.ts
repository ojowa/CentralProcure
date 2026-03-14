import type { BudgetSummaryResponse } from '../types/internal';
import type { BudgetLineItem, ThresholdBand } from '../data/internalData';

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(value);

export const formatDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatDateTimeShort = (value?: string | null): string => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const toTitle = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

export const requisitionStatusTone = (status: string): string => {
  switch (status) {
    case 'Approved':
      return 'admin-status--good';
    case 'Submitted':
    case 'Under Review':
    case 'Evaluation':
    case 'Board Review':
      return 'admin-status--warn';
    case 'Rejected':
      return 'admin-status--alert';
    default:
      return '';
  }
};

export const resolveThresholdRouting = (amount: number, thresholdBands: ThresholdBand[]): ThresholdBand => {
  const safeAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  return thresholdBands.find((band) => safeAmount >= band.min && safeAmount < band.max) ?? thresholdBands[0];
};

export const getBudgetCheck = (
  amount: number,
  appLineItemId?: string,
  budgetCode?: string,
  summary?: BudgetSummaryResponse | null,
  itemOverride?: BudgetLineItem | null,
  allowCatalogFallback = true,
  catalog: BudgetLineItem[] = []
) => {
  const normalizedAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const fallbackMatch = allowCatalogFallback
    ? catalog.find((item) => (appLineItemId ? item.id === appLineItemId : false)) ??
      catalog.find((item) => (budgetCode ? item.budgetCode === budgetCode : false))
    : null;
  const match = itemOverride ?? fallbackMatch ?? null;

  if (!match && !summary) {
    return {
      status: 'unknown' as const,
      amount: normalizedAmount,
      appropriated: 0,
      released: 0,
      committed: 0,
      spent: 0,
      reserved: 0,
      available: 0,
      variance: 0,
      item: null as BudgetLineItem | null,
      message: 'Select an APP line item to validate availability.'
    };
  }

  const appropriated = summary?.Appropriated ?? match?.allocated ?? 0;
  const released = summary?.Released ?? 0;
  const committed = summary?.Committed ?? match?.committed ?? 0;
  const spent = summary?.Spent ?? 0;
  const reserved = summary ? 0 : match?.reserved ?? 0;
  const available = summary ? summary.Available : appropriated - committed - reserved;

  if (!normalizedAmount) {
    return {
      status: 'unknown' as const,
      amount: normalizedAmount,
      appropriated,
      released,
      committed,
      spent,
      reserved,
      available,
      variance: 0,
      item: match,
      message: 'Enter an estimated amount to run the availability check.'
    };
  }

  const variance = normalizedAmount - available;
  const status = variance <= 0 ? 'sufficient' : 'insufficient';

  return {
    status,
    amount: normalizedAmount,
    appropriated,
    released,
    committed,
    spent,
    reserved,
    available,
    variance: Math.abs(variance),
    item: match,
    message:
      status === 'sufficient'
        ? 'Budget availability confirmed for this request.'
        : 'Budget availability shortfall detected.'
  };
};
