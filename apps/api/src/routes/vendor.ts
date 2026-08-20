import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { TokenPayload } from '../lib/jwt.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';

export const vendorRouter = Router();

// GET /api/Vendor/availability
vendorRouter.get('/api/Vendor/availability', async (req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { Email, RegistrationNumber, TaxId } = req.query;

    if (!Email && !RegistrationNumber && !TaxId) {
      res.status(400).json({ ErrorMessage: 'At least one of Email, RegistrationNumber, or TaxId must be provided.' });
      return;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Email) {
      conditions.push(`email = $${paramIndex}`);
      values.push(Email);
      paramIndex++;
    }
    if (RegistrationNumber) {
      conditions.push(`registration_number = $${paramIndex}`);
      values.push(RegistrationNumber);
      paramIndex++;
    }
    if (TaxId) {
      conditions.push(`tax_id = $${paramIndex}`);
      values.push(TaxId);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT email, registration_number, tax_id FROM identity.vendors WHERE ${conditions.join(' OR ')}`,
      values
    );

    const emailTaken = Email ? result.rows.some((r) => r.email === Email) : false;
    const regNumberTaken = RegistrationNumber ? result.rows.some((r) => r.registration_number === RegistrationNumber) : false;
    const taxIdTaken = TaxId ? result.rows.some((r) => r.tax_id === TaxId) : false;

    res.json({
      EmailAvailable: !emailTaken,
      RegistrationNumberAvailable: !regNumberTaken,
      TaxIdAvailable: !taxIdTaken,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred checking availability.' });
  }
});

// GET /api/Vendor/compliance
vendorRouter.get('/api/Vendor/compliance', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT * FROM identity.get_vendor_compliance_documents($1)',
      [auth.sub]
    );

    const documents = result.rows.map((d) => ({
      DocumentId: d.document_id,
      DocumentType: d.document_type,
      FileUrl: d.document_url,
      FileName: d.file_name || null,
      Status: d.verification_status,
      ExpiryDate: d.expiry_date,
      CreatedAt: d.created_at,
      RejectionReason: d.rejection_reason || null,
    }));

    res.json({ Items: documents });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching compliance documents.' });
  }
});

// GET /api/Vendor/compliance/requirements
vendorRouter.get('/api/Vendor/compliance/requirements', async (_req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM identity.get_compliance_document_types()');
    const items = result.rows.map((r) => ({
      Id: r.document_type_key,
      Name: r.document_type,
      Required: r.is_mandatory,
      Frequency: r.frequency,
      Expirable: r.expirable,
      Description: r.description,
    }));
    res.json({ Items: items });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching compliance requirements.' });
  }
});

// GET /api/Vendor/compliance/history/:documentType
vendorRouter.get('/api/Vendor/compliance/history/:documentType', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { documentType } = req.params;
    const result = await pool.query(
      'SELECT * FROM identity.get_vendor_compliance_document_history($1, $2)',
      [auth.sub, documentType]
    );

    const history = result.rows.map((h) => ({
      HistoryId: h.history_id,
      DocumentId: h.document_id,
      DocumentType: h.document_type,
      DocumentUrl: h.document_url,
      FileUrl: h.document_url,
      FileName: h.file_name,
      ExpiryDate: h.expiry_date,
      Status: h.verification_status,
      CreatedAt: h.created_at,
      RejectionReason: h.rejection_reason,
      VerifiedBy: h.verified_by,
      VerifiedAt: h.verified_at,
    }));

    res.json({ Items: history });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching document history.' });
  }
});

// GET /api/Vendor/compliance/checklist
vendorRouter.get('/api/Vendor/compliance/checklist', async (_req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM identity.get_compliance_document_types()');
    const items = result.rows.map((r) => ({
      DocumentType: r.document_type,
      Description: r.description,
      IsMandatory: r.is_mandatory,
    }));

    res.json({ Items: items, GeneratedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred generating the checklist.' });
  }
});

// POST /api/Vendor/compliance/upload
vendorRouter.post('/api/Vendor/compliance/upload', async (req, res) => {
  const auth = extractPayloadFromRequest(req.headers.authorization);
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { DocumentType, FileName, FileContent, ExpiryDate } = req.body;

    if (!DocumentType || !FileName) {
      res.status(400).json({ ErrorMessage: 'DocumentType and FileName are required.' });
      return;
    }

    const documentUrl = `uploads/compliance/${auth!.sub}_${Date.now()}_${FileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const result = await pool.query(
      'SELECT * FROM identity.upload_compliance_document($1, $2, $3, $4, $5, $6)',
      [auth!.sub, DocumentType, documentUrl, ExpiryDate || null, FileName, FileContent || null]
    );

    const doc = result.rows[0];

    if (!doc || doc.error_message) {
      res.status(400).json({ ErrorMessage: doc?.error_message || 'Upload failed.' });
      return;
    }

    res.json({
      DocumentId: doc.document_id,
      DocumentType: doc.document_type,
      FileUrl: doc.document_url,
      FileName: doc.file_name,
      Status: doc.verification_status,
      CreatedAt: doc.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred uploading document.' });
  }
});

// GET /api/Vendor/compliance/:documentId/file
vendorRouter.get('/api/Vendor/compliance/:documentId/file', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { documentId } = req.params;
    const result = await pool.query(
      'SELECT document_url, file_name, document_content, vendor_id FROM identity.compliance_documents WHERE document_id = $1',
      [documentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Document not found.' });
      return;
    }

    const doc = result.rows[0];
    if (doc.vendor_id !== auth.sub) {
      res.status(403).json({ ErrorMessage: 'Access denied.' });
      return;
    }

    let fileName = doc.file_name || doc.document_url?.split('/').pop() || 'compliance-document';
    if (!fileName.endsWith('.pdf')) {
      fileName = `${fileName}.pdf`;
    }

    if (doc.document_content) {
      const buffer = Buffer.from(doc.document_content, 'base64');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(buffer);
      return;
    }

    res.json({
      DocumentUrl: doc.document_url,
      FileName: fileName,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching document file.' });
  }
});

// GET /api/Vendor/:vendorId
vendorRouter.get('/api/Vendor/:vendorId', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;

    if (auth.sub !== vendorId && auth.VendorId !== vendorId) {
      res.status(403).json({ ErrorMessage: 'Forbidden: cannot view another vendor profile.' });
      return;
    }

    const result = await pool.query('SELECT * FROM identity.get_vendor_profile($1)', [vendorId]);

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Vendor not found.' });
      return;
    }

    const v = result.rows[0];
    res.json({
      VendorId: v.vendor_id,
      CompanyName: v.company_name,
      Email: v.email,
      RegistrationNumber: v.registration_number,
      TaxId: v.tax_id,
      CompanyAddress: v.company_address,
      ContactPerson: v.contact_person,
      PhoneNumber: v.phone_number,
      VendorStatus: v.vendor_status,
      LastLogin: v.last_login,
      RegistrationDate: v.registration_date,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching vendor profile.' });
  }
});

const vendorProfileUpdateSchema = z.object({
  CompanyName: z.string().min(1, 'Company name is required.').max(256).optional(),
  CompanyAddress: z.string().max(512).optional(),
  ContactPerson: z.string().max(128).optional(),
  PhoneNumber: z.string().regex(/^\+?[0-9 ()-]{7,20}$/, 'Invalid phone number format.').optional().or(z.literal('')),
  Email: z.string().email('Invalid email address.').max(256).optional(),
});

// PUT /api/Vendor/:vendorId
vendorRouter.put('/api/Vendor/:vendorId', async (req, res) => {
  const auth = extractPayloadFromRequest(req.headers.authorization);
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;

    if (auth!.sub !== vendorId && auth!.VendorId !== vendorId) {
      res.status(403).json({ ErrorMessage: 'Forbidden: cannot update another vendor profile.' });
      return;
    }

    const parsed = vendorProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join('; ');
      res.status(400).json({ ErrorMessage: message });
      return;
    }

    const { CompanyName, CompanyAddress, ContactPerson, PhoneNumber, Email } = parsed.data;

    if (Email) {
      const existing = await pool.query(
        'SELECT vendor_id FROM identity.vendors WHERE lower(email) = lower($1) AND vendor_id != $2',
        [Email, vendorId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ ErrorMessage: 'Email address is already registered.' });
        return;
      }
    }

    const result = await pool.query(
      'SELECT * FROM identity.update_vendor_profile($1, $2, $3, $4, $5, $6)',
      [
        vendorId,
        CompanyName ?? null,
        CompanyAddress ?? null,
        ContactPerson ?? null,
        PhoneNumber ?? null,
        Email ?? null
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Vendor not found or update failed.' });
      return;
    }

    const v = result.rows[0];
    res.json({
      VendorId: v.vendor_id,
      CompanyName: v.company_name,
      Email: v.email,
      RegistrationNumber: v.registration_number,
      TaxId: v.tax_id,
      CompanyAddress: v.company_address,
      ContactPerson: v.contact_person,
      PhoneNumber: v.phone_number,
      VendorStatus: v.vendor_status,
      LastLogin: v.last_login,
      RegistrationDate: v.registration_date,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ ErrorMessage: 'Email address is already registered.' });
      return;
    }
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating vendor profile.' });
  }
});

