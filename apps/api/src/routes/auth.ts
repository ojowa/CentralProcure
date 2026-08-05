import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { signToken, extractPayloadFromRequest, TokenPayload } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { config } from '../config.js';
import { authRateLimiter, registrationRateLimiter } from '../middleware/rate-limit.js';
import { withModuleDataset } from '../lib/module-datasets.js';
import { toCanonicalRoleKey } from '../lib/role-canonical.js';

export const authRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: config.nodeEnv === 'production' ? ('none' as const) : ('lax' as const),
  secure: config.nodeEnv === 'production',
  maxAge: 24 * 60 * 60 * 1000
};

const loginSchema = z.object({
  Email: z.string().email('Invalid email format.').max(320),
  Password: z.string().min(1, 'Password is required.').max(256),
});

const registerSchema = z.object({
  Email: z.string().email('Invalid email format.').max(320),
  Username: z.string().min(3, 'Username must be at least 3 characters.').max(64),
  FirstName: z.string().min(1, 'First name is required.').max(128),
  MiddleName: z.string().max(128).optional().default(''),
  Surname: z.string().min(1, 'Surname is required.').max(128),
  ServiceNumber: z.string().max(64).optional().default(''),
  Password: z.string().min(8, 'Password must be at least 8 characters.').max(256),
  Role: z.string().min(1, 'Role is required.').max(64),
  UnitId: z.string().uuid().optional(),
});

function requireAuth(req: Request): TokenPayload | null {
  return extractPayloadFromRequest(req.headers.authorization);
}

const ADMIN_ROLES = ['Admin', 'IdentityAdministrator', 'SystemAdministrator', 'ict_admin', 'system_administrator'];

function requireAdmin(req: Request, res: Response): TokenPayload | null {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return null; }
  if (!auth.role || !ADMIN_ROLES.includes(auth.role)) {
    res.status(403).json({ ErrorMessage: 'Forbidden: Administrator role required.' });
    return null;
  }
  return auth;
}

function requireDb(res: Response): boolean {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return false;
  }
  return true;
}

function toPascal(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[toPascal(k)] = v;
  }
  return out;
}

// ─────────────────────────────────────────────
// 1. POST /api/Auth/internal/login
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/internal/login', authRateLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ErrorMessage: parsed.error.issues[0].message });
    return;
  }
  const { Email, Password } = parsed.data;
  if (!requireDb(res)) return;

  try {
    const userQuery = await pool!.query(
      'SELECT internal_user_id, email, password_hash, role_name, status, security_stamp, unit_id FROM identity.internal_users iu JOIN identity.roles r ON r.role_id = iu.role_id WHERE iu.email = $1',
      [Email]
    );
    const dbUser = userQuery.rows[0];

    if (!dbUser) {
      res.status(401).json({ ErrorMessage: 'Invalid credentials.' });
      return;
    }

    const isPasswordValid = await verifyPassword(Password, dbUser.password_hash);
    const spPasswordHash = isPasswordValid ? dbUser.password_hash : 'INVALID_HASH_TO_TRIGGER_SP_FAILURE';

    const result = await pool!.query('SELECT * FROM identity.internal_login($1, $2)', [Email, spPasswordHash]);
    const user = result.rows[0];

    if (!user || user.error_message) {
      res.status(401).json({ ErrorMessage: user?.error_message || 'Invalid credentials.' });
      return;
    }

    const token = signToken({
      sub: user.internal_user_id,
      email: user.email,
      role: user.role,
      CanonicalRoleKey: toCanonicalRoleKey(user.role),
      InternalUserId: user.internal_user_id,
      UnitId: dbUser.unit_id || null,
      SecurityStamp: dbUser.security_stamp || undefined
    });

    res.cookie('internalAuthToken', token, COOKIE_OPTS);
    res.json({
      Status: 'Success',
      Email: user.email,
      InternalUserId: user.internal_user_id,
      Role: user.role,
      CanonicalRoleKey: toCanonicalRoleKey(user.role),
      UnitId: dbUser.unit_id || null,
      Token: token
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred during login.' });
  }
});

