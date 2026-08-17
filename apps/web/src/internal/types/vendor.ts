export type VendorApprovalStatus = 'Pending Approval' | 'Active' | 'Rejected' | 'Deleted';

export interface VendorApprovalSummary {
  VendorId: string;
  CompanyName: string;
  RegistrationNumber: string;
  TaxId: string;
  ContactPerson: string;
  PhoneNumber?: string | null;
  Email: string;
  RegistrationDate: string;
  VendorStatus: string;
  IsActive: boolean;
  ComplianceDocumentsCount: number;
  ApprovedDocumentsCount: number;
  PendingDocumentsCount: number;
  RejectedDocumentsCount: number;
  LastComplianceUpdateAt?: string | null;
}

export interface VendorComplianceReviewItem {
  DocumentId: string;
  DocumentType: string;
  VerificationStatus: string;
  ExpiryDate?: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  VerifiedBy?: string | null;
  VerifiedAt?: string | null;
  FileUrl: string;
}

export interface VendorApprovalDetail extends VendorApprovalSummary {
  CompanyAddress: string;
  LastLogin?: string | null;
  ComplianceDocuments: VendorComplianceReviewItem[];
}

export interface VendorApprovalDecisionRequest {
  Decision: VendorApprovalStatus;
  Notes?: string | null;
}
