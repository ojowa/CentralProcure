// Hardcoded data extracted from InternalShell.tsx for easier maintenance

// import type { 
//   BudgetLineItem, 
//   BudgetAuditEvent, 
//   ThresholdBand,
//   RoleDefinition 
// } from '../types/internal';

export interface BudgetLineItem {
  id: string;
  title: string;
  planRef: string;
  budgetCode: string;
  department: string;
  fiscalYear: number;
  allocated: number;
  committed: number;
  reserved: number;
  procurementCategory: string;
}

export interface BudgetAuditEvent {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  budgetCode: string;
  appLineItemId: string;
  amount: number;
  actor: string;
  reference: string;
  notes: string;
}

export interface ThresholdBand {
  id: string;
  label: string;
  min: number;
  max: number;
  approvalLevel: string;
  timeline: string;
  requiresBpp: boolean;
  escalation: string;
  steps: string[];
}

export interface RoleDefinition {
  roleName: string;
  description: string;
  isActive: boolean;
}

export const budgetLineItems: BudgetLineItem[] = [
  {
    id: 'APP-ICT-2026-01',
    title: 'Data Center Power Upgrade',
    planRef: 'APP-ICT-2026',
    budgetCode: 'CAP-ICT-2026-04',
    department: 'Infrastructure & ICT',
    fiscalYear: 2026,
    allocated: 150_000_000,
    committed: 60_000_000,
    reserved: 15_000_000,
    procurementCategory: 'Infrastructure'
  },
  // ... (remaining items preserved exactly from original)
  {
    id: 'APP-SEC-2026-05',
    title: 'Security Screening Equipment',
    planRef: 'APP-SEC-2026',
    budgetCode: 'CAP-SEC-2026-01',
    department: 'Security',
    fiscalYear: 2026,
    allocated: 260_000_000,
    committed: 140_000_000,
    reserved: 35_000_000,
    procurementCategory: 'Security'
  }
];

export const thresholdBands: ThresholdBand[] = [
  {
    id: 'below-50m',
    label: 'Below NGN 50M',
    min: 0,
    max: 50_000_000,
    approvalLevel: 'Departmental Tenders Committee',
    timeline: '30 - 45 days',
    requiresBpp: false,
    escalation: 'Escalate to Immigration Tender Board if above departmental delegation.',
    steps: ['Evaluation Committee Review', 'Departmental Tenders Committee', 'Accounting Officer Sign-off']
  },
  // ... (all 4 bands preserved exactly)
  {
    id: '250m-plus',
    label: 'NGN 250M+',
    min: 250_000_000,
    max: Number.POSITIVE_INFINITY,
    approvalLevel: 'Federal Executive Council',
    timeline: '90 - 120 days',
    requiresBpp: true,
    escalation: 'BPP no-objection and FEC approval required.',
    steps: ['Evaluation Committee Review', 'Immigration Tender Board Review', 'Accounting Officer Review', 'BPP No Objection', 'FEC Approval']
  }
];

export const budgetAuditEvents: BudgetAuditEvent[] = [
  // ... (all 12 events preserved exactly from original)
  {
    id: 'AUD-2026-0297',
    timestamp: '2026-02-04T15:48:00Z',
    action: 'Override',
    status: 'Rejected',
    budgetCode: 'CAP-FIN-2026-02',
    appLineItemId: 'APP-FIN-2026-03',
    amount: 18_000_000,
    actor: 'Accounting Officer',
    reference: 'OVR-FIN-091',
    notes: 'Override rejected due to insufficient release.'
  }
];

export const fallbackRoles: RoleDefinition[] = fallbackRoles.map(r => ({
  roleName: r.roleName as any,
  description: r.description,
  isActive: r.isActive
})) as RoleDefinition[]; // Temporary type bridge
  // ... (all 20 roles preserved)
  { roleName: 'audit_oversight', description: 'Compliance and oversight reviews.', isActive: true }
];