// ─────────────────────────────────────────────
// 2. POST /api/Auth/internal/register
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/internal/register', registrationRateLimiter, async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ErrorMessage: parsed.error.issues[0].message });
    return;
  }
  const { Email, Username, FirstName, MiddleName, Surname, ServiceNumber, Password, Role, UnitId } = parsed.data;
  if (!requireDb(res)) return;

  try {
    const passwordHash = await hashPassword(Password);
    const result = await pool!.query(
      'SELECT * FROM identity.register_internal_user($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [Email, Username, FirstName, MiddleName || '', Surname, ServiceNumber || '', UnitId || null, passwordHash, Role]
    );
    const user = result.rows[0];

    if (!user) {
      res.status(400).json({ ErrorMessage: 'Registration failed.' });
      return;
    }

    res.json({
      InternalUserId: user.internal_user_id,
      Email: user.email,
      RoleName: user.role_name,
      UnitId: user.unit_id || null
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred during registration.' });
  }
});

// ─────────────────────────────────────────────
// 3. GET /api/Auth/internal/profile
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/profile', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query(
      `SELECT iu.internal_user_id, iu.email, iu.username, iu.first_name, iu.middle_name, iu.surname,
              iu.service_number, iu.unit_id, ou.unit_name, r.role_name, r."group" AS "Group",
              iu.status, iu.last_login, iu.created_at
       FROM identity.internal_users iu
       JOIN identity.roles r ON r.role_id = iu.role_id
       LEFT JOIN identity.organizational_units ou ON ou.unit_id = iu.unit_id
       WHERE iu.internal_user_id = $1`,
      [auth.sub]
    );
    const profile = result.rows[0];
    if (!profile) { res.status(404).json({ ErrorMessage: 'Profile not found.' }); return; }

    res.json({
      InternalUserId: profile.internal_user_id,
      Email: profile.email,
      Username: profile.username,
      FirstName: profile.first_name,
      MiddleName: profile.middle_name,
      Surname: profile.surname,
      ServiceNumber: profile.service_number,
      UnitId: profile.unit_id,
      UnitName: profile.unit_name,
      RoleName: profile.role_name,
      CanonicalRoleKey: toCanonicalRoleKey(profile.role_name),
      Group: profile.Group,
      IsActive: profile.status === 'Active'
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching profile.' });
  }
});

// ─────────────────────────────────────────────
// 4. PUT /api/Auth/internal/profile
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/profile', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { Username, FirstName, MiddleName, Surname } = req.body;
  if (!Username || !FirstName || !Surname) {
    res.status(400).json({ ErrorMessage: 'Required profile fields are missing.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.update_internal_user_profile($1, $2, $3, $4, $5)',
      [auth.sub, Username, FirstName, MiddleName || '', Surname]
    );
    const profile = result.rows[0];
    if (!profile) { res.status(404).json({ ErrorMessage: 'Profile not found or update failed.' }); return; }

    res.json({
      InternalUserId: profile.internal_user_id,
      Email: profile.email,
      Username: profile.username,
      FirstName: profile.first_name,
      MiddleName: profile.middle_name,
      Surname: profile.surname,
      ServiceNumber: profile.service_number,
      UnitId: profile.unit_id,
      UnitName: profile.unit_name,
      RoleName: profile.role_name,
      CanonicalRoleKey: toCanonicalRoleKey(profile.role_name),
      IsActive: profile.status === 'Active'
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating profile.' });
  }
});

// ─────────────────────────────────────────────
// 5. POST /api/Auth/internal/logout
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/internal/logout', (_req: Request, res: Response) => {
  res.clearCookie('internalAuthToken');
  res.json({ Status: 'Success' });
});

