import type { ComplianceDocument, VendorProfile } from '../../../vendors/features/vendor/types/vendor';

export const dummyVendorProfile: VendorProfile = {
  VendorId: '1',
  CompanyName: 'Dummy Company Inc.',
  RegistrationNumber: 'CAC12345',
  TaxId: 'TIN67890',
  CompanyAddress: '123 Dummy Street, Dummy City',
  ContactPerson: 'John Doe',
  Email: 'john.doe@dummy.com',
  VendorStatus: 'Active' // Added to satisfy VendorProfile interface
};

export const dummyComplianceDocuments: ComplianceDocument[] = [];

