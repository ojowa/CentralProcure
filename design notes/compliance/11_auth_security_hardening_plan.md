# Authentication Security Hardening Plan

## Objective

Reduce the risk of anonymous access, privilege escalation, and token compromise across the backend and frontend.

## Audit Summary

### Critical risks identified

1. Internal identity administration was exposed without sufficient protection.
   - `POST /api/Auth/internal/register`
   - `POST /api/Auth/roles`
   - `PUT /api/Auth/internal/users/role`

2. Multiple business controllers relied on no default authorization policy.
   - Any controller or action without `[Authorize]` was effectively public.

3. Internal JWTs are stored in browser `localStorage`.
   - This increases XSS impact because a stolen token can be replayed.

4. JWT signing currently has a code-level fallback secret.
   - Missing runtime configuration could allow predictable token signing.

5. Cookie and bearer authentication are mixed through a shared JWT extraction path.
   - This increases ambiguity around which requests are protected by CSRF and which are bearer-only.

## Phase Plan

### Phase 1

Scope implemented in code:

1. Require authenticated users by default across backend controllers.
2. Mark only true public endpoints as anonymous.
   - vendor login
   - vendor registration
   - internal login
   - public tender browsing
   - health checks
3. Protect identity administration endpoints behind authenticated access.
4. Restrict sensitive identity administration actions to identity administrators.
   - allowed roles: `admin`, `ict_admin`

Implementation notes:

- Added a fallback authorization policy in `Backend/Program.cs`.
- Added `[AllowAnonymous]` only to public entry points.
- Added `[Authorize]` and role checks for internal registration, role creation, role listing, organizational units, and internal user role updates.

### Phase 2

Scope implemented in code:

1. Remove the fallback JWT signing secret and fail startup if JWT settings are missing.
2. Restrict CORS to approved frontend origins.

Implementation notes:

- Removed the JWT fallback secret path from `Backend/Program.cs`.
- Added startup validation for:
  - `Jwt:Key`
  - `Jwt:Issuer`
  - `Jwt:Audience`
  - `Jwt:DurationInMinutes`
- Enforced a minimum JWT key length of 32 bytes.
- Replaced `AllowAnyOrigin()` CORS with a named allowlist policy sourced from `Cors:AllowedOrigins`.
- Added explicit development and production CORS origin configuration in backend appsettings files.

Deployment note:

- The backend will now fail fast at startup until these values are configured with real values:
  - `Jwt__Key`
  - `Jwt__Issuer`
  - `Jwt__Audience`
  - `Jwt__DurationInMinutes`
- CORS origins can be overridden with:
  - `Cors__AllowedOrigins__0`
  - `Cors__AllowedOrigins__1`
  - and so on

Remaining recommended next change:

1. Add integration tests for anonymous access to mutating endpoints.

### Phase 3

Implemented auth model cleanup:

1. Vendor and internal sessions now use distinct cookies:
   - `vendorAuthToken`
   - `internalAuthToken`
2. Internal portal session state no longer persists JWTs in browser `localStorage`.
3. Internal portal auth now restores from the server-backed `internalAuthToken` HttpOnly cookie by calling the internal profile endpoint on startup.
4. Internal logout now clears the internal auth cookie instead of only redirecting the UI.
5. Cookie-backed unsafe requests continue to carry CSRF protection, while the frontend strips the internal cookie-session sentinel from outgoing same-origin requests so bearer validation is not triggered accidentally.

## Phase 1 Expected Impact

### Positive

- Anonymous callers can no longer reach unprotected internal or workflow mutation endpoints by default.
- Role and user-management endpoints are no longer publicly callable.
- Public tender and login/registration flows remain accessible.

### Operational impact

- Internal self-service registration is no longer public.
- Role and unit discovery endpoints now require authenticated access.
- Any frontend flow that depended on public internal registration or public internal role listing must be treated as an admin workflow instead.