// ─────────────────────────────────────────────
// 6. POST /api/Auth/login (vendor)
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/login', authRateLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ErrorMessage: parsed.error.issues[0].message });
    return;
  }
  const { Email, Password } = parsed.data;
  if (!requireDb(res)) return;

  try {
    const vendorQuery = await pool!.query(
      'SELECT vendor_id, email, password_hash, company_name, vendor_status, security_stamp FROM identity.vendors WHERE email = $1',
      [Email]
    );
    const dbVendor = vendorQuery.rows[0];

    if (!dbVendor) {
      res.status(401).json({ ErrorMessage: 'Invalid credentials.' });
      return;
    }

    const isPasswordValid = await verifyPassword(Password, dbVendor.password_hash);
    const spPasswordHash = isPasswordValid ? dbVendor.password_hash : 'INVALID_HASH_TO_TRIGGER_SP_FAILURE';

    const result = await pool!.query('SELECT * FROM identity.login_vendor($1, $2)', [Email, spPasswordHash]);
    const vendor = result.rows[0];

    if (!vendor || vendor.error_message) {
      res.status(401).json({ ErrorMessage: vendor?.error_message || 'Invalid credentials.' });
      return;
    }

    const token = signToken({
      sub: vendor.vendor_id,
      email: vendor.email,
      role: 'Vendor',
      CanonicalRoleKey: 'Vendor',
      VendorId: vendor.vendor_id,
      SecurityStamp: dbVendor.security_stamp || undefined
    });

    res.cookie('vendorAuthToken', token, COOKIE_OPTS);
    res.json({
      Token: token,
      Email: vendor.email,
      VendorId: vendor.vendor_id,
      CompanyName: vendor.company_name,
      Status: vendor.vendor_status
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred during vendor login.' });
  }
});

const vendorRegisterSchema = z.object({
  CompanyName: z.string().min(1, 'Company name is required.').max(256),
  RegistrationNumber: z.string().min(1, 'Registration number is required.').max(64),
  TaxID: z.string().min(1, 'Tax ID is required.').max(64),
  CompanyAddress: z.string().min(1, 'Company address is required.').max(512),
  ContactPerson: z.string().min(1, 'Contact person is required.').max(256),
  PhoneNumber: z.string().max(32).optional().default(''),
  Email: z.string().email('Invalid email format.').max(320),
  Password: z.string().min(8, 'Password must be at least 8 characters.').max(256),
});

// ─────────────────────────────────────────────
// 7. POST /api/Auth/register (vendor)
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/register', registrationRateLimiter, async (req: Request, res: Response) => {
  const parsed = vendorRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ErrorMessage: parsed.error.issues[0].message });
    return;
  }
  const { CompanyName, RegistrationNumber, TaxID, CompanyAddress, ContactPerson, PhoneNumber, Email, Password } = parsed.data;
  if (!requireDb(res)) return;

  try {
    const passwordHash = await hashPassword(Password);
    const result = await pool!.query(
      'SELECT * FROM identity.register_vendor($1, $2, $3, $4, $5, $6, $7, $8)',
      [CompanyName, RegistrationNumber, TaxID, CompanyAddress, ContactPerson, PhoneNumber || '', Email, passwordHash]
    );
    const vendor = result.rows[0];

    if (!vendor) {
      res.status(400).json({ ErrorMessage: 'Vendor registration failed.' });
      return;
    }

    res.json({
      VendorId: vendor.vendor_id,
      CompanyName: vendor.company_name,
      Email: vendor.email,
      Status: 'Pending Approval'
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred during vendor registration.' });
  }
});

// ─────────────────────────────────────────────
// 8. GET /api/Auth/me
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/me', (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }

  res.json({
    UserId: auth.sub,
    Email: auth.email,
    Role: auth.role,
    CanonicalRoleKey: auth.CanonicalRoleKey || auth.role
  });
});

// ─────────────────────────────────────────────
// 9. POST /api/Auth/logout (vendor)
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('vendorAuthToken');
  res.json({ Status: 'Success' });
});

// ─────────────────────────────────────────────
// 10. GET /api/Auth/internal/users
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/users', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT * FROM identity.get_internal_users()');
    res.json(result.rows.map((row) => ({
      ...mapRow(row),
      CanonicalRoleKey: toCanonicalRoleKey((row.role_name as string) ?? '')
    })));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching users.' });
  }
});

// ─────────────────────────────────────────────
// 11. PUT /api/Auth/internal/users/:internalUserId
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/users/:internalUserId', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId } = req.params;
  const { Username, FirstName, MiddleName, Surname, ServiceNumber, Email, Role, UnitId, Status } = req.body;

  try {
    const isActive = Status === 'Active';
    const result = await pool!.query(
      'SELECT * FROM identity.update_internal_user($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        internalUserId,
        Email || '',
        Username || '',
        FirstName || '',
        MiddleName || '',
        Surname || '',
        ServiceNumber || '',
        UnitId || null,
        isActive
      ]
    );
    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ ErrorMessage: 'User not found or update failed.' });
      return;
    }

    if (Status) {
      await pool!.query(
        'SELECT * FROM identity.update_internal_user_status($1, $2, $3)',
        [internalUserId, Status, auth.sub]
      );
    }

    res.json(mapRow(user));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating user.' });
  }
});

