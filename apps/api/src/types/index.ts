export interface Role {
  role_id: string;
  role_name: string;
  description: string | null;
  is_active: boolean;
}

export interface InternalUser {
  internal_user_id: string;
  email: string;
  username: string;
  first_name: string;
  middle_name: string | null;
  surname: string;
  service_number: string;
  unit_id: string | null;
  unit_name: string | null;
  role_name: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

export interface OrganizationalUnit {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  unit_type: string;
  parent_unit_id: string | null;
  sort_order: number;
  is_assignable: boolean;
  is_active: boolean;
}

export interface RoleModuleGrant {
  role_name: string;
  module_id: string;
  is_enabled: boolean;
  updated_at: string;
}

export interface UserModuleGrant {
  internal_user_id: string;
  email: string;
  username: string;
  role_name: string;
  module_id: string;
  is_enabled: boolean;
  updated_at: string;
}

export interface ModuleAccessAuditEntry {
  audit_id: string;
  grant_type: string;
  grant_owner: string;
  module_id: string;
  old_enabled: boolean | null;
  new_enabled: boolean;
  changed_by: string;
  changed_at: string;
  change_source: string;
}

export interface UserRoleAuditEntry {
  audit_id: string;
  internal_user_id: string;
  old_role: string | null;
  new_role: string;
  changed_by: string;
  changed_at: string;
}

export interface InternalNotification {
  notification_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
}

export interface VendorProfile {
  vendor_id: string;
  company_name: string;
  registration_number: string;
  tax_id: string;
  company_address: string;
  contact_person: string;
  phone_number: string | null;
  email: string;
  registration_date: string;
  last_login: string | null;
  vendor_status: string;
}

export interface ComplianceDocument {
  document_id: string;
  vendor_id: string;
  document_type: string;
  document_url: string;
  expiry_date: string | null;
  verification_status: string;
  created_at: string;
}

export interface ComplianceHistoryEntry {
  history_id: string;
  document_id: string;
  document_type: string;
  document_url: string;
  expiry_date: string | null;
  verification_status: string;
  created_at: string;
}

export interface Tender {
  tender_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  budget: number;
  department: string;
  budget_code: string | null;
  fiscal_year: number | null;
  specifications: string | null;
  eligibility_criteria: string | null;
  evaluation_criteria: string | null;
  publish_date: string | null;
  opening_date: string | null;
  closing_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TenderSummary {
  tender_id: string;
  title: string;
  category: string;
  status: string;
  budget: number;
  department: string;
  budget_code: string | null;
  fiscal_year: number | null;
  publish_date: string | null;
  opening_date: string | null;
  closing_date: string | null;
  created_at: string;
}

export interface OpenTender {
  tender_id: string;
  title: string;
  category: string;
  status: string;
  closing_date: string | null;
}

export interface Bid {
  bid_id: string;
  tender_id: string;
  vendor_id: string;
  bid_amount: number;
  technical_proposal_url: string | null;
  validity_period_days: number | null;
  submission_date: string;
  status: string;
}

export interface BidOpeningSession {
  session_id: string;
  tender_id: string;
  session_title: string;
  location: string | null;
  scheduled_at: string | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BidOpeningSessionSummary {
  session_id: string;
  tender_id: string;
  session_title: string;
  location: string | null;
  scheduled_at: string | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}