const changePasswordSchema = z.object({
  CurrentPassword: z.string().min(1, 'Current password is required.'),
  NewPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});

// PUT /api/Vendor/:vendorId/password
vendorRouter.put('/api/Vendor/:vendorId/password', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth?.sub) {
    res.status(401).json({ ErrorMessage: 'Unauthorized.' });
    return;
  }

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;

    if (auth.sub !== vendorId && auth.VendorId !== vendorId) {
      res.status(403).json({ ErrorMessage: 'Forbidden: cannot change another vendor password.' });
      return;
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join('; ');
      res.status(400).json({ ErrorMessage: message });
      return;
    }

    const { CurrentPassword, NewPassword } = parsed.data;

    const vendorResult = await pool.query(
      'SELECT vendor_id, password_hash FROM identity.vendors WHERE vendor_id = $1',
      [vendorId]
    );

    if (vendorResult.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Vendor not found.' });
      return;
    }

    const vendor = vendorResult.rows[0];
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.default.compare(CurrentPassword, vendor.password_hash);
    if (!isValid) {
      res.status(401).json({ ErrorMessage: 'Current password is incorrect.' });
      return;
    }

    const newHash = await bcrypt.default.hash(NewPassword, 10);
    await pool.query(
      'UPDATE identity.vendors SET password_hash = $1 WHERE vendor_id = $2',
      [newHash, vendorId]
    );

    res.json({ Message: 'Password updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred changing password.' });
  }
});
