'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { getVendorProfile, updateVendorProfile } from '../services/vendorService';
import { VendorProfile, VendorProfileUpdateRequest } from '../types/vendor';

const ProfileManagementPage: React.FC = () => {
    const router = useRouter();
    const { isAuthenticated, isReady } = useAuth();
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [formData, setFormData] = useState<VendorProfileUpdateRequest>({
        CompanyName: '',
        CompanyAddress: '',
        ContactPerson: '',
        Email: ''
    });

    useEffect(() => {
        if (!isReady) {
            return;
        }

        const token = localStorage.getItem('vendorAuthToken');
        const storedVendorId = localStorage.getItem('vendorId');
        if (!token || !isAuthenticated) {
            router.replace('/login?next=%2Fdashboard%2Fprofile-management');
            return;
        }

        if (!storedVendorId) {
            setError('Vendor session is missing. Please log in again.');
            setLoading(false);
            return;
        }

        let active = true;
        const loadProfile = async () => {
            setLoading(true);
            try {
                const data = await getVendorProfile(storedVendorId);
                if (active) {
                    setProfile(data);
                    setVendorId(storedVendorId);
                    setFormData({
                        CompanyName: data.CompanyName,
                        CompanyAddress: data.CompanyAddress,
                        ContactPerson: data.ContactPerson,
                        Email: data.Email
                    });
                }
            } catch (err: any) {
                if (active) {
                    setError(err.message || 'Failed to load profile.');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadProfile();
        return () => {
            active = false;
        };
    }, [isAuthenticated, isReady, router]);

    const handleEdit = () => {
        if (!profile) return;
        setFormData({
            CompanyName: profile.CompanyName,
            CompanyAddress: profile.CompanyAddress,
            ContactPerson: profile.ContactPerson,
            Email: profile.Email
        });
        setSuccessMessage(null);
        setError(null);
        setIsEditing(true);
    };

    const handleCancel = () => {
        if (!profile) return;
        setFormData({
            CompanyName: profile.CompanyName,
            CompanyAddress: profile.CompanyAddress,
            ContactPerson: profile.ContactPerson,
            Email: profile.Email
        });
        setError(null);
        setSuccessMessage(null);
        setIsEditing(false);
    };

    const handleChange = (field: keyof VendorProfileUpdateRequest, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!vendorId) {
            setError('Vendor session is missing. Please log in again.');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const updated = await updateVendorProfile(vendorId, formData);
            setProfile(updated);
            setIsEditing(false);
            setSuccessMessage('Profile updated successfully.');
        } catch (err: any) {
            setError(err.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 text-center">
                <p>Loading profile...</p>
            </div>
        );
    }

    if (error) {
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

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Company Profile</h2>
            {successMessage && (
                <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                    {successMessage}
                </div>
            )}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-600"><strong>Registration Number (CAC):</strong> <span className="font-medium text-gray-800">{profile.RegistrationNumber}</span></p>
                        <p className="text-gray-600"><strong>Tax ID (TIN):</strong> <span className="font-medium text-gray-800">{profile.TaxId}</span></p>
                        <p className="text-gray-600"><strong>Status:</strong> <span className="font-medium text-gray-800">{profile.VendorStatus}</span></p>
                        <p className="text-gray-600"><strong>Last Login:</strong> <span className="font-medium text-gray-800">{profile.LastLogin ? new Date(profile.LastLogin).toLocaleString() : 'N/A'}</span></p>
                    </div>
                    <div>
                        <h4 className="text-xl font-semibold text-gray-700 mb-2">Contact Information</h4>
                        {!isEditing ? (
                            <>
                                <p className="text-gray-600"><strong>Company Name:</strong> <span className="font-medium text-gray-800">{profile.CompanyName}</span></p>
                                <p className="text-gray-600"><strong>Address:</strong> <span className="font-medium text-gray-800">{profile.CompanyAddress}</span></p>
                                <p className="text-gray-600"><strong>Contact Person:</strong> <span className="font-medium text-gray-800">{profile.ContactPerson}</span></p>
                                <p className="text-gray-600"><strong>Contact Email:</strong> <span className="font-medium text-gray-800">{profile.Email}</span></p>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                    <input
                                        type="text"
                                        value={formData.CompanyName ?? ''}
                                        onChange={(e) => handleChange('CompanyName', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Company Address</label>
                                    <textarea
                                        rows={3}
                                        value={formData.CompanyAddress ?? ''}
                                        onChange={(e) => handleChange('CompanyAddress', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                                    <input
                                        type="text"
                                        value={formData.ContactPerson ?? ''}
                                        onChange={(e) => handleChange('ContactPerson', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                                    <input
                                        type="email"
                                        value={formData.Email ?? ''}
                                        onChange={(e) => handleChange('Email', e.target.value)}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-6 text-right">
                    {!isEditing ? (
                        <button
                            onClick={handleEdit}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
                        >
                            Edit Profile
                        </button>
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
        </div>
    );
};

export default ProfileManagementPage;
