# InternalShell.tsx Restructuring TODO

## Status: In Progress (0/18 complete)

### Phase 1: Core Extraction (4/4 ✅ Complete)
- [x] Create utils/procureUtils.ts (formats, tones, validators)
- [x] Create data/internalData.ts (hardcoded data: budgets, thresholds, etc.)
- [x] Create InternalShellLayout.tsx (main state + render logic)
- [x] Update InternalShell.tsx (minimal shell + re-exports)

### Phase 2: Layout Components (3/3 ✅ Complete)
- [x] Extract InternalHeader.tsx
- [x] Extract SidebarNav.tsx  
- [x] Extract DashboardPage.tsx

### Phase 3: Module Pages (0/12 ⏳ Pending)
- [ ] RequisitionModulePage.tsx (PRIORITY - largest ~2000+ lines)
- [ ] ProcurementPlansModulePage.tsx
- [ ] AssignedTendersModulePage.tsx
- [ ] ContractAwardModulePage.tsx
- [ ] ContractManagementModulePage.tsx
- [ ] InspectionAcceptanceModulePage.tsx
- [ ] EvaluationReportModulePage.tsx
- [ ] WorkflowBlueprintModulePage.tsx
- [ ] AdministrativeReviewModulePage.tsx (leverage existing)
- [ ] AuditDashboardWorkspace.tsx (leverage existing)
- [ ] AuditTrailWorkspace.tsx (leverage existing)
- [ ] ComplianceReportsWorkspace.tsx (leverage existing)

### Phase 4: Finalization (0/2 ⏳ Pending)
- [ ] Create InternalShell/index.tsx (re-export originals for App.tsx compat)
- [ ] Update App.tsx imports to new structure

### Phase 5: Testing & Cleanup (0/3 ⏳ Pending)
- [ ] Test: cd Frontend && npm run dev (verify no breakage)
- [ ] Lint: eslint & prettier
- [ ] Update README with new structure

**Next Step:** Extract RequisitionModulePage.tsx (largest first for max impact)

**Legend:** ✅ Complete | ⏳ In Progress | 🔄 Blocked | ❌ Failed

