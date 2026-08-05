import type { TokenPayload } from './jwt.js';

const SYSTEM_ADMIN_KEYS = new Set(['admin', 'ict_admin', 'system_administrator']);

export interface UnitScope {
  unitId: string | null;
  isSystemAdmin: boolean;
}

/**
 * Resolves whether a user is scoped to their home unit or operates system-wide.
 *
 * - System admins (Admin / SystemAdministrator / ict_admin) are independent of any
 *   department/directorate: their unit is always null and they see everything.
 * - All other users are scoped to the unit assigned on their identity profile.
 */
export function resolveUnitScope(auth: TokenPayload | null): UnitScope {
  if (!auth?.sub) {
    return { unitId: null, isSystemAdmin: false };
  }

  const roleLower = (auth.role ?? '').toLowerCase();
  const isSystemAdmin = SYSTEM_ADMIN_KEYS.has(roleLower);

  return {
    unitId: isSystemAdmin ? null : (auth.UnitId ?? null),
    isSystemAdmin,
  };
}
