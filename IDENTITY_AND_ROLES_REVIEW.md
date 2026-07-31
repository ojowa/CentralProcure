# Identity & Roles System Review

**Date:** 2026-07-31

---

## Database: 17 tables in `identity` schema

| Table | Purpose |
|---|---|
| `roles` | 22 seeded roles |
| `internal_users` | 21 seeded users (all password: `password123`) |
| `permissions` | 66 fine-grained permissions across 20 modules |
| `role_permissions` | Maps roles → permissions |
| `internal_modules` | 35+ module catalog (UI navigation) |
| `internal_module_grants` | Role/user module access overrides |
| `user_login_security` | Login lockout tracking (5 attempts → 15min lock) |
| `password_audit` | Password change audit trail |
| `user_role_audit` | Role change audit trail |
| `internal_notifications` | In-app notifications |
| `organizational_units` | Org hierarchy |
| `organizational_positions` | Position hierarchy |
| `vendors` | External vendor accounts |
| `compliance_documents` | Vendor compliance docs |
| `compliance_document_history` | Vendor doc audit |
| `internal_module_grant_audit` | Module access change audit |
| `internal_module_allowed_roles` | **Dropped** (migrated to permissions in migration 102) |

---

## Auth Flow

- **JWT-based** (24hr expiry, httpOnly cookie + Bearer header)
- Login: `POST /api/Auth/internal/login` → stored proc `identity.internal_login()`
- Middleware extracts token, populates `req.auth`
- Permission check: `identity.user_has_permission(role, permission_key)` per route

---

## RBAC: Two-Tier Model

1. **Module access** (can you see it in nav?) — derived from `role_permissions` via `identity.get_role_modules()`
2. **Action permissions** (can you do X within it?) — checked per-route via `requirePermission()`

---

## All Seeded Roles (22)

| # | Role Name | Description |
|---|---|---|
| 1 | Admin | System administrator |
| 2 | RequisitioningOfficer | Initiates and tracks requisitions |
| 3 | DepartmentHead | Approves departmental requisitions |
| 4 | ComptrollerProcurement | Head of procurement unit |
| 5 | ProcurementManager | Oversees procurement operations |
| 6 | TechnicalEvaluator | Technical evaluation |
| 7 | FinancialEvaluator | Financial evaluation |
| 8 | TendersBoardMember | Reviews evaluation outcomes |
| 9 | TendersBoardSecretary | Manages board records |
| 10 | CGIS | Executive approval authority |
| 11 | BPPLiaison | BPP No-Objection submissions |
| 12 | BPPReviewer | Reviews no-objection submissions |
| 13 | PlanningStatisticsOfficer | Procurement planning |
| 14 | FinancialUnitOfficer | Budget readiness validation |
| 15 | LegalReviewer | Legal compliance review |
| 16 | ProcurementSecretary | Committee secretary |
| 17 | ComplaintsReviewOfficer | Administrative review |
| 18 | ContractManager | Contract administration |
| 19 | InspectionOfficer | Inspection and acceptance |
| 20 | PaymentOfficer | Payment tracking |
| 21 | AuditOfficer | Read-only audit access |
| 22 | SystemAdministrator | User/role/config management |

---

## All Seeded Users (21)

All users have password: `password123`

| # | Email | Username | Role |
|---|---|---|---|
| 1 | admin@nis.gov.ng | admin | Admin |
| 2 | procurement@nis.gov.ng | procurement | ComptrollerProcurement |
| 3 | finance@nis.gov.ng | finance | PaymentOfficer |
| 4 | audit@nis.gov.ng | audit | AuditOfficer |
| 5 | ict@nis.gov.ng | ict | SystemAdministrator |
| 6 | requisitioningofficer@nis.gov.ng | requisitioningofficer | RequisitioningOfficer |
| 7 | departmenthead@nis.gov.ng | departmenthead | DepartmentHead |
| 8 | procurementmanager@nis.gov.ng | procurementmanager | ProcurementManager |
| 9 | technicalevaluator@nis.gov.ng | technicalevaluator | TechnicalEvaluator |
| 10 | financialevaluator@nis.gov.ng | financialevaluator | FinancialEvaluator |
| 11 | tendersboardmember@nis.gov.ng | tendersboardmember | TendersBoardMember |
| 12 | tendersboardsecretary@nis.gov.ng | tendersboardsecretary | TendersBoardSecretary |
| 13 | cgis@nis.gov.ng | cgis | CGIS |
| 14 | bppliaison@nis.gov.ng | bppliaison | BPPLiaison |
| 15 | contractmanager@nis.gov.ng | contractmanager | ContractManager |
| 16 | inspectionofficer@nis.gov.ng | inspectionofficer | InspectionOfficer |
| 17 | planningstatisticsofficer@nis.gov.ng | planningstatisticsofficer | PlanningStatisticsOfficer |
| 18 | financialunitofficer@nis.gov.ng | financialunitofficer | FinancialUnitOfficer |
| 19 | legalreviewer@nis.gov.ng | legalreviewer | LegalReviewer |
| 20 | bppreviewer@nis.gov.ng | bppreviewer | BPPReviewer |
| 21 | complaintsreviewofficer@nis.gov.ng | complaintsreviewofficer | ComplaintsReviewOfficer |