// ─────────────────────────────────────────────
// 12. PUT /api/Auth/internal/users/:internalUserId/role
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/users/:internalUserId/role', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId } = req.params;
  const { RoleName } = req.body;

  if (!RoleName) {
    res.status(400).json({ ErrorMessage: 'RoleName is required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.update_internal_user_role($1, $2)',
      [internalUserId, RoleName]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating user role.' });
  }
});

// ─────────────────────────────────────────────
// 13. PUT /api/Auth/internal/users/:internalUserId/status
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/users/:internalUserId/status', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId } = req.params;
  const { Status } = req.body;

  if (!Status) {
    res.status(400).json({ ErrorMessage: 'Status is required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.update_internal_user_status($1, $2, $3)',
      [internalUserId, Status, auth.sub]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating user status.' });
  }
});

// ─────────────────────────────────────────────
// 14. DELETE /api/Auth/internal/users/:internalUserId
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/internal/users/:internalUserId', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId } = req.params;

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.update_internal_user_status($1, $2, $3)',
      [internalUserId, 'Inactive', auth.sub]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deactivating user.' });
  }
});

// ─────────────────────────────────────────────
// 15. POST /api/Auth/internal/users/:internalUserId/reset-password
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/internal/users/:internalUserId/reset-password', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId } = req.params;
  const { NewPassword, RequireChange } = req.body;

  if (!NewPassword) {
    res.status(400).json({ ErrorMessage: 'NewPassword is required.' });
    return;
  }

  try {
    const passwordHash = await hashPassword(NewPassword);
    const result = await pool!.query(
      'SELECT * FROM identity.admin_reset_password($1, $2, $3, $4)',
      [internalUserId, passwordHash, auth.sub, RequireChange === true]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred resetting password.' });
  }
});

// ─────────────────────────────────────────────
// 16. GET /api/Auth/internal/units
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/units', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT * FROM identity.organizational_units ORDER BY unit_name');
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching units.' });
  }
});

// ─────────────────────────────────────────────
// 17. POST /api/Auth/internal/units
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/internal/units', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { UnitId, UnitName, ParentUnitId } = req.body;

  if (!UnitName) {
    res.status(400).json({ ErrorMessage: 'UnitName is required.' });
    return;
  }

  try {
    let result;
    if (UnitId) {
      result = await pool!.query(
        'UPDATE identity.organizational_units SET unit_name = $1, parent_unit_id = $2 WHERE unit_id = $3 RETURNING *',
        [UnitName, ParentUnitId || null, UnitId]
      );
    } else {
      result = await pool!.query(
        'INSERT INTO identity.organizational_units (unit_name, parent_unit_id) VALUES ($1, $2) RETURNING *',
        [UnitName, ParentUnitId || null]
      );
    }

    if (!result.rows[0]) {
      res.status(400).json({ ErrorMessage: 'Failed to save unit.' });
      return;
    }

    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred saving unit.' });
  }
});

// ─────────────────────────────────────────────
// 18. GET /api/Auth/internal/units/:unitId/staff
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/units/:unitId/staff', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { unitId } = req.params;

  try {
    const result = await pool!.query(
      "SELECT * FROM identity.internal_users WHERE unit_id = $1 AND status = 'Active' ORDER BY surname, first_name",
      [unitId]
    );
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching unit staff.' });
  }
});

// ─────────────────────────────────────────────
// 19. GET /api/Auth/internal/modules
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/modules', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query(
      'SELECT grm.*, im."group" AS "Group", im.sub_section AS "SubSection" FROM identity.get_role_modules($1) grm JOIN identity.internal_modules im ON im.module_id = grm.module_id',
      [auth.role]
    );
    res.json(result.rows.map((row) => withModuleDataset(mapRow(row))));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching modules.' });
  }
});

