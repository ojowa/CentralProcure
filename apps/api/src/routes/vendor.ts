import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

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

// GET /api/Vendor/:vendorId
vendorRouter.get('/api/Vendor/:vendorId', async (req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;
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
      Status: v.vendor_status,
      CreatedAt: v.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching vendor profile.' });
  }
});

// PUT /api/Vendor/:vendorId
vendorRouter.put('/api/Vendor/:vendorId', async (req, res) => {
  const auth = await requirePermission(req, 'vendor.update');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;
    const { CompanyName, CompanyAddress, ContactPerson, PhoneNumber, Email, TaxId } = req.body;

    const result = await pool.query(
      'SELECT * FROM identity.update_vendor_profile($1, $2, $3, $4, $5, $6)',
      [vendorId, CompanyName || '', CompanyAddress || '', ContactPerson || '', PhoneNumber || '', TaxId || '']
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
      Status: v.vendor_status,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred updating vendor profile.' });
  }
});

// GET /api/Vendor/compliance
vendorRouter.get('/api/Vendor/compliance', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
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
      [payload.sub]
    );

    const documents = result.rows.map((d) => ({
      DocumentId: d.document_id,
      DocumentType: d.document_type,
      FileName: d.document_url,
      Status: d.verification_status,
      UploadedAt: d.created_at,
      ReviewedAt: d.verified_at,
      RejectionReason: null,
    }));

    res.json({ Items: documents });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching compliance documents.' });
  }
});

// GET /api/Vendor/compliance/requirements
vendorRouter.get('/api/Vendor/compliance/requirements', (_req, res) => {
  res.json({ Items: [
    { DocumentType: 'CAC Certificate', Description: 'Certificate of Incorporation from the Corporate Affairs Commission', IsMandatory: true },
    { DocumentType: 'Tax Clearance', Description: 'Tax clearance certificate from the Federal Inland Revenue Service', IsMandatory: true },
    { DocumentType: 'PENCOM', Description: 'Pension clearance certificate from the National Pension Commission', IsMandatory: true },
    { DocumentType: 'ITF', Description: 'Industrial Training Fund compliance certificate', IsMandatory: true },
    { DocumentType: 'Company Profile', Description: 'Company profile with details of directors and organizational structure', IsMandatory: true },
    { DocumentType: 'Bank Reference', Description: 'Bank reference letter from the company\'s bank', IsMandatory: true },
    { DocumentType: 'Insurance Certificate', Description: 'Insurance certificate covering the company\'s operations', IsMandatory: true },
  ] });
});

// GET /api/Vendor/compliance/history/:documentType
vendorRouter.get('/api/Vendor/compliance/history/:documentType', async (req, res) => {
  const payload = extractPayloadFromRequest(req.headers.authorization);
  if (!payload || !payload.sub) {
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
      [payload.sub, documentType]
    );

    const history = result.rows.map((h) => ({
      DocumentId: h.document_id,
      DocumentType: h.document_type,
      FileName: h.document_url,
      Status: h.verification_status,
      UploadedAt: h.created_at,
      ReviewedAt: h.verified_at,
      RejectionReason: null,
    }));

    res.json({ Items: history });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching document history.' });
  }
});

// GET /api/Vendor/compliance/checklist
vendorRouter.get('/api/Vendor/compliance/checklist', (_req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.status(200).send(Buffer.from('PDF_PLACEHOLDER'));
});

// POST /api/Vendor/compliance/upload
vendorRouter.post('/api/Vendor/compliance/upload', async (req, res) => {
  const auth = await requirePermission(req, 'vendor.compliance_upload');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { DocumentType, FileName, FileContent } = req.body;

    if (!DocumentType || !FileName) {
      res.status(400).json({ ErrorMessage: 'DocumentType and FileName are required.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM identity.upload_compliance_document($1, $2, $3, $4)',
      [auth!.sub, DocumentType, FileName, FileContent || '']
    );

    const doc = result.rows[0];

    if (!doc || doc.error_message) {
      res.status(400).json({ ErrorMessage: doc?.error_message || 'Upload failed.' });
      return;
    }

    res.json({
      DocumentId: doc.document_id,
      DocumentType: doc.document_type,
      FileName: doc.document_url,
      Status: doc.verification_status,
      UploadedAt: doc.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred uploading document.' });
  }
});

// GET /api/Vendor/compliance/:documentId/file
vendorRouter.get('/api/Vendor/compliance/:documentId/file', async (req, res) => {
  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { documentId } = req.params;
    const result = await pool.query(
      'SELECT document_url, file_name FROM identity.compliance_documents WHERE document_id = $1',
      [documentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Document not found.' });
      return;
    }

    const doc = result.rows[0];
    res.json({
      DocumentUrl: doc.document_url,
      FileName: doc.file_name,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching document file.' });
  }
});
