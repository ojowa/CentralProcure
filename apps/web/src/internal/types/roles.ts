// Roles come from the database (identity.roles.role_key). The web layer never
// hardcodes the role set. RoleKey is kept as a string alias so component prop
// signatures stay typed against whatever the DB reports.
export type RoleKey = string;

export type UserGroup = 'vendor' | 'office_formation' | 'procurement_staff';

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  group?: UserGroup;
}
