import { Router } from 'express';
import { pool } from '../db.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission, denyIfNoPermission } from '../middleware/permission.js';

export const vendorAdminRouter = Router();

// GET /api/admin/vendors — alias for /api/admin/vendors/registrations
vendorAdminRouter.get('/api/admin/vendors', async (req, res) => {
  const auth = await requirePermission(req, 'admin.vendor_approval');
  if (denyIfNoPermission(res, auth)) return;

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
        v.vendor_status AS "VendorStatus",
        v.is_active AS "IsActive",
        v.created_at AS "RegistrationDate",
        v.updated_at AS "UpdatedAt",
        (SELECT MAX(cd.updated_at) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "LastComplianceUpdateAt",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "ComplianceDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Approved') AS "ApprovedDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Pending') AS "PendingDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Rejected') AS "RejectedDocumentsCount"
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

// GET /api/admin/vendors/registrations
vendorAdminRouter.get('/api/admin/vendors/registrations', async (req, res) => {
  const auth = await requirePermission(req, 'admin.vendor_approval');
  if (denyIfNoPermission(res, auth)) return;

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
        v.vendor_status AS "VendorStatus",
        v.is_active AS "IsActive",
        v.created_at AS "RegistrationDate",
        v.updated_at AS "UpdatedAt",
        (SELECT MAX(cd.updated_at) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "LastComplianceUpdateAt",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "ComplianceDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Approved') AS "ApprovedDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Pending') AS "PendingDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Rejected') AS "RejectedDocumentsCount"
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
  const auth = await requirePermission(req, 'admin.vendor_approval');
  if (denyIfNoPermission(res, auth)) return;

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
        v.vendor_status AS "VendorStatus",
        v.is_active AS "IsActive",
        v.created_at AS "RegistrationDate",
        v.last_login AS "LastLogin",
        v.updated_at AS "UpdatedAt",
        v.review_notes AS "ReviewNotes",
        (SELECT MAX(cd.updated_at) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "LastComplianceUpdateAt",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id) AS "ComplianceDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Approved') AS "ApprovedDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Pending') AS "PendingDocumentsCount",
        (SELECT COUNT(*) FROM identity.compliance_documents cd WHERE cd.vendor_id = v.vendor_id AND cd.verification_status = 'Rejected') AS "RejectedDocumentsCount"
      FROM identity.vendors v
      WHERE v.vendor_id = $1`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Vendor not found.' });
      return;
    }

    const documentsResult = await pool.query(
      `SELECT
        cd.document_id AS "DocumentId",
        cd.document_type AS "DocumentType",
        cd.verification_status AS "VerificationStatus",
        cd.expiry_date AS "ExpiryDate",
        cd.created_at AS "CreatedAt",
        cd.updated_at AS "UpdatedAt",
        cd.verified_by AS "VerifiedBy",
        cd.verified_at AS "VerifiedAt",
        cd.file_name AS "FileName",
        cd.document_url AS "FileUrl"
      FROM identity.compliance_documents cd
      WHERE cd.vendor_id = $1
      ORDER BY cd.created_at DESC`,
      [vendorId]
    );

    res.json({ ...result.rows[0], ComplianceDocuments: documentsResult.rows });
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
    const { Decision, Notes, RejectionReason } = req.body;

    if (!Decision) {
      res.status(400).json({ ErrorMessage: 'Decision is required (Approved or Rejected).' });
      return;
    }

    const normalizedDecision =
      typeof Decision === 'string' ? Decision.trim() : Decision;
    const allowed = ['Pending Approval', 'Active', 'Rejected'];
    if (!allowed.includes(normalizedDecision)) {
      res.status(400).json({ ErrorMessage: 'Decision must be one of: Pending Approval, Active, Rejected.' });
      return;
    }

    const reviewNotes = (Notes ?? RejectionReason ?? '') as string;

    await pool.query(
      'SELECT * FROM identity.approve_vendor_registration($1, $2, $3, $4)',
      [vendorId, normalizedDecision, auth!.sub, reviewNotes]
    );

    const updatedVendor = await pool.query(
      `SELECT vendor_id, company_name, vendor_status, is_active, updated_at, review_notes
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
      VendorStatus: v.vendor_status,
      IsActive: v.is_active,
      Decision: normalizedDecision,
      ReviewedAt: v.updated_at,
      ReviewNotes: v.review_notes,
    });
  } catch (error: any) {
    res.status(500).json({ ErrorMessage: error.message || 'An error occurred processing the decision.' });
  }
});

// GET /api/admin/vendors/compliance/:documentId/file
vendorAdminRouter.get('/api/admin/vendors/compliance/:documentId/file', async (req, res) => {
  const auth = await requirePermission(req, 'admin.vendor_approval');
  if (denyIfNoPermission(res, auth)) return;

  if (!pool) {
    res.status(500).json({ ErrorMessage: 'Database connection is not configured.' });
    return;
  }

  try {
    const { documentId } = req.params;
    const result = await pool.query(
      'SELECT document_url, file_name, document_content FROM identity.compliance_documents WHERE document_id = $1',
      [documentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ErrorMessage: 'Document not found.' });
      return;
    }

    const doc = result.rows[0];
    const fileName = doc.file_name || doc.document_url?.split('/').pop() || 'compliance-document';

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
