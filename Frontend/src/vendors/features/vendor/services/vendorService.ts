import apiClient, { fetchCsrfToken } from '../../shared/services/apiClient';
export { fetchCsrfToken };
import {
    VendorLoginData,
    VendorRegistrationData,
    VendorLoginRequestBackend,
    VendorRegistrationRequestBackend,
    VendorLoginResponse,
    VendorRegistrationResponse,
    VendorAvailabilityResponse,
    VendorProfile,
    VendorProfileUpdateRequest
} from '../types/vendor';

const API_ENDPOINTS = {
    VENDOR_LOGIN: '/api/Auth/login',
    VENDOR_LOGOUT: '/api/Auth/logout',
    VENDOR_ME: '/api/Auth/me',
    VENDOR_REGISTER: '/api/Auth/register',
    VENDOR_COMPLIANCE_UPLOAD: '/api/Vendor/compliance/upload',
    VENDOR_COMPLIANCE_LIST: '/api/Vendor/compliance',
    VENDOR_COMPLIANCE_REQUIREMENTS: '/api/Vendor/compliance/requirements',
    VENDOR_COMPLIANCE_HISTORY: (documentType: string) => `/api/Vendor/compliance/history/${documentType}`,
    VENDOR_COMPLIANCE_CHECKLIST: '/api/Vendor/compliance/checklist',
    VENDOR_PROFILE: (vendorId: string) => `/api/Vendor/${vendorId}`,
    VENDOR_AVAILABILITY: '/api/Vendor/availability'
};
export const VENDOR_AUTH_TOKEN_KEY = 'vendorAuthToken';

export const setVendorAuthToken = (token: string | null) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (token) {
        localStorage.setItem(VENDOR_AUTH_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(VENDOR_AUTH_TOKEN_KEY);
    }
};

export const getStoredVendorAuthToken = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return localStorage.getItem(VENDOR_AUTH_TOKEN_KEY);
};

const parseJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Uploads a compliance document for the vendor.
 *
 * @param documentType The type of document being uploaded (e.g., 'certificate_of_incorporation').
 * @param file The file to upload.
 * @returns A promise that resolves with the updated ComplianceDocument.
 */
export const uploadComplianceDocument = async (
    documentType: string,
    file: File,
    expiryDate?: string
): Promise<ComplianceDocumentResponse> => {
    try {
        const formData = new FormData();
        formData.append('documentType', documentType);
        if (expiryDate) {
            formData.append('expiryDate', expiryDate);
        }
        formData.append('file', file);

        const response = await apiClient.post(API_ENDPOINTS.VENDOR_COMPLIANCE_UPLOAD, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data as ComplianceDocumentResponse;
    } catch (error) {
        console.error("Failed to upload compliance document:", error);
        throw new Error("Could not upload document. Please try again later.");
    }
};

/**
 * Vendor login function
 * Authenticates a vendor using credentials from the frontend form.
 *
 * @param credentials - Vendor's login credentials (Email, Password).
 * @returns Promise resolving to login response.
 */
export const vendorLogin = async (credentials: VendorLoginData): Promise<VendorLoginResponse> => {
    try {
        const requestPayload: VendorLoginRequestBackend = {
            Email: credentials.Email,
            Password: credentials.Password
        };
        const response = await apiClient.post(API_ENDPOINTS.VENDOR_LOGIN, requestPayload);
        
        const token = response.data.Token;
        const jwtPayload = token ? parseJwtPayload(token) : null;
        const vendorId = typeof jwtPayload?.sub === 'string' ? jwtPayload.sub : '';
        const email = typeof jwtPayload?.email === 'string' ? jwtPayload.email : response.data.Email;

        setVendorAuthToken(token);
        return {
            Token: token,
            Email: email,
            VendorId: vendorId,
            CompanyName: response.data.CompanyName || '', // Backend AuthResponse might not have this, but let's see
            VendorStatus: response.data.Status || 'Success',
            Status: response.data.Status
        } as unknown as VendorLoginResponse;
    } catch (error: any) {
        const responseData = error.response?.data;

        if (responseData) {
            if (typeof responseData === 'string') {
                throw new Error(responseData);
            }

            throw new Error(
                responseData.ErrorMessage ||
                responseData.message ||
                responseData.detail ||
                'Login failed. Please check your credentials.'
            );
        }

        throw new Error("Login failed. Please check your credentials and try again.");
    }
};

/**
 * Vendor registration function
 * Registers a new vendor in the system
 * 
 * @param data - Vendor registration data
 * @returns Promise resolving to registration response
 */
export const registerVendor = async (data: VendorRegistrationData): Promise<VendorRegistrationResponse> => {
    try {
        const registrationData: VendorRegistrationRequestBackend = { 
            CompanyName: data.CompanyName,
            RegistrationNumber: data.RegistrationNumber,
            TaxID: data.TaxId,
            CompanyAddress: data.CompanyAddress,
            ContactPerson: data.ContactPerson,
            PhoneNumber: data.PhoneNumber,
            Email: data.Email,
            Password: data.Password
        };
        const response = await apiClient.post(API_ENDPOINTS.VENDOR_REGISTER, registrationData);
        return response.data;
    } catch (error: any) {
        console.error("Vendor registration failed:", error);
        const responseData = error.response?.data;

        if (responseData) {
            if (typeof responseData === 'string') {
                throw new Error(responseData);
            }

            throw new Error(
                responseData.ErrorMessage ||
                responseData.message ||
                responseData.detail ||
                'Registration failed. Please review the form and try again.'
            );
        }

        throw new Error("Registration failed. Please try again later.");
    }
};

export interface ComplianceDocumentResponse {
    DocumentId: string;
    DocumentType: string;
    Status: string;
    ExpiryDate?: string;
    CreatedAt?: string;
    FileUrl?: string;
    RejectionReason?: string;
}

export interface ComplianceRequirementResponse {
    Id: string;
    Name: string;
    Required: boolean;
    Frequency: string;
    Expirable: boolean;
    Description: string;
}

export interface ComplianceHistoryResponse {
    HistoryId: string;
    DocumentId: string;
    DocumentType: string;
    DocumentUrl: string;
    ExpiryDate?: string;
    Status: string;
    CreatedAt: string;
    FileUrl?: string;
}

export const getVendorComplianceDocuments = async (): Promise<ComplianceDocumentResponse[]> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_COMPLIANCE_LIST);
        if (!Array.isArray(response.data)) {
            console.warn("Compliance documents response is not an array:", response.data);
            return [];
        }
        return response.data as ComplianceDocumentResponse[];
    } catch (error: any) {
        console.error("Failed to fetch compliance documents:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to load compliance documents right now.");
    }
};