// ─────────────────────────────────────────────
// 20. GET /api/Auth/internal/modules/catalog
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/modules/catalog', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT *, "group" AS "Group", sub_section AS "SubSection" FROM identity.internal_modules WHERE is_active = true ORDER BY title');
    res.json(result.rows.map((row) => withModuleDataset(mapRow(row))));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching module catalog.' });
  }
});

// ─────────────────────────────────────────────
// 21. GET /api/Auth/roles
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/roles', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT *, "group" AS "Group" FROM identity.roles WHERE is_active = true ORDER BY role_name');
    res.json(result.rows.map((row) => ({
      ...mapRow(row),
      CanonicalRoleKey: toCanonicalRoleKey((row.role_name as string) ?? '')
    })));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching roles.' });
  }
});

// ─────────────────────────────────────────────
// 22. GET /api/Auth/roles/:roleId
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/roles/:roleId', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { roleId } = req.params;

  try {
    const result = await pool!.query('SELECT *, "group" AS "Group" FROM identity.roles WHERE role_id = $1', [roleId]);
    if (!result.rows[0]) {
      res.status(404).json({ ErrorMessage: 'Role not found.' });
      return;
    }
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching role.' });
  }
});

// ─────────────────────────────────────────────
// 23. POST /api/Auth/roles
// ─────────────────────────────────────────────
authRouter.post('/api/Auth/roles', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { RoleName, Description, Group } = req.body;
  if (!RoleName) {
    res.status(400).json({ ErrorMessage: 'RoleName is required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'INSERT INTO identity.roles (role_name, description, "group") VALUES ($1, $2, $3) RETURNING *, "group" AS "Group"',
      [RoleName, Description || '', Group || 'procurement_staff']
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred creating role.' });
  }
});

// ─────────────────────────────────────────────
// 24. PUT /api/Auth/roles/:roleId
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/roles/:roleId', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { roleId } = req.params;
  const { RoleName, Description, IsActive, Group } = req.body;

  try {
    const result = await pool!.query(
      'UPDATE identity.roles SET role_name = $1, description = $2, is_active = $3, "group" = $4 WHERE role_id = $5 RETURNING *, "group" AS "Group"',
      [RoleName || '', Description || '', IsActive !== undefined ? IsActive : true, Group || 'procurement_staff', roleId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ ErrorMessage: 'Role not found or update failed.' });
      return;
    }
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating role.' });
  }
});

// ─────────────────────────────────────────────
// 25. DELETE /api/Auth/roles/:roleId
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/roles/:roleId', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { roleId } = req.params;

  try {
    const result = await pool!.query('SELECT * FROM identity.deactivate_role($1)', [roleId]);
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred deactivating role.' });
  }
});

// ─────────────────────────────────────────────
// 26. GET /api/Auth/roles/:roleId/users
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/roles/:roleId/users', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { roleId } = req.params;

  try {
    const rolesResult = await pool!.query('SELECT * FROM identity.get_roles() WHERE role_id = $1', [roleId]);
    const role = rolesResult.rows[0];
    if (!role) {
      res.status(404).json({ ErrorMessage: 'Role not found.' });
      return;
    }

    const result = await pool!.query(
      "SELECT * FROM identity.internal_users WHERE lower(role) = lower($1) AND status = 'Active' ORDER BY surname, first_name",
      [role.role_name]
    );
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching role users.' });
  }
});

// ─────────────────────────────────────────────
// 27. GET /api/Auth/internal/module-access/roles
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/module-access/roles', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT * FROM identity.get_role_module_grants()');
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching role module grants.' });
  }
});

// ─────────────────────────────────────────────
// 28. PUT /api/Auth/internal/module-access/roles
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/module-access/roles', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { RoleName, ModuleId, IsEnabled, GrantedBy } = req.body;
  if (!RoleName || !ModuleId) {
    res.status(400).json({ ErrorMessage: 'RoleName and ModuleId are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.upsert_role_module_grant($1, $2, $3, $4)',
      [RoleName, ModuleId, IsEnabled !== undefined ? IsEnabled : true, GrantedBy || auth.sub]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred upserting role module grant.' });
  }
});

// ─────────────────────────────────────────────
// 29. DELETE /api/Auth/internal/module-access/roles
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/internal/module-access/roles', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { roleName, moduleId } = req.query;
  if (!roleName || !moduleId) {
    res.status(400).json({ ErrorMessage: 'roleName and moduleId query params are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.upsert_role_module_grant($1, $2, $3, $4)',
      [roleName, moduleId, false, auth.sub]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred disabling role module grant.' });
  }
});

