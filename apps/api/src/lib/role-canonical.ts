// Canonical role key resolution.
// The database stores display-style role names (e.g. "TendersBoardMember").
// Clients rely on stable snake_case keys, so this module normalizes role names
// and maps legacy spellings to their canonical key.

export const normalizeRoleValue = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withUnderscores = trimmed.replace(/[\s-]+/g, '_');
  const camelToSnake = withUnderscores.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return camelToSnake.toLowerCase();
};

// Legacy spellings that still appear in old data or tokens, mapped to their
// canonical snake_case key.
const ROLE_ALIASES: Record<string, string> = {
  system_administrator: 'ict_admin',
  tenders_board_member: 'tenders_board',
  audit_officer: 'audit_oversight',
  procurement_planning_committee: 'planning_statistics_officer',
  procurementsecretary: 'procurement_secretary',
  comptrollerprocurement: 'comptroller_procurement',
  legalreviewofficer: 'legal_reviewer',
  bppliaison: 'bpp_liaison',
  bppreviewer: 'bpp_reviewer',
  cgis: 'accounting_officer'
};

export const toCanonicalRoleKey = (role: string | null | undefined): string => {
  if (!role) {
    return '';
  }

  const normalized = normalizeRoleValue(role);
  if (!normalized) {
    return '';
  }

  return ROLE_ALIASES[normalized] ?? normalized;
};
