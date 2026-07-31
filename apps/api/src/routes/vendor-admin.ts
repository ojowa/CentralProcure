import { Router } from 'express';
import { pool } from '../db.js';
import { extractPayloadFromRequest } from '../lib/jwt.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const vendorAdminRouter = Router();

// GET /api/admin/vendors/registrations
vendorAdminRouter.get('/api/admin/vendors/registrations', async (req, res) => {
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
    const Status = (req.query.Status ?? req.query.status) as string | undefined;
    const Query = (req.query.Query ?? req.query.query) as string | undefined;
    const Page = (req.query.Page ?? req.query.page) as string | undefined;
    const PageSize = (req.query.PageSize ?? req.query.pageSize) as string | undefined;
    const pageNum = Math.max(1, parseInt(Page as string, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(PageSize as string, 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (Status) {
      conditions.push(`v.vendor_status = $${paramIndex}`);
      values.push(Status);
      paramIndex++;
    }
    if (Query) {
      conditions.push(`(v.company_name ILIKE $${paramIndex} OR v.email ILIKE $${paramIndex} OR v.registration_number ILIKE $${paramIndex})`);
      values.push(`%${Query}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM identity.vendors v ${whereClause}`,
      values
    );

    const result = await pool.query(
      `SELECT
        v.vendor_id AS "VendorId",
        v.company_name AS "CompanyName",
        v.email AS "Email",
        v.registration_number AS "RegistrationNumber",
        v.tax_id AS "TaxId",
        v.company_address AS "CompanyAddress",
        v.contact_person AS "ContactPerson",
        v.phone_number AS "PhoneNumber",
        v.vendor_status AS "Status",
        v.created_at AS "CreatedAt",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "TotalDocuments",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Approved') AS "ApprovedDocuments",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Pending') AS "PendingDocuments"
      FROM identity.vendors v
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSizeNum, offset]
    );

    res.json({
      Items: result.rows,
      TotalCount: parseInt(countResult.rows[0].total, 10),
      Page: pageNum,
      PageSize: pageSizeNum,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching registrations.' });
  }
});

// GET /api/admin/vendors/:vendorId
vendorAdminRouter.get('/api/admin/vendors/:vendorId', async (req, res) => {
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
    const { vendorId } = req.params;

    const result = await pool.query(
      `SELECT
        v.vendor_id AS "VendorId",
        v.company_name AS "CompanyName",
        v.email AS "Email",
        v.registration_number AS "RegistrationNumber",
        v.tax_id AS "TaxId",
        v.company_address AS "CompanyAddress",
        v.contact_person AS "ContactPerson",
        v.phone_number AS "PhoneNumber",
        v.vendor_status AS "Status",
        v.created_at AS "CreatedAt",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "TotalDocuments",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Approved') AS "ApprovedDocuments",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Pending') AS "PendingDocuments",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Rejected') AS "RejectedDocuments"
      FROM identity.vendors v
      WHERE v.vendor_id = $1`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Vendor not found.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred fetching vendor details.' });
  }
});

// POST /api/admin/vendors/:vendorId/decision
vendorAdminRouter.post('/api/admin/vendors/:vendorId/decision', async (req, res) => {
  const auth = await requirePermission(req, 'admin.vendor_approval');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { vendorId } = req.params;
    const { Decision, RejectionReason } = req.body;

    if (!Decision) {
      res.status(400).json({ ErrorMessage: 'Decision is required (Approved or Rejected).' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM identity.approve_vendor_registration($1, $2, $3, $4)',
      [vendorId, Decision, auth!.sub, RejectionReason || '']
    );

    const updatedVendor = await pool.query(
      `SELECT vendor_id, company_name, vendor_status, updated_at
       FROM identity.vendors WHERE vendor_id = $1`,
      [vendorId]
    );

    if (updatedVendor.rows.length === 0) {
      res.status(400).json({ ErrorMessage: 'Decision processing failed.' });
      return;
    }

    const v = updatedVendor.rows[0];

    res.json({
      VendorId: v.vendor_id,
      Status: v.vendor_status,
      Decision: Decision,
      ReviewedAt: v.updated_at,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the decision.' });
  }
});

// GET /api/admin/vendors/compliance/:documentId/file
vendorAdminRouter.get('/api/admin/vendors/compliance/:documentId/file', async (req, res) => {
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