// ─────────────────────────────────────────────
// 30. PUT /api/Auth/internal/module-access/roles/bulk
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/module-access/roles/bulk', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { Grants } = req.body;
  if (!Array.isArray(Grants)) {
    res.status(400).json({ ErrorMessage: 'Grants array is required.' });
    return;
  }

  try {
    const results = [];
    for (const grant of Grants) {
      const result = await pool!.query(
        'SELECT * FROM identity.upsert_role_module_grant($1, $2, $3, $4)',
        [grant.RoleName, grant.ModuleId, grant.IsEnabled !== undefined ? grant.IsEnabled : true, auth.sub]
      );
      results.push(mapRow(result.rows[0]));
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred in bulk upsert.' });
  }
});

// ─────────────────────────────────────────────
// 31. DELETE /api/Auth/internal/module-access/roles/bulk
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/internal/module-access/roles/bulk', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { RoleName } = req.body;
  if (!RoleName) {
    res.status(400).json({ ErrorMessage: 'RoleName is required.' });
    return;
  }

  try {
    const grants = await pool!.query('SELECT * FROM identity.get_role_module_grants() WHERE lower(role_name) = lower($1)', [RoleName]);
    const results = [];
    for (const grant of grants.rows) {
      const result = await pool!.query(
        'SELECT * FROM identity.upsert_role_module_grant($1, $2, $3, $4)',
        [RoleName, grant.module_id, false, auth.sub]
      );
      results.push(mapRow(result.rows[0]));
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred disabling all role module grants.' });
  }
});

// ─────────────────────────────────────────────
// 32. GET /api/Auth/internal/module-access/users
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/module-access/users', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT * FROM identity.get_user_module_grants()');
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching user module grants.' });
  }
});

// ─────────────────────────────────────────────
// 33. PUT /api/Auth/internal/module-access/users
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/module-access/users', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { InternalUserId, ModuleId, IsEnabled, GrantedBy, Reason, OverrideExpiry } = req.body;
  if (!InternalUserId || !ModuleId) {
    res.status(400).json({ ErrorMessage: 'InternalUserId and ModuleId are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.upsert_user_module_grant($1, $2, $3, $4, $5, $6)',
      [
        InternalUserId,
        ModuleId,
        IsEnabled !== undefined ? IsEnabled : true,
        GrantedBy || auth.sub,
        Reason || '',
        OverrideExpiry || null
      ]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred upserting user module grant.' });
  }
});

// ─────────────────────────────────────────────
// 34. DELETE /api/Auth/internal/module-access/users
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/internal/module-access/users', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { internalUserId, moduleId } = req.query;
  if (!internalUserId || !moduleId) {
    res.status(400).json({ ErrorMessage: 'internalUserId and moduleId query params are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      'SELECT * FROM identity.upsert_user_module_grant($1, $2, $3, $4, $5, $6)',
      [internalUserId, moduleId, false, auth.sub, '', null]
    );
    res.json(mapRow(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred disabling user module grant.' });
  }
});

// ─────────────────────────────────────────────
// 35. PUT /api/Auth/internal/module-access/users/bulk
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/module-access/users/bulk', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { Grants } = req.body;
  if (!Array.isArray(Grants)) {
    res.status(400).json({ ErrorMessage: 'Grants array is required.' });
    return;
  }

  try {
    const results = [];
    for (const grant of Grants) {
      const result = await pool!.query(
        'SELECT * FROM identity.upsert_user_module_grant($1, $2, $3, $4, $5, $6)',
        [
          grant.InternalUserId,
          grant.ModuleId,
          grant.IsEnabled !== undefined ? grant.IsEnabled : true,
          auth.sub,
          grant.Reason || '',
          grant.OverrideExpiry || null
        ]
      );
      results.push(mapRow(result.rows[0]));
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred in bulk user grant upsert.' });
  }
});

