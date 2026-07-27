# CentralProcure Migration TODO

This checklist tracks the migration to a TypeScript monorepo backend (apps/api) and eventual retirement of the legacy .NET backend (Backend/).

## 0. Monorepo baseline (setup & stability)
- [ ] Verify workspace commands work end-to-end:
  - [ ] `npm install` (root)
  - [ ] `npm run dev:api`
  - [ ] `npm run build:api`
  - [ ] `npm run typecheck`
- [ ] Confirm environment variable contract between Render and `apps/api`.
  - [ ] `apps/api/src/config.ts` envs:
    - [ ] `PORT`
    - [ ] `DATABASE_URL` (or legacy alias `ConnectionStrings__Primary`)
    - [ ] `JWT_KEY` (`Jwt__Key` alias)
    - [ ] `JWT_ISSUER` (`Jwt__Issuer` alias)
    - [ ] `JWT_AUDIENCE` (`Jwt__Audience` alias)
    - [ ] `JWT_DURATION_MINUTES` (`Jwt__DurationInMinutes` alias)
    - [ ] `CORS_ALLOWED_ORIGINS`
  - [ ] `render.yaml` sets: `NODE_ENV`, `DATABASE_URL`, `JWT_KEY`, `CORS_ALLOWED_ORIGINS`, plus issuer/audience defaults.
- [ ] Validate Docker build for `apps/api` is correct for prod.
  - [ ] `apps/api/Dockerfile` uses npm workspaces + builds `@centralprocure/shared` then `@centralprocure/api`.
  - [ ] Confirm runtime exposes port `5000` and `CMD` runs `apps/api/dist/server.js`.
  - [ ] Ensure your runtime provides `DATABASE_URL` and `JWT_KEY` secrets.


## 1. API contract inventory (.NET → TypeScript)
- [ ] Enumerate legacy endpoints (method/path):
  - [ ] Auth
  - [ ] Vendor management
  - [ ] Procurement workflow
  - [ ] Post award
  - [ ] Governance/internal
- [ ] For each endpoint, capture:
  - [ ] request body/query
  - [ ] response shape
  - [ ] auth/role requirements
  - [ ] DB side effects / workflow transitions
  - [ ] stored procedure usage (if any)
- [ ] Create regression checklist per module.

## 2. DB layer migration strategy (TypeScript persistence)
- [ ] Pick/confirm persistence approach in TS:
  - [ ] direct SQL with pg (typed mapping)
  - [ ] and/or stored procedure calls
- [ ] Implement standardized DB utilities:
  - [ ] connection pooling (single shared pool)
  - [ ] transaction helper wrapper
  - [ ] query helper patterns
  - [ ] consistent error → HTTP status mapping (400/401/403/404/409/500)
- [ ] Ensure snake_case ↔ property mapping is consistent.

## 3. Port modules in low-risk order
> Recommended order (from Backend/README.md): Identity → Vendor Sourcing → Procurement Workflow → Post Award → Governance.

### 3.1 Identity module
- [ ] Port request/response DTOs with `zod`
- [ ] Port auth flows (register/login/token validation)
- [ ] Port role checks / authorization rules
- [ ] Port vendor/internal registration flows
- [ ] Add regression checks (smoke tests)

### 3.2 Vendor Sourcing module
- [ ] Port tenders endpoints
- [ ] Port bid submission & bid opening logic
- [ ] Ensure uniqueness/constraints handling (HTTP 409 where appropriate)
- [ ] Add regression checks

### 3.3 Procurement Workflow module
- [ ] Port plan/workflow creation
- [ ] Port status transitions and workflow runtime tracking
- [ ] Port approval/review orchestration
- [ ] Add regression checks

### 3.4 Post Award module
- [ ] Port contracts
- [ ] Port inspections & evaluation outcomes
- [ ] Ensure workflow + ledger impacts match legacy behavior
- [ ] Add regression checks

### 3.5 Governance/internal module
- [ ] Port internal module access rules
- [ ] Port administrative reviews/closeouts
- [ ] Add regression checks

## 4. Backwards compatibility & legacy router retirement
- [ ] Implement a strangler pattern:
  - [ ] TS-first handling
  - [ ] legacy fallback
- [ ] Add logging/metrics to track which implementation handled each route.
- [ ] Retire legacy routes when TS endpoints pass regression thresholds.

## 5. Testing & regression gates
- [ ] Typecheck gate: `npm run typecheck`
- [ ] Build gate: `npm run build:api`
- [ ] Smoke regression scripts for critical routes
- [ ] Optional: request/response snapshot tests for stable endpoints

## 6. Deployment & finalization
- [ ] Ensure Render deploys only TS services.
- [ ] Verify production secrets & env vars.
- [ ] Retire .NET runtime (keep code as reference).

