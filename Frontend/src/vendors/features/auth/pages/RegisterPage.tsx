'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VendorRegistrationData } from '../../vendor/types/vendor';
import { checkVendorAvailability, registerVendor } from '../../vendor/services/vendorService';

const passwordRequirements = [
    'At least 8 characters',
    'One uppercase and one lowercase letter',
    'At least one number',
    'At least one special character'
];

const validateVendorPassword = (password: string) => {
    if (password.length < 8) {
        return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        return 'Password must include both uppercase and lowercase letters.';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number.';
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
        return 'Password must include at least one special character.';
    }

    return true;
};

const validatePhoneNumber = (value: string) => {
    if (!/^\+?[0-9 ()-]{7,20}$/.test(value.trim())) {
        return 'Phone number must be 7-20 characters and may include digits, spaces, parentheses, hyphen, or leading +.';
    }

    return true;
};

const RegisterPage: React.FC = () => {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
    const [availability, setAvailability] = useState<{
        email?: boolean;
        registrationNumber?: boolean;
        taxId?: boolean;
    }>({});
    const [availabilityLoading, setAvailabilityLoading] = useState({
        email: false,
        registrationNumber: false,
        taxId: false
    });
    const [availabilityError, setAvailabilityError] = useState<{
        email?: string;
        registrationNumber?: string;
        taxId?: string;
    }>({});

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<VendorRegistrationData>();


    const onSubmit = async (data: VendorRegistrationData) => {
        setServerError(null);
        setRegistrationSuccess(false);
        if (data.Password !== data.ConfirmPassword) {
            setServerError('Passwords do not match.');
            return;
        }
        if (availability.email === false || availability.registrationNumber === false || availability.taxId === false) {
            setServerError('Some fields are already registered. Please update them and try again.');
            return;
        }
        try {
            await registerVendor(data);
            setRegistrationSuccess(true);
        } catch (error: any) {
            setServerError(error.message || 'Registration failed. Please try again.');
        }
    };

    const runAvailabilityCheck = async (field: 'email' | 'registrationNumber' | 'taxId', value: string) => {
        if (!value) {
            return;
        }
        setAvailabilityLoading((prev) => ({ ...prev, [field]: true }));
        setAvailabilityError((prev) => ({ ...prev, [field]: undefined }));
        try {
            const response = await checkVendorAvailability({
                email: field === 'email' ? value : undefined,
                registrationNumber: field === 'registrationNumber' ? value : undefined,
                taxId: field === 'taxId' ? value : undefined
            });

            setAvailability((prev) => ({
                ...prev,
                email: field === 'email' ? response.emailAvailable : prev.email,
                registrationNumber: field === 'registrationNumber' ? response.registrationAvailable : prev.registrationNumber,
                taxId: field === 'taxId' ? response.taxAvailable : prev.taxId
            }));
        } catch (error: any) {
            setAvailabilityError((prev) => ({
                ...prev,
                [field]: error.message || 'Unable to check availability.'
            }));
        } finally {
            setAvailabilityLoading((prev) => ({ ...prev, [field]: false }));
        }
    };

    if (registrationSuccess) {
        return (
            <div className="registration-success">
                <h2>Registration Successful!</h2>
                <p>Your vendor account has been created and is awaiting procurement approval.</p>
                <p>You will be able to sign in after the account is activated.</p>
                <button onClick={() => router.push('/')}>Return to Home</button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Vendor Registration</h2>
                <p className="text-gray-600 mb-6 text-center">Create an account to bid on procurement opportunities.</p>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label htmlFor="companyName" className="block text-gray-700 text-sm font-bold mb-2">Company Name</label>
                        <input id="companyName" type="text" {...register('CompanyName', { required: 'Company name is required' })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.CompanyName && <p className="text-red-500 text-xs italic">{String(errors.CompanyName.message)}</p>}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="registrationNumber" className="block text-gray-700 text-sm font-bold mb-2">Company Registration Number (CAC)</label>
                        <input
                            id="registrationNumber"
                            type="text"
                            {...register('RegistrationNumber', {
                                required: 'Registration number is required',
                                onBlur: (event) => runAvailabilityCheck('registrationNumber', event.target.value)
                            })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.RegistrationNumber && <p className="text-red-500 text-xs italic">{String(errors.RegistrationNumber.message)}</p>}
                        {!errors.RegistrationNumber && availabilityLoading.registrationNumber ? (
                            <p className="text-xs italic text-slate-500">Checking availability...</p>
                        ) : null}
                        {!errors.RegistrationNumber && availabilityError.registrationNumber ? (
                            <p className="text-xs italic text-rose-600">{availabilityError.registrationNumber}</p>
                        ) : null}
                        {!errors.RegistrationNumber && availability.registrationNumber === false ? (
                            <p className="text-xs italic text-rose-600">Registration number already exists.</p>
                        ) : null}
                        {!errors.RegistrationNumber && availability.registrationNumber === true ? (
                            <p className="text-xs italic text-emerald-600">Registration number is available.</p>
                        ) : null}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="taxId" className="block text-gray-700 text-sm font-bold mb-2">Tax Identification Number (TIN)</label>
                        <input
                            id="taxId"
                            type="text"
                            {...register('TaxId', {
                                required: 'Tax ID is required',
                                onBlur: (event) => runAvailabilityCheck('taxId', event.target.value)
                            })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.TaxId && <p className="text-red-500 text-xs italic">{String(errors.TaxId.message)}</p>}
                        {!errors.TaxId && availabilityLoading.taxId ? (
                            <p className="text-xs italic text-slate-500">Checking availability...</p>
                        ) : null}
                        {!errors.TaxId && availabilityError.taxId ? (
                            <p className="text-xs italic text-rose-600">{availabilityError.taxId}</p>
                        ) : null}
                        {!errors.TaxId && availability.taxId === false ? (
                            <p className="text-xs italic text-rose-600">Tax ID already exists.</p>
                        ) : null}
                        {!errors.TaxId && availability.taxId === true ? (
                            <p className="text-xs italic text-emerald-600">Tax ID is available.</p>
                        ) : null}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="companyAddress" className="block text-gray-700 text-sm font-bold mb-2">Company Address</label>
                        <textarea id="companyAddress" {...register('CompanyAddress', { required: 'Company address is required' })}
                                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"></textarea>
                        {errors.CompanyAddress && <p className="text-red-500 text-xs italic">{String(errors.CompanyAddress.message)}</p>}
                    </div>

                    <hr className="my-6" />

                    <div className="mb-4">
                        <label htmlFor="contactPerson" className="block text-gray-700 text-sm font-bold mb-2">Contact Person</label>
                        <input id="contactPerson" type="text" {...register('ContactPerson', { required: 'Contact person is required' })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.ContactPerson && <p className="text-red-500 text-xs italic">{String(errors.ContactPerson.message)}</p>}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="phoneNumber" className="block text-gray-700 text-sm font-bold mb-2">Phone Number</label>
                        <input
                            id="phoneNumber"
                            type="tel"
                            {...register('PhoneNumber', {
                                required: 'Phone number is required',
                                validate: validatePhoneNumber
                            })}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                        {errors.PhoneNumber && <p className="text-red-500 text-xs italic">{String(errors.PhoneNumber.message)}</p>}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Contact Email (will be your username)</label>
                        <input
                            id="email"
                            type="email"
                            {...register('Email', {
                                required: 'Email is required',
                                onBlur: (event) => runAvailabilityCheck('email', event.target.value)
                            })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.Email && <p className="text-red-500 text-xs italic">{String(errors.Email.message)}</p>}
                        {!errors.Email && availabilityLoading.email ? (
                            <p className="text-xs italic text-slate-500">Checking availability...</p>
                        ) : null}
                        {!errors.Email && availabilityError.email ? (
                            <p className="text-xs italic text-rose-600">{availabilityError.email}</p>
                        ) : null}
                        {!errors.Email && availability.email === false ? (
                            <p className="text-xs italic text-rose-600">Email already exists.</p>
                        ) : null}
                        {!errors.Email && availability.email === true ? (
                            <p className="text-xs italic text-emerald-600">Email is available.</p>
                        ) : null}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password</label>
                        <input id="password" type="password" {...register('Password', {
                            required: 'Password is required',
                            validate: validateVendorPassword
                        })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.Password && <p className="text-red-500 text-xs italic">{String(errors.Password.message)}</p>}
                        {!errors.Password ? (
                            <p className="text-xs text-slate-500 mt-2">
                                Password must include: {passwordRequirements.join(', ')}.
                            </p>
                        ) : null}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-bold mb-2">Confirm Password</label>
                        <input id="confirmPassword" type="password" {...register('ConfirmPassword', {
                            required: 'Please confirm your password',
                            validate: (value, values) => value === values.Password || 'Passwords do not match.'
                        })}
                               className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                        {errors.ConfirmPassword && <p className="text-red-500 text-xs italic">{String(errors.ConfirmPassword.message)}</p>}
                    </div>

                    <hr className="my-6" />

                    <div className="mb-6 text-center">
                        <h4 className="text-lg font-semibold text-gray-700 mb-2">Statutory Documents</h4>
                        <p className="text-gray-600 text-sm">After registration, you will be required to upload compliance documents from your dashboard.</p>
                    </div>

                    {serverError && <p className="text-red-500 text-center text-sm mb-4">{serverError}</p>}

                    <button type="submit" disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full focus:outline-none focus:shadow-outline transition duration-300">
                        {isSubmitting ? 'Registering...' : 'Register'}
                    </button>
                </form>

                <p className="text-center text-gray-600 text-sm mt-4">
                    Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login here</Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;