---

## All Permissions (66 permissions across 20 modules)

### `requisition` (9)
- `requisition.create`, `requisition.update`, `requisition.view`, `requisition.view.all`, `requisition.track`, `requisition.delete`, `requisition.endorse`, `requisition.return`, `requisition.reject`

### `budget` (2)
- `budget.view`, `budget.confirm`

### `planning_committee` (2)
- `planning_committee.view`, `planning_committee.review`

### `needs` (4)
- `needs.create`, `needs.view`, `needs.endorse`, `needs.consolidate`

### `procurement_plan` (2)
- `procurement_plan.manage`, `procurement_plan.approve`

### `method` (1)
- `method.determine`

### `tender` (2)
- `tender.manage`, `tender.publish`

### `bid_opening` (3)
- `bid_opening.manage`, `bid_opening.view_detail`, `bid_opening.financial_view`

### `evaluation` (3)
- `evaluation.actions`, `evaluation.technical.score`, `evaluation.financial.score`

### `evaluation_report` (1)
- `evaluation_report.view`

### `approval` (2)
- `approval.review`, `approval.decide`

### `cgis` (4)
- `cgis.approve`, `cgis.reject`, `cgis.return`, `cgis.escalate`

### `high_value_tenders` (1)
- `high_value_tenders.review`

### `bpp` (3)
- `bpp.create`, `bpp.review`, `bpp.decide`

### `administrative_review` (4)
- `administrative_review.create`, `administrative_review.view`, `administrative_review.update`, `administrative_review.resolve`

### `contract_award` (2)
- `contract_award.publish`, `contract_award.view`

### `contract_management` (1)
- `contract_management.manage`

### `inspection` (2)
- `inspection.view`, `inspection.update`

### `payment_tracking` / `payment` / `closeout` (3)
- `payment_tracking.view`, `payment.record`, `closeout.create`

### `audit_dashboard` / `audit_trail` / `compliance_reports` (3)
- `audit_dashboard.view`, `audit_trail.view`, `compliance_reports.view`

### `threshold` (4)
- `threshold.view`, `threshold.edit`, `threshold.configure`, `threshold.resolve`

### `admin` (4)
- `admin.manage_roles`, `admin.vendor_approval`, `admin.manage_workflows`, `admin.monitor`

### `profile` (2)
- `profile.view`, `profile.update`

### `workflow_blueprint` (1)
- `workflow_blueprint.view`

---

## Security Issues Found

| # | Severity | Issue |
|---|---|---|
| 1 | **CRITICAL** | **Unauthenticated registration** — `POST /api/Auth/internal/register` has no admin gate. Anyone can register as `Admin`. |
| 2 | **CRITICAL** | **No JWT verification in dev** — When `JWT_KEY` unset, tokens are unsigned. Anyone can forge `role: 'Admin'`. |
| 3 | **CRITICAL** | **Plaintext password fallback** — `password.ts` accepts plaintext if hash matches plaintext, silently upgrades. |
| 4 | **HIGH** | **User mgmt endpoints unprotected** — `GET/PUT/DELETE /api/Auth/internal/users/*` have no admin check. Any authenticated user can list/edit/delete users and change roles. |
| 5 | **HIGH** | **Role CRUD unprotected** — `POST/PUT/DELETE /api/Auth/roles/*` have no admin check. |
| 6 | **HIGH** | **No token revocation** — Logout only clears cookie. Stolen JWT valid for 24hrs. |
| 7 | **HIGH** | **No rate limiting** on login endpoint. |
| 8 | **HIGH** | **Security stamp middleware exists but is never wired up** — Dead code in `middleware/security-stamp.ts`. |
| 9 | **MEDIUM** | **Session idle middleware exists but is never wired up** — Dead code in `middleware/session-idle.ts`. |
| 10 | **MEDIUM** | **Vendor login doesn't check `vendor_status`** — Rejected vendors still get valid JWT. |
| 11 | **MEDIUM** | **Permissions fetched per-component** — No shared cache, multiple API calls on same page. |
| 12 | **LOW** | **10 roles have no static definition** in `internalData.ts` — Show "Role Unavailable" in header. |
| 13 | **LOW** | **Password change disabled** on Profile page. |

---

## API Endpoints for Identity & Auth

