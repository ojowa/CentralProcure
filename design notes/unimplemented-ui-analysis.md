# Unimplemented UI Analysis - CentralProcure Frontend

## Overview
Analysis of the CentralProcure frontend codebase reveals several UI modules that have corresponding backend endpoints defined but lack frontend implementations.

## Root Cause
The issue stems from mismatches between:
1. Module IDs resolved in `moduleService.shared.ts` (resolveModuleUrl function)
2. Components mapped in `InternalModuleRenderers.tsx` (moduleRenderers object)

## Unimplemented Modules Identified

### 1. Tender Review Module
- **Module ID**: `tender-review`
- **Backend Endpoint**: `${serviceBaseUrls.workflow}/api/approvals`
- **Purpose**: Allow procurement officers to review tender submissions before approval
- **Status**: Completely missing implementation

### 2. Approval Rejection Module  
- **Module ID**: `approval-rejection`
- **Backend Endpoint**: `${serviceBaseUrls.workflow}/api/approvals`
- **Purpose**: Handle formal approval or rejection decisions on tenders/requisitions
- **Status**: Completely missing implementation

### 3. High-Value Tenders Module
- **Module ID**: `high-value-tenders`
- **Backend Endpoint**: `${serviceBaseUrls.workflow}/api/approvals`
- **Purpose**: Specialized view for tenders requiring BPP (Bureau of Public Procurement) review
- **Status**: Referenced in BppEscalationModule.tsx but not properly mapped in moduleRenderers

### 4. Contract Award Module
- **Module ID**: `contract-award`
- **Backend Endpoint**: `${serviceBaseUrls.postAward}/api/contracts`
- **Purpose**: Manage the contract awarding process after tender selection
- **Status**: Missing specific implementation (contract-management exists but may not cover award workflow)

## Technical Details

### Service Mapping (moduleService.shared.ts)
```typescript
// Lines 44-46 show the missing mappings:
case 'tender-review':
case 'approval-rejection':
case 'high-value-tenders':
  return `${serviceBaseUrls.workflow}/api/approvals`;
```

### Current Implementation Status
In InternalModuleRenderers.tsx, lines 83-115 show implemented modules:
- All requisition modules implemented ✓
- All tender modules except review/approval implemented ✓
- All post-award modules implemented ✓
- All governance/modules implemented ✓

### Missing Mappings in moduleRenderers
- `'tender-review'`: Not present
- `'approval-rejection'`: Not present  
- `'high-value-tenders'`: Not present
- `'contract-award'`: Not present (though contract-management exists)

## Implementation Approach
Following the established pattern in the codebase:

1. Create new component files in `/src/internal/components/`
2. Add entries to `moduleRenderers` in `InternalModuleRenderers.tsx`
3. Implement proper TypeScript typing using existing interfaces
4. Connect to backend services via the established `fetchModuleData` pattern
5. Implement role-based access control using the `grantedActions` pattern
6. Follow the 400-line limit per file mandate from GEMINI.md

## Next Steps
Proceed with implementation of tender-review module as proof of concept, then apply similar patterns to other missing modules.
