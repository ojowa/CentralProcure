export interface Permission {
  PermissionKey: string;
  Module: string;
  Action: string;
  Description: string | null;
}

export interface RolePermission {
  RoleName: string;
  PermissionKey: string;
  Module: string;
  Action: string;
  Description: string | null;
  IsEnabled: boolean;
}
