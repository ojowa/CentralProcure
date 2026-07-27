# CentralProcure API Endpoint Mapping (.NET → TypeScript)

Purpose: capture legacy .NET endpoint contracts and port them into the TypeScript API (`apps/api`) with stable behavior and schema.

## How to use
- For each legacy route, fill in:
  - HTTP method + path
  - authentication/authorization requirements
  - request schema
  - response schema
  - DB side effects / workflow transitions
  - regression checklist

## Global notes
- Keep UI-facing contracts stable while migrating.
- When porting, implement TS endpoint first, then fall back to legacy until regression passes.
- Retire a legacy route only after:
  - public frontend flows pass
  - internal workflows pass
  - regression checklist for that module passes

---

## Route inventory template

Copy/paste this block for each endpoint:

```md
### METHOD /path
**Auth/roles:**
- 

**Request schema:**
- body:
  - 
- query/path params:
  - 

**Response schema:**
- 

**Side effects / behavior:**
- DB writes:
- Workflow transitions:
- Stored procedures:

**Validation rules:**
- 

**Regression checklist:**
- [ ] 200 happy path
- [ ] 400 validation failures
- [ ] 401/403 auth failures
- [ ] 404 not found cases
- [ ] 409 conflicts (unique/constraints)
```

---

## Identity (to port first)

### (TBD)

---

## Vendor Sourcing

### (TBD)

---

## Procurement Workflow

### (TBD)

---

## Post Award

### (TBD)

---

## Governance / Internal

### (TBD)