export const getComplianceRequirements = async (): Promise<ComplianceRequirementResponse[]> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_COMPLIANCE_REQUIREMENTS);
        if (!Array.isArray(response.data)) {
            console.warn("Compliance requirements response is not an array:", response.data);
            return [];
        }
        return response.data as ComplianceRequirementResponse[];
    } catch (error: any) {
        console.error("Failed to fetch compliance requirements:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to load compliance requirements right now.");
    }
};

export const getComplianceHistory = async (documentType: string): Promise<ComplianceHistoryResponse[]> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_COMPLIANCE_HISTORY(documentType));
        if (!Array.isArray(response.data)) {
            console.warn("Compliance history response is not an array:", response.data);
            return [];
        }
        return response.data as ComplianceHistoryResponse[];
    } catch (error: any) {
        console.error("Failed to fetch compliance history:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to load compliance history right now.");
    }
};

export const downloadComplianceChecklist = async (): Promise<Blob> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_COMPLIANCE_CHECKLIST, {
            responseType: 'blob'
        });
        return response.data as Blob;
    } catch (error: any) {
        console.error("Failed to download compliance checklist:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to download checklist right now.");
    }
};

export const checkVendorAvailability = async (params: {
    email?: string;
    registrationNumber?: string;
    taxId?: string;
}): Promise<VendorAvailabilityResponse> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_AVAILABILITY, { params });
        return response.data as VendorAvailabilityResponse;
    } catch (error: any) {
        console.error("Vendor availability check failed:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to check availability right now.");
    }
};

export const getVendorProfile = async (vendorId: string): Promise<VendorProfile> => {
    try {
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_PROFILE(vendorId));
        return response.data as VendorProfile;
    } catch (error: any) {
        console.error("Failed to fetch vendor profile:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to load vendor profile right now.");
    }
};

export const updateVendorProfile = async (
    vendorId: string,
    payload: VendorProfileUpdateRequest
): Promise<VendorProfile> => {
    try {
        const response = await apiClient.put(API_ENDPOINTS.VENDOR_PROFILE(vendorId), payload);
        return response.data as VendorProfile;
    } catch (error: any) {
        console.error("Failed to update vendor profile:", error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error("Unable to update vendor profile right now.");
    }
};

/**
 * Logs out the current vendor by calling the backend logout endpoint.
 */
export const logoutVendor = async (): Promise<void> => {
    try {
        await apiClient.post(API_ENDPOINTS.VENDOR_LOGOUT);
    } catch (error) {
        console.error("Failed to logout vendor:", error);
        // Still proceed with frontend logout if backend fails
    }
};

/**
 * Fetches the current authenticated user's information.
 */
export const getCurrentUser = async (): Promise<{ UserId: string; Email: string; Role: string } | null> => {
    try {
        console.log('[Auth] Calling API:', API_ENDPOINTS.VENDOR_ME);
        console.log('[Auth] Authorization header:', apiClient.defaults.headers.common.Authorization);
        const response = await apiClient.get(API_ENDPOINTS.VENDOR_ME);
        console.log('[Auth] API response:', response.data);
        return response.data;
    } catch (error: any) {
        const status = error.response?.status;
        if (status === 401) {
            console.info('[Auth] Not authenticated; skipping profile fetch.', status);
        } else {
            console.error('[Auth] API call failed:', error.message, status, error.response?.data);
        }
        return null;
    }
};
