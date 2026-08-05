import type { RoleKey } from './roles';

export interface InternalModule {
  id: string;
  title: string;
  section: string;
  description: string;
  microservice: string;
  controlPurpose: string;
  actions?: string[];
  catalogActions?: string[];
  grantSource?: string;
  isVisible?: boolean;
  hasRoleOverride?: boolean;
  hasUserOverride?: boolean;
  requiredPermission?: string;
  group?: 'vendor' | 'office_formation' | 'procurement_staff';
  subSection?: string | null;
  datasetUrl?: string | null;
  hasDataset?: boolean;
}

export interface MonitoringStatusItem {
    Key: string;
    Label: string;
    Status: string;
    Summary: string;
    Count: number;
}

export interface MonitoringAlertItem {
    Severity: string;
    Source: string;
    Title: string;
    Detail: string;
    AffectedCount: number;
    OldestAgeDays?: number | null;
}

export interface MonitoringStageLoadItem {
    StageKey: string;
    StageTitle: string;
    ActiveCount: number;
}

export interface MonitoringOverview {
    GeneratedAtUtc: string;
    TotalAlerts: number;
    CriticalAlerts: number;
    WarningAlerts: number;
    Services: MonitoringStatusItem[];
    Integrations: MonitoringStatusItem[];
    Alerts: MonitoringAlertItem[];
    StageLoad: MonitoringStageLoadItem[];
}

// Frontend data models for forms
export interface InternalLoginData {
    Email: string;
    Password: string;
}

export interface InternalRegistrationData {
    Username: string;
    FirstName: string;
    MiddleName: string;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    Email: string;
    Password: string;
    ConfirmPassword: string; // For frontend validation
    Role: string;
}

// API request models
export interface InternalLoginRequestApi {
    Email: string;
    Password: string;
}

export interface InternalRegistrationRequestApi {
    Username: string;
    FirstName: string;
    MiddleName?: string;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    Email: string;
    Password: string;
    Role: string;
}

// Response models
export interface InternalLoginResponse {
    Email: string;
    Status: string;
    Token?: string;
    Role?: RoleKey;
    CanonicalRoleKey?: RoleKey;
    InternalUserId?: string;
    ErrorMessage?: string;
}

export interface InternalRegistrationResponse {
    InternalUserId: string;
    Email: string;
    Role: string;
    UnitId?: string | null;
    UnitName?: string | null;
}

export interface InternalRoleRecord {
    RoleId: string;
    RoleName: string;
    CanonicalRoleKey?: RoleKey;
    Description?: string | null;
    IsActive: boolean;
}

export interface InternalUserProfile {
    InternalUserId: string;
    Email: string;
    Username: string;
    FirstName: string;
    MiddleName?: string | null;
    Surname: string;
    ServiceNumber: string;
    UnitId: string;
    UnitName: string;
    RoleName: string;
    CanonicalRoleKey?: RoleKey;
    Status: string;
    LastLogin?: string | null;
    CreatedAt: string;
    RoleEffectiveFrom?: string | null;
    RoleExpiresAt?: string | null;
    BackupRoleName?: string | null;
}

export interface InternalUserProfileUpdateRequest {
    Username: string;
    FirstName: string;
    MiddleName?: string;
    Surname: string;
}

export interface InternalOrganizationalUnitRecord {
    UnitId: string;
    UnitName: string;
    UnitCode: string;
    UnitType: string;
    ParentUnitId?: string | null;
    ParentUnitName?: string | null;
    SortOrder: number;
    IsAssignable: boolean;
    IsActive: boolean;
}

export interface InternalUnitStaffRecord {
    InternalUserId: string;
    Email: string;
    Username: string;
    FirstName: string;
    Surname: string;
    RoleName: string;
    Status: string;
}

export interface InternalNotificationResult {
    NotificationId: string;
    Title: string;
    Message: string;
    NotificationType: string;
    IsRead: boolean;
    CreatedAt: string;
    ReadAt?: string | null;
    ActionUrl?: string | null;
}
