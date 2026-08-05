export type RoleKey =
  | 'admin'
  | 'requisitioning_officer'
  | 'department_head'
  | 'formation_officer'
  | 'formation_head'
  | 'comptroller_procurement'
  | 'procurement_manager'
  | 'planning_statistics_officer'
  | 'financial_unit_officer'
  | 'procurement_secretary'
  | 'legal_reviewer'
  | 'technical_evaluator'
  | 'financial_evaluator'
  | 'evaluation_committee'
  | 'tenders_board'
  | 'tenders_board_secretary'
  | 'accounting_officer'
  | 'bpp_liaison'
  | 'bpp_reviewer'
  | 'complaints_review_officer'
  | 'contract_manager'
  | 'inspection_officer'
  | 'payment_officer'
  | 'audit_oversight'
  | 'ict_admin';

export type UserGroup = 'vendor' | 'office_formation' | 'procurement_staff';

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  group?: UserGroup;
}