### Authentication
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/Auth/internal/login` | No | Internal user login |
| POST | `/api/Auth/internal/register` | No | Register new internal user |
| POST | `/api/Auth/internal/logout` | No | Logout (clear cookie) |
| GET | `/api/Auth/internal/profile` | Yes | Get own profile |
| PUT | `/api/Auth/internal/profile` | Yes | Update own profile |
| POST | `/api/Auth/login` | No | Vendor login |
| POST | `/api/Auth/register` | No | Register new vendor |
| GET | `/api/Auth/me` | Yes | Get current user from token |
| POST | `/api/Auth/logout` | No | Vendor logout |

### User Management
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/users` | Yes | List all users |
| PUT | `/api/Auth/internal/users/:id` | Yes | Update user |
| PUT | `/api/Auth/internal/users/:id/role` | Yes | Change user role |
| PUT | `/api/Auth/internal/users/:id/status` | Yes | Change user status |
| DELETE | `/api/Auth/internal/users/:id` | Yes | Deactivate user |
| POST | `/api/Auth/internal/users/:id/reset-password` | Yes + Admin | Admin password reset |

### Role Management
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/roles` | Yes | List all roles |
| GET | `/api/Auth/roles/:roleId` | Yes | Get role by ID |
| POST | `/api/Auth/roles` | Yes | Create role |
| PUT | `/api/Auth/roles/:roleId` | Yes | Update role |
| DELETE | `/api/Auth/roles/:roleId` | Yes | Deactivate role |
| GET | `/api/Auth/roles/:roleId/users` | Yes | Get users with role |

### Permissions
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/permissions` | Yes | Current user's permissions |
| GET | `/api/Auth/internal/permissions/check` | Yes | Check specific permission |
| GET | `/api/Auth/internal/permissions/all` | Yes + Admin | All permissions |
| GET | `/api/Auth/internal/role-permissions` | Yes + Admin | Role-permission mappings |
| PUT | `/api/Auth/internal/role-permissions` | Yes + Admin | Grant permission to role |
| DELETE | `/api/Auth/internal/role-permissions` | Yes + Admin | Revoke permission |

### Module Access
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/modules` | Yes | User's accessible modules |
| GET | `/api/Auth/internal/modules/catalog` | Yes | Full module catalog |
| GET | `/api/Auth/internal/module-access/roles` | Yes | Role-module grants |
| PUT | `/api/Auth/internal/module-access/roles` | Yes | Upsert role grant |
| DELETE | `/api/Auth/internal/module-access/roles` | Yes | Disable role grant |
| GET | `/api/Auth/internal/module-access/users` | Yes | User-module grants |
| PUT | `/api/Auth/internal/module-access/users` | Yes | Upsert user grant |
| DELETE | `/api/Auth/internal/module-access/users` | Yes | Disable user grant |
| GET | `/api/Auth/internal/module-access/audit` | Yes | Access audit log |

### Organizational Units
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/units` | Yes | List units |
| POST | `/api/Auth/internal/units` | Yes | Create/update unit |
| GET | `/api/Auth/internal/units/:unitId/staff` | Yes | Unit staff |

### Notifications
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/notifications` | Yes | Get notifications |
| PUT | `/api/Auth/internal/notifications/:id/read` | Yes | Mark read |

### Audit
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/Auth/internal/user-role/audit` | Yes | Role change audit |

---

## Frontend Architecture

### Auth State
- Managed by `AuthProvider` context in `useAuth.tsx`
- JWT stored in `localStorage` under `__internal_jwt_token__`
- 15-minute idle timeout with cross-tab sync
- Session restoration on page load via profile fetch

### RoleKey Values (25)
`admin`, `requisitioning_officer`, `department_head`, `formation_officer`, `formation_head`, `comptroller_procurement`, `procurement_manager`, `planning_statistics_officer`, `financial_unit_officer`, `procurement_secretary`, `legal_reviewer`, `technical_evaluator`, `financial_evaluator`, `evaluation_committee`, `tenders_board`, `tenders_board_secretary`, `accounting_officer`, `bpp_liaison`, `bpp_reviewer`, `complaints_review_officer`, `contract_manager`, `inspection_officer`, `payment_officer`, `audit_oversight`, `ict_admin`

### Role Aliases (legacy → canonical)
- `system_administrator` → `ict_admin`
- `tenders_board_member` → `tenders_board`
- `audit_officer` → `audit_oversight`
- `cgis` → `accounting_officer`
- `comptrollerprocurement` → `comptroller_procurement`

### User Management UI
6-tab admin module (`UserRoleManagementModule`):
1. Active Directory (users)
2. Role Catalog
3. Module Access
4. Permissions
5. Committee Members
6. User Onboarding

### Permission Checking
- `usePermission(token)` hook — fetches permissions, returns `hasPermission(key)`
- Used in 10+ components for client-side action gating
- No shared cache — each component fetches independently

---

## Suggested Priority Fixes

1. **Gate registration endpoints** behind admin role
2. **Add admin checks** to user/role management endpoints
3. **Wire up security-stamp and session-idle middleware**
4. **Add rate limiting** to auth endpoints
5. **Check `vendor_status`** on vendor login
6. **Add static definitions** for 10 missing roles in `internalData.ts`
7. **Implement password change** on Profile page
