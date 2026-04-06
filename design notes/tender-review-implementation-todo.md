# Tender Review Module Implementation - TODO Guide

## Overview
This document serves as a guide for implementing the tender-review module in the CentralProcure frontend. It outlines the approach taken and provides a template for implementing similar missing modules.

## Implementation Summary

### Files Created/Modified:
1. **New Component**: `Frontend/src/internal/components/TenderReviewPage.tsx`
2. **New Detail View**: `Frontend/src/internal/components/tenderWorkspace/detailViews.tsx`
3. **Updated Mapping**: `Frontend/src/internal/components/InternalModuleRenderers.tsx` (added tender-review entry)

### Implementation Approach

#### 1. Component Structure
Following the established pattern from `CreateRequisitionPage.tsx`:
- Client-side component (`'use client'`)
- React hooks for state management (`useState`, `useEffect`)
- Proper TypeScript typing using existing interfaces
- Modular separation of concerns (list view vs detail view)
- Role-based access control considerations
- Loading states and error handling
- Feedback mechanisms for user actions

#### 2. Key Features Implemented
- **Tender Listing**: Displays tenders with filtering capabilities
- **Detail View**: Modal-based detailed tender review
- **Workflow Context**: Basic workflow stage and action information
- **Responsive Design**: Card-based layout that adapts to screen size
- **Loading States**: Visual feedback during data fetching
- **Error Handling**: Graceful degradation when data loading fails
- **Empty States**: Informative messages when no data matches filters

#### 3. Data Flow
- Uses existing `fetchTenders` service from `tenderService.ts`
- Implements simulated detail view (in production would use `fetchTenderDetail`)
- Includes basic workflow context simulation
- Follows same authentication pattern as other modules (Bearer token)

#### 4. UI/UX Patterns
- Consistent with existing module styling (using Tailwind-like class names)
- Follows established component naming conventions
- Uses similar modal patterns for detail views
- Maintains visual consistency with badge/status indicators
- Implements intuitive action buttons (Review Details)

## Template for Future Implementations

When implementing other missing modules (approval-rejection, high-value-tenders, contract-award), follow this pattern:

### Step 1: Create Component File
```
/src/internal/components/[ModuleName]Page.tsx
```
- Export a React component accepting standard props (module, token, role, etc.)
- Implement data fetching using appropriate service
- Create list and detail views as needed
- Add proper TypeScript typing
- Include loading/error/empty states
- Keep under 400 lines (per GEMINI.md mandate)

### Step 2: Create Supporting Views (if needed)
```
/src/internal/components/[module-name]Workspace/
├── detailViews.tsx
└── sectionViews.tsx
```
- Separate concerns between list and detail views
- Reuse existing helper functions and utilities
- Follow established naming conventions

### Step 3: Update Module Mapping
In `/src/internal/components/InternalModuleRenderers.tsx`:
Add entry to `moduleRenderers` object:
```typescript
'[module-id]': (props) => <[ModuleName]Page module={props.module} token={props.token} role={props.role} userEmail={props.userEmail} availableModuleIds={props.availableModuleIds} onModuleChange={props.onModuleChange} />,
```

### Step 4: Implement Role-Based Access
- Use the `grantedActions` from workflow context to conditionally show UI elements
- Follow patterns from existing modules like `CreateRequisitionPage`
- Reference `WorkflowActionSnapshotResponse` for available actions
- Implement role-specific guidance where appropriate

## Specific Notes for Remaining Modules

### Approval-Rejection Module
- Should focus on decision-making interface
- Needs form for approval/rejection with comments
- Should integrate with workflow action execution
- Consider adding decision history timeline

### High-Value Tenders Module
- Specialized view for BPP-review tenders
- May require additional validation/display fields
- Should emphasize escalation workflow context
- Might need special routing logic

### Contract Award Module
- Focus on contract creation from awarded tenders
- Should include contract terms, values, dates
- Needs integration with contract management service
- May require approval workflow for contract creation

## Verification Checklist

Before considering implementation complete:
- [ ] Component renders without errors
- [ ] Data loading states work correctly
- [ ] Error handling is graceful
- [ ] Empty states display appropriately
- [ ] Detail views open and close correctly
- [ ] Responsiveness works on different screen sizes
- [ ] Follows established codebase patterns
- [ ] TypeScript types are correct and complete
- [ ] File size is under 400 lines
- [ ] Properly integrated in moduleRenderers
- [ ] Uses existing services where applicable
- [ ] Follows accessibility best practices (semantic HTML, etc.)

## Next Steps
1. Implement approval-rejection module using this guide
2. Implement high-value-tenders module
3. Implement contract-award module
4. Review all implementations for consistency
5. Run linting and type checking to ensure code quality