import { Router } from 'express';
import type { Request } from 'express';
import { legacyRoutes, type LegacyRoute } from './legacy-route-manifest.js';

export const legacyRouter = Router();

const now = () => new Date().toISOString();

const encodeBase64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const createDevelopmentToken = (payload: Record<string, unknown>): string => {
  const header = { alg: 'none', typ: 'JWT' };
  const claims = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    ...payload
  };

  return `${encodeBase64Url(header)}.${encodeBase64Url(claims)}.`;
};

const internalModules = [
  ['create-requisition', 'Create Requisition', 'Planning', 'workflow'],
  ['requisition-history', 'Requisition History', 'Planning', 'workflow'],
  ['requisition-tracking', 'Requisition Tracking', 'Planning', 'workflow'],
  ['annual-procurement-plan', 'Annual Procurement Plan', 'Planning', 'workflow'],
  ['procurement-planning-committee', 'Planning Committee', 'Planning', 'workflow'],
  ['procurement-method-determination', 'Procurement Method', 'Workflow', 'workflow'],
  ['create-tender', 'Create Tender', 'Tendering', 'vendorSourcing'],
  ['bid-opening-session', 'Bid Opening', 'Tendering', 'vendorSourcing'],
  ['assigned-tenders', 'Assigned Tenders', 'Evaluation', 'workflow'],
  ['technical-evaluation', 'Technical Evaluation', 'Evaluation', 'workflow'],
  ['financial-evaluation', 'Financial Evaluation', 'Evaluation', 'workflow'],
  ['evaluation-report', 'Evaluation Report', 'Evaluation', 'workflow'],
  ['tenders-board-approval', 'Tenders Board Approval', 'Approval', 'workflow'],
  ['cgis-approval', 'CGIS Approval', 'Approval', 'workflow'],
  ['bpp-escalation', 'BPP Escalation', 'Compliance', 'workflow'],
  ['administrative-review', 'Administrative Review', 'Compliance', 'workflow'],
  ['contract-award', 'Contract Award', 'Post Award', 'postAward'],
  ['contract-management', 'Contract Management', 'Post Award', 'postAward'],
  ['inspection-acceptance', 'Inspection Acceptance', 'Post Award', 'postAward'],
  ['payment-tracking', 'Payment Tracking', 'Post Award', 'postAward'],
  ['budget-workspace', 'Budget Workspace', 'Governance', 'governance'],
  ['audit-dashboard', 'Audit Dashboard', 'Governance', 'governance'],
  ['audit-trail-viewer', 'Audit Trail', 'Governance', 'governance'],
  ['workflow-configuration', 'Workflow Configuration', 'Administration', 'workflow'],
  ['system-monitoring', 'System Monitoring', 'Administration', 'governance'],
  ['user-role-management', 'User Role Management', 'Administration', 'identity']
].map(([Id, Title, Section, Microservice]) => ({
  Id,
  Title,
  Section,
  Microservice,
  Description: `${Title} workspace`,
  ControlPurpose: 'Compatibility placeholder while the TypeScript API business logic is being ported.',
  Actions: ['read'],
  CatalogActions: ['read'],
  GrantSource: 'compatibility',
  IsVisible: true,
  HasRoleOverride: false,
  HasUserOverride: false
}));

const roles = [
  { RoleId: '00000000-0000-4000-8000-000000000001', RoleName: 'ict_admin', CanonicalRoleKey: 'ict_admin', Description: 'ICT administrator', IsActive: true },
  { RoleId: '00000000-0000-4000-8000-000000000002', RoleName: 'procurement_manager', CanonicalRoleKey: 'procurement_manager', Description: 'Procurement manager', IsActive: true },
  { RoleId: '00000000-0000-4000-8000-000000000003', RoleName: 'requisitioning_officer', CanonicalRoleKey: 'requisitioning_officer', Description: 'Requisitioning officer', IsActive: true }
];