// ─────────────────────────────────────────────
// 36. DELETE /api/Auth/internal/module-access/users/bulk
// ─────────────────────────────────────────────
authRouter.delete('/api/Auth/internal/module-access/users/bulk', async (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!requireDb(res)) return;

  const { InternalUserId } = req.body;
  if (!InternalUserId) {
    res.status(400).json({ ErrorMessage: 'InternalUserId is required.' });
    return;
  }

  try {
    const grants = await pool!.query(
      'SELECT * FROM identity.get_user_module_grants() WHERE lower(internal_user_id) = lower($1)',
      [InternalUserId]
    );
    const results = [];
    for (const grant of grants.rows) {
      const result = await pool!.query(
        'SELECT * FROM identity.upsert_user_module_grant($1, $2, $3, $4, $5, $6)',
        [InternalUserId, grant.module_id, false, auth.sub, '', null]
      );
      results.push(mapRow(result.rows[0]));
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred disabling all user module grants.' });
  }
});

// ─────────────────────────────────────────────
// 37. GET /api/Auth/internal/module-access/audit
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/module-access/audit', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { roleName, internalUserId, limit } = req.query;

  try {
    let query = 'SELECT * FROM identity.internal_module_grant_audit';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (roleName) {
      conditions.push(`lower(role_name) = lower($${idx++})`);
      params.push(roleName);
    }
    if (internalUserId) {
      conditions.push(`lower(internal_user_id) = lower($${idx++})`);
      params.push(internalUserId);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY changed_at DESC';
    if (limit) {
      query += ` LIMIT $${idx++}`;
      params.push(Number(limit));
    }

    const result = await pool!.query(query, params);
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching module access audit.' });
  }
});

// ─────────────────────────────────────────────
// 38. GET /api/Auth/internal/user-role/audit
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/user-role/audit', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { internalUserId, roleName, limit } = req.query;

  try {
    let query = 'SELECT * FROM identity.role_audit';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (internalUserId) {
      conditions.push(`lower(internal_user_id) = lower($${idx++})`);
      params.push(internalUserId);
    }
    if (roleName) {
      conditions.push(`lower(role_name) = lower($${idx++})`);
      params.push(roleName);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY changed_at DESC';
    if (limit) {
      query += ` LIMIT $${idx++}`;
      params.push(Number(limit));
    }

    const result = await pool!.query(query, params);
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching role audit.' });
  }
});

// ─────────────────────────────────────────────
// 39. GET /api/Auth/internal/notifications
// ─────────────────────────────────────────────
authRouter.get('/api/Auth/internal/notifications', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query('SELECT * FROM identity.get_internal_notifications_sp($1)', [auth.sub]);
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching notifications.' });
  }
});

// ─────────────────────────────────────────────
// 39b. GET /api/notifications
// ─────────────────────────────────────────────
authRouter.get('/api/notifications', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;
  try {
    const result = await pool!.query('SELECT * FROM identity.get_internal_notifications_sp($1)', [auth.sub]);
    res.json(result.rows.map(mapRow));
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching notifications.' });
  }
});

// ─────────────────────────────────────────────
// 40. PUT /api/Auth/internal/notifications/:notificationId/read
// ─────────────────────────────────────────────
authRouter.put('/api/Auth/internal/notifications/:notificationId/read', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const { notificationId } = req.params;

  try {
    await pool!.query(
      'UPDATE identity.internal_notifications SET is_read = true, read_at = NOW() WHERE notification_id = $1 AND recipient_user_id = $2',
      [notificationId, auth.sub]
    );
    res.json({ Status: 'Success' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred marking notification as read.' });
  }
});

// ─────────────────────────────────────────────
// 41. RBAC PERMISSIONS
// ─────────────────────────────────────────────

authRouter.get('/api/Auth/internal/permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  try {
    const result = await pool!.query(
      `SELECT permission_key as "PermissionKey", module as "Module", action as "Action", description as "Description"
       FROM identity.get_role_permissions($1)
       ORDER BY module, action`,
      [auth.role]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error fetching permissions.' });
  }
});

authRouter.get('/api/Auth/internal/permissions/check', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const permissionKey = req.query.permissionKey as string;
  if (!permissionKey) {
    res.status(400).json({ ErrorMessage: 'permissionKey query parameter is required.' });
    return;
  }

  try {
    const result = await pool!.query(
      `SELECT identity.role_has_permission($1, $2) as has_permission`,
      [auth.role, permissionKey]
    );
    const hasPermission = result.rows[0]?.has_permission ?? false;
    res.json({ PermissionKey: permissionKey, HasPermission: hasPermission });
  } catch (err: any) {
    console.error('Error checking permission:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error checking permission.' });
  }
});

