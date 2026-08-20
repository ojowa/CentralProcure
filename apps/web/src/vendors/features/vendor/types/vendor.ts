/**
 * Represents a vendor's profile in the system
 */
export interface VendorProfile {
    VendorId: string;
    CompanyName: string;
    RegistrationNumber: string;
    TaxId: string;
    CompanyAddress: string;
    ContactPerson: string;
    PhoneNumber?: string;
    Email: string;
    RegistrationDate?: string;
    LastLogin?: string;
    VendorStatus: string;
}

/**
 * Vendor status types
 */
export type VendorStatus = 'Pending' | 'Active' | 'Approved' | 'Rejected' | 'Suspended';

/**
 * Represents a compliance document for a vendor.
 */
export type ComplianceStatus = 'Missing' | 'Uploaded' | 'Approved' | 'Expired' | 'Rejected';

export interface ComplianceDocument {
    Id: string;
    Name: string;
    Status: ComplianceStatus;
    ExpiryDate?: string;
    RejectionReason?: string;
    FileUrl?: string;
    FileName?: string;
}

/**
 * Represents vendor registration data from the frontend form.
 */
export interface VendorRegistrationData {
    CompanyName: string;
    RegistrationNumber: string;
    TaxId: string;
    CompanyAddress: string;
    ContactPerson: string;
    PhoneNumber: string;
    Email: string;
    Password: string; // Frontend gets plain password
    ConfirmPassword: string; // For client-side validation
}

/**
 * Represents vendor login data from the frontend form.
 */
export interface VendorLoginData {
    Email: string;
    Password: string; // Frontend gets plain password
}

// API request types (for clarity and security)
/**
 * Represents the request payload for vendor login to the API.
 */
export interface VendorLoginRequestApi {
    Email: string;
    Password: string;
}

/**
 * Represents the request payload for vendor registration to the API.
 */
export interface VendorRegistrationRequestApi {
    CompanyName: string;
    RegistrationNumber: string;
    TaxID: string; // API expects 'TaxID' (uppercase ID)
    CompanyAddress: string;
    ContactPerson: string;
    PhoneNumber: string;
    Email: string;
    Password: string;
}

/**
 * Represents the response from a successful vendor login.
 */
export interface VendorLoginResponse {
    VendorId: string;
    CompanyName: string;
    Email: string;
    VendorStatus: string;
    Token: string; // Assuming a token is returned on successful login
    ErrorMessage?: string;
}

/**
 * Represents the response from a successful vendor registration.
 */
export interface VendorRegistrationResponse {
    VendorId: string;
    CompanyName: string;
    Email: string;
}

/**
 * Represents the availability response for vendor fields.
 */
export interface VendorAvailabilityResponse {
    EmailAvailable: boolean;
    RegistrationNumberAvailable: boolean;
    TaxIdAvailable: boolean;
}

export interface VendorProfileUpdateRequest {
    CompanyName?: string;
    CompanyAddress?: string;
    ContactPerson?: string;
    PhoneNumber?: string;
    Email?: string;
}
