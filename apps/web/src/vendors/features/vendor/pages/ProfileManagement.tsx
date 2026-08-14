'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { getVendorProfile, updateVendorProfile, changeVendorPassword } from '../services/vendorService';
import { VendorProfile, VendorProfileUpdateRequest } from '../types/vendor';

const PHONE_REGEX = /^\+?[0-9 ()-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
    CompanyName?: string;
    CompanyAddress?: string;
    ContactPerson?: string;
    PhoneNumber?: string;
    Email?: string;
    CurrentPassword?: string;
    NewPassword?: string;
    ConfirmPassword?: string;
};

const ProfileManagementPage: React.FC = () => {
    const router = useRouter();
    const { isAuthenticated, isReady, hasSessionAttempted, user } = useAuth();
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [showEmailConfirm, setShowEmailConfirm] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ CurrentPassword: '', NewPassword: '', ConfirmPassword: '' });
    const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const initialFormDataRef = useRef<VendorProfileUpdateRequest | null>(null);

    const [formData, setFormData] = useState<VendorProfileUpdateRequest>({
        CompanyName: '',
        CompanyAddress: '',
        ContactPerson: '',
        PhoneNumber: '',
        Email: ''
    });

    useEffect(() => {
        if (!isReady) return;
        if (!hasSessionAttempted) return;
        if (!isAuthenticated) {
            router.replace('/vendors/login?next=%2Fvendors%2Fdashboard%2Fprofile-management');
            return;
        }

        const currentVendorId = user?.UserId;
        if (!currentVendorId) {
            setError('Vendor session is missing. Please log in again.');
            setLoading(false);
            return;
        }

        let active = true;
        const loadProfile = async () => {
            setLoading(true);
            try {
                const data = await getVendorProfile(currentVendorId);
                if (active) {
                    setProfile(data);
                    const fd = {
                        CompanyName: data.CompanyName,
                        CompanyAddress: data.CompanyAddress,
                        ContactPerson: data.ContactPerson,
                        PhoneNumber: data.PhoneNumber ?? '',
                        Email: data.Email
                    };
                    setFormData(fd);
                    initialFormDataRef.current = fd;
                }
            } catch (err: any) {
                if (active) setError(err.message || 'Failed to load profile.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadProfile();
        return () => { active = false; };
    }, [isAuthenticated, isReady, hasSessionAttempted, router, user?.UserId]);

    useEffect(() => {
        if (!isEditing || !initialFormDataRef.current) return;
        const changed = Object.keys(formData).some(
            k => formData[k as keyof VendorProfileUpdateRequest] !== initialFormDataRef.current![k as keyof VendorProfileUpdateRequest]
        );
        setHasUnsavedChanges(changed);
    }, [formData, isEditing]);

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedChanges]);

    const validateForm = (): boolean => {
        const errors: FieldErrors = {};
        if (!formData.CompanyName?.trim()) errors.CompanyName = 'Company name is required.';
        else if (formData.CompanyName.length > 256) errors.CompanyName = 'Company name must be 256 characters or fewer.';
        if (!formData.ContactPerson?.trim()) errors.ContactPerson = 'Contact person is required.';
        else if (formData.ContactPerson.length > 128) errors.ContactPerson = 'Contact person must be 128 characters or fewer.';
        if (formData.CompanyAddress && formData.CompanyAddress.length > 512) errors.CompanyAddress = 'Address must be 512 characters or fewer.';
        if (formData.PhoneNumber && !PHONE_REGEX.test(formData.PhoneNumber)) errors.PhoneNumber = 'Invalid phone number format.';
        if (!formData.Email?.trim()) errors.Email = 'Email is required.';
        else if (!EMAIL_REGEX.test(formData.Email)) errors.Email = 'Invalid email address.';
        else if (formData.Email.length > 256) errors.Email = 'Email must be 256 characters or fewer.';
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleEdit = () => {
        if (!profile) return;
        const fd = {
            CompanyName: profile.CompanyName,
            CompanyAddress: profile.CompanyAddress,
            ContactPerson: profile.ContactPerson,
            PhoneNumber: profile.PhoneNumber ?? '',
            Email: profile.Email
        };
        setFormData(fd);
        initialFormDataRef.current = fd;
        setSuccessMessage(null);
        setError(null);
        setFieldErrors({});
        setHasUnsavedChanges(false);
        setIsEditing(true);
    };

    const handleCancel = () => {
        if (!profile) return;
        const fd = {
            CompanyName: profile.CompanyName,
            CompanyAddress: profile.CompanyAddress,
            ContactPerson: profile.ContactPerson,
            PhoneNumber: profile.PhoneNumber ?? '',
            Email: profile.Email
        };
        setFormData(fd);
        initialFormDataRef.current = fd;
        setError(null);
        setSuccessMessage(null);
        setFieldErrors({});
        setHasUnsavedChanges(false);
        setIsEditing(false);
    };

    const handleChange = (field: keyof VendorProfileUpdateRequest, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (fieldErrors[field as keyof FieldErrors]) {
            setFieldErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleSave = async () => {
        if (!user?.UserId) {
            setError('Vendor session is missing. Please log in again.');
            return;
        }

        if (!validateForm()) return;

        if (profile && formData.Email !== profile.Email) {
            setShowEmailConfirm(true);
            return;
        }

        await performSave();
    };

    const performSave = async () => {
        if (!user?.UserId) return;
        setShowEmailConfirm(false);
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const updated = await updateVendorProfile(user.UserId, formData);
            setProfile(updated);
            setIsEditing(false);
            setHasUnsavedChanges(false);
            initialFormDataRef.current = { ...formData };
            setSuccessMessage('Profile updated successfully.');
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            setError(err.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const validatePassword = (): boolean => {
        const errors: FieldErrors = {};
        if (!passwordForm.CurrentPassword) errors.CurrentPassword = 'Current password is required.';
        if (!passwordForm.NewPassword) errors.NewPassword = 'New password is required.';
        else if (passwordForm.NewPassword.length < 8) errors.NewPassword = 'Must be at least 8 characters.';
        else if (passwordForm.NewPassword.length > 128) errors.NewPassword = 'Must be 128 characters or fewer.';
        if (passwordForm.NewPassword !== passwordForm.ConfirmPassword) errors.ConfirmPassword = 'Passwords do not match.';
        setPasswordErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChangePassword = async () => {
        if (!user?.UserId) return;
        if (!validatePassword()) return;

        setChangingPassword(true);
        setPasswordSuccess(false);
        setPasswordErrors({});

        try {
            await changeVendorPassword(user.UserId, passwordForm.CurrentPassword, passwordForm.NewPassword);
            setPasswordSuccess(true);
            setPasswordForm({ CurrentPassword: '', NewPassword: '', ConfirmPassword: '' });
            setTimeout(() => { setPasswordSuccess(false); setShowPasswordModal(false); }, 3000);
        } catch (err: any) {
            setPasswordErrors({ CurrentPassword: err.message || 'Failed to change password.' });
        } finally {
            setChangingPassword(false);
        }
    };

    const getFieldError = (field: keyof FieldErrors) =>
        fieldErrors[field] ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors[field]}</p>
        ) : null;

    const getFieldClassName = (field: keyof FieldErrors, base: string) =>
        `${base} ${fieldErrors[field] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`;

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-48" />
                    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-4 bg-gray-200 rounded w-1/2" />
                                <div className="h-4 bg-gray-200 rounded w-2/3" />
                                <div className="h-4 bg-gray-200 rounded w-1/3" />
                            </div>
                            <div className="space-y-3">
                                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-4 bg-gray-200 rounded w-1/2" />
                                <div className="h-4 bg-gray-200 rounded w-2/3" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="container mx-auto p-4 text-center">
                <p>No profile data available.</p>
            </div>
        );
    }

    const inputBase = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Company Profile</h2>

            {successMessage && (
                <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 flex items-center justify-between">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 text-lg font-bold">&times;</button>
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-lg font-bold">&times;</button>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-lg font-semibold text-gray-700 mb-3">Account Details</h4>
                        <div className="space-y-2 text-sm">
                            <p className="text-gray-600">
                                <strong>Registration Number (CAC):</strong>{' '}
                                <span className="font-medium text-gray-800">{profile.RegistrationNumber}</span>
                                <span className="ml-2 text-xs text-gray-400">(set during registration)</span>
                            </p>
                            <p className="text-gray-600">
                                <strong>Tax ID (TIN):</strong>{' '}
                                <span className="font-medium text-gray-800">{profile.TaxId}</span>
                                <span className="ml-2 text-xs text-gray-400">(set during registration)</span>
                            </p>
                            <p className="text-gray-600">
                                <strong>Status:</strong>{' '}
                                <span className={`font-medium ${profile.VendorStatus === 'Active' ? 'text-emerald-600' : profile.VendorStatus === 'Pending' ? 'text-amber-600' : 'text-gray-800'}`}>
                                    {profile.VendorStatus}
                                </span>
                            </p>
                            <p className="text-gray-600">
                                <strong>Registered:</strong>{' '}
                                <span className="font-medium text-gray-800">
                                    {profile.RegistrationDate ? new Date(profile.RegistrationDate).toLocaleDateString() : 'N/A'}
                                </span>
                            </p>
                            <p className="text-gray-600">
                                <strong>Last Login:</strong>{' '}
                                <span className="font-medium text-gray-800">
                                    {profile.LastLogin ? new Date(profile.LastLogin).toLocaleString() : 'N/A'}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-lg font-semibold text-gray-700 mb-3">Contact Information</h4>
                        {!isEditing ? (
                            <div className="space-y-2 text-sm">
                                <p className="text-gray-600"><strong>Company Name:</strong> <span className="font-medium text-gray-800">{profile.CompanyName}</span></p>
                                <p className="text-gray-600"><strong>Address:</strong> <span className="font-medium text-gray-800">{profile.CompanyAddress}</span></p>
                                <p className="text-gray-600"><strong>Contact Person:</strong> <span className="font-medium text-gray-800">{profile.ContactPerson}</span></p>
                                <p className="text-gray-600"><strong>Phone Number:</strong> <span className="font-medium text-gray-800">{profile.PhoneNumber || 'N/A'}</span></p>
                                <p className="text-gray-600"><strong>Contact Email:</strong> <span className="font-medium text-gray-800">{profile.Email}</span></p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.CompanyName ?? ''}
                                        onChange={(e) => handleChange('CompanyName', e.target.value)}
                                        className={getFieldClassName('CompanyName', inputBase)}
                                        maxLength={256}
                                    />
                                    {getFieldError('CompanyName')}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Company Address</label>
                                    <textarea
                                        rows={3}
                                        value={formData.CompanyAddress ?? ''}
                                        onChange={(e) => handleChange('CompanyAddress', e.target.value)}
                                        className={getFieldClassName('CompanyAddress', inputBase)}
                                        maxLength={512}
                                    />
                                    {getFieldError('CompanyAddress')}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Contact Person <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.ContactPerson ?? ''}
                                        onChange={(e) => handleChange('ContactPerson', e.target.value)}
                                        className={getFieldClassName('ContactPerson', inputBase)}
                                        maxLength={128}
                                    />
                                    {getFieldError('ContactPerson')}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.PhoneNumber ?? ''}
                                        onChange={(e) => handleChange('PhoneNumber', e.target.value)}
                                        className={getFieldClassName('PhoneNumber', inputBase)}
                                        placeholder="+234..."
                                    />
                                    {getFieldError('PhoneNumber')}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Contact Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.Email ?? ''}
                                        onChange={(e) => handleChange('Email', e.target.value)}
                                        className={getFieldClassName('Email', inputBase)}
                                        maxLength={256}
                                    />
                                    {getFieldError('Email')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
                    {!isEditing ? (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                            >
                                Change Password
                            </button>
                            <button
                                onClick={handleEdit}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                            >
                                Edit Profile
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
                            <button
                                onClick={handleCancel}
                                className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showEmailConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Email Change</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You are changing your email from <strong>{profile.Email}</strong> to <strong>{formData.Email}</strong>.
                            This will be your new login email. Are you sure?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowEmailConfirm(false)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={performSave}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Confirm Change'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>

                        {passwordSuccess && (
                            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                                Password updated successfully.
                            </div>
                        )}

                        {passwordErrors.CurrentPassword && !passwordErrors.NewPassword && !passwordErrors.ConfirmPassword && (
                            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                                {passwordErrors.CurrentPassword}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Current Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.CurrentPassword}
                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, CurrentPassword: e.target.value }))}
                                    className={getFieldClassName('CurrentPassword', inputBase)}
                                />
                                {getFieldError('CurrentPassword')}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    New Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.NewPassword}
                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, NewPassword: e.target.value }))}
                                    className={getFieldClassName('NewPassword', inputBase)}
                                />
                                {getFieldError('NewPassword')}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Confirm New Password <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.ConfirmPassword}
                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, ConfirmPassword: e.target.value }))}
                                    className={getFieldClassName('ConfirmPassword', inputBase)}
                                />
                                {getFieldError('ConfirmPassword')}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowPasswordModal(false); setPasswordForm({ CurrentPassword: '', NewPassword: '', ConfirmPassword: '' }); setPasswordErrors({}); setPasswordSuccess(false); }}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                                disabled={changingPassword}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleChangePassword}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                                disabled={changingPassword}
                            >
                                {changingPassword ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileManagementPage;