authRouter.get('/api/Auth/internal/permissions/all', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const roleLower = auth.role.toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'ict_admin' || roleLower === 'system_administrator';
  if (!isAdmin) {
    res.status(403).json({ ErrorMessage: 'Forbidden: admin access required.' });
    return;
  }

  try {
    const result = await pool!.query(
      `SELECT permission_key as "PermissionKey", module as "Module", action as "Action",
              description as "Description", is_active as "IsActive"
       FROM identity.permissions
       ORDER BY module, action`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching all permissions:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error fetching all permissions.' });
  }
});

authRouter.get('/api/Auth/internal/role-permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const roleLower = auth.role.toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'ict_admin' || roleLower === 'system_administrator';
  const roleName = req.query.roleName as string | undefined;

  if (!isAdmin && !roleName) {
    res.status(403).json({ ErrorMessage: 'Forbidden: admin access required.' });
    return;
  }

  try {
    let query: string;
    let params: unknown[];

    if (roleName) {
      query = `SELECT role_name as "RoleName", permission_key as "PermissionKey", module as "Module",
                      action as "Action", permission_description as "Description", is_enabled as "IsEnabled"
               FROM identity.v_role_permissions
               WHERE role_name = $1
               ORDER BY module, action`;
      params = [roleName];
    } else {
      query = `SELECT role_name as "RoleName", permission_key as "PermissionKey", module as "Module",
                      action as "Action", permission_description as "Description", is_enabled as "IsEnabled"
               FROM identity.v_role_permissions
               ORDER BY role_name, module, action`;
      params = [];
    }

    const result = await pool!.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching role permissions:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error fetching role permissions.' });
  }
});

authRouter.put('/api/Auth/internal/role-permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const roleLower = auth.role.toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'ict_admin' || roleLower === 'system_administrator';
  if (!isAdmin) {
    res.status(403).json({ ErrorMessage: 'Forbidden: admin access required.' });
    return;
  }

  const { roleName, permissionKey, isEnabled = true } = req.body;
  if (!roleName || !permissionKey) {
    res.status(400).json({ ErrorMessage: 'roleName and permissionKey are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      `INSERT INTO identity.role_permissions (role_id, permission_id, is_enabled)
       SELECT r.role_id, p.permission_id, $3
       FROM identity.roles r, identity.permissions p
       WHERE r.role_name = $1 AND p.permission_key = $2
       ON CONFLICT (role_id, permission_id) DO UPDATE SET is_enabled = $3`,
      [roleName, permissionKey, isEnabled]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ErrorMessage: 'Role or permission not found.' });
    } else {
      res.json({ Message: 'Permission updated.' });
    }
  } catch (err: any) {
    console.error('Error upserting role permission:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error updating role permission.' });
  }
});

authRouter.delete('/api/Auth/internal/role-permissions', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  if (!auth) { res.status(401).json({ ErrorMessage: 'Unauthorized.' }); return; }
  if (!requireDb(res)) return;

  const roleLower = auth.role.toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'ict_admin' || roleLower === 'system_administrator';
  if (!isAdmin) {
    res.status(403).json({ ErrorMessage: 'Forbidden: admin access required.' });
    return;
  }

  const { roleName, permissionKey } = req.body;
  if (!roleName || !permissionKey) {
    res.status(400).json({ ErrorMessage: 'roleName and permissionKey are required.' });
    return;
  }

  try {
    const result = await pool!.query(
      `DELETE FROM identity.role_permissions
       WHERE role_id = (SELECT role_id FROM identity.roles WHERE role_name = $1)
         AND permission_id = (SELECT permission_id FROM identity.permissions WHERE permission_key = $2)`,
      [roleName, permissionKey]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ErrorMessage: 'Role or permission not found.' });
    } else {
      res.json({ Message: 'Permission removed.' });
    }
  } catch (err: any) {
    console.error('Error deleting role permission:', err);
    res.status(500).json({ ErrorMessage: err.message || 'Internal server error deleting role permission.' });
  }
});