const units = [
  {
    UnitId: '00000000-0000-4000-8000-000000000101',
    UnitCode: 'HQ',
    UnitName: 'Headquarters',
    UnitType: 'Command',
    ParentUnitId: null,
    SortOrder: 1,
    IsAssignable: true,
    IsActive: true
  }
];

const getCompatibilityPayload = (route: LegacyRoute, request: Request): unknown => {
  const path = request.path.toLowerCase();
  const email = typeof request.body?.Email === 'string'
    ? request.body.Email
    : typeof request.body?.email === 'string'
      ? request.body.email
      : 'demo@centralprocure.local';

  if (path === '/api/auth/internal/login') {
    const internalUserId = '00000000-0000-4000-8000-000000000201';
    return {
      Status: 'Success',
      Email: email,
      InternalUserId: internalUserId,
      Role: 'ict_admin',
      CanonicalRoleKey: 'ict_admin',
      Token: createDevelopmentToken({
        sub: internalUserId,
        email,
        role: 'ict_admin'
      })
    };
  }

  if (path === '/api/auth/login') {
    const vendorId = '00000000-0000-4000-8000-000000000301';
    return {
      Status: 'Success',
      Email: email,
      VendorId: vendorId,
      CompanyName: request.body?.CompanyName ?? 'Demo Vendor',
      Token: createDevelopmentToken({
        sub: vendorId,
        email,
        role: 'vendor'
      })
    };
  }

  if (path === '/api/auth/me') {
    return {
      UserId: '00000000-0000-4000-8000-000000000301',
      Email: 'demo.vendor@centralprocure.local',
      Role: 'vendor'
    };
  }

  if (path === '/api/auth/internal/profile') {
    return {
      InternalUserId: '00000000-0000-4000-8000-000000000201',
      Email: 'demo.internal@centralprocure.local',
      Username: 'demo.internal',
      FirstName: 'Demo',
      Surname: 'Internal',
      RoleName: 'ict_admin',
      CanonicalRoleKey: 'ict_admin',
      UnitId: units[0].UnitId,
      UnitName: units[0].UnitName,
      IsActive: true
    };
  }

  if (path === '/api/auth/internal/modules' || path === '/api/auth/internal/modules/catalog') {
    return internalModules;
  }

  if (path === '/api/auth/roles') {
    return roles;
  }

  if (path === '/api/auth/internal/units') {
    return route.method === 'GET' ? units : { ...units[0], ...(request.body ?? {}) };
  }

  if (path.includes('/staff') || path.endsWith('/internal/users')) {
    return [];
  }

  if (path.includes('/module-access') || path.includes('/user-role/audit') || path.includes('/notifications')) {
    return [];
  }

  if (path.endsWith('/availability')) {
    return {
      EmailAvailable: true,
      RegistrationNumberAvailable: true,
      TaxIdAvailable: true
    };
  }

  if (path === '/api/monitoring') {
    return {
      status: 'Healthy',
      runtime: 'typescript',
      generatedAt: now(),
      services: []
    };
  }

  if (path.includes('/dashboard') || path.includes('/summary')) {
    return {
      generatedAt: now(),
      items: [],
      totals: {},
      message: 'No live data is available while this module is being ported to TypeScript.'
    };
  }

  if (path.includes('/file') || path.includes('/checklist')) {
    return {
      FileUrl: '',
      Message: 'File endpoints are pending in the TypeScript API.'
    };
  }

  if (route.method === 'GET') {
    return [];
  }

  if (route.method === 'DELETE') {
    return { Status: 'Success', Deleted: true };
  }

  return {
    Status: 'Accepted',
    Message: 'Request accepted by the TypeScript compatibility API while business logic is being ported.',
    ReceivedAt: now()
  };
};

for (const route of legacyRoutes) {
  legacyRouter[route.method.toLowerCase() as Lowercase<typeof route.method>](route.path, (request, response) => {
    response.json(getCompatibilityPayload(route, request));
  });
}
