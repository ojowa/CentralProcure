'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InternalOrganizationalUnitRecord, InternalRegistrationData, InternalRoleRecord } from '../types/internal';
import { fetchInternalRoles, fetchInternalUnits, registerInternalUser } from '../services/internalAuthService';

const formatRoleLabel = (roleName: string): string =>
    roleName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();

const validatePassword = (value: string): string | null => {
    if (value.length < 8) {
        return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value)) {
        return 'Password must include uppercase and lowercase letters.';
    }

    if (!/[0-9]/.test(value)) {
        return 'Password must include at least one number.';
    }

    if (!/[^a-zA-Z0-9]/.test(value)) {
        return 'Password must include at least one special character.';
    }

    return null;
};

const validateUsername = (value: string): string | null => {
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(value)) {
        return 'Username must be 3-100 characters and use only letters, numbers, dot, underscore, or hyphen.';
    }

    return null;
};

const validateName = (label: string, value: string, required = true): string | null => {
    if (!value.trim()) {
        return required ? `${label} is required.` : null;
    }

    if (!/^[A-Za-z][A-Za-z' -]{0,99}$/.test(value.trim())) {
        return `${label} contains invalid characters.`;
    }

    return null;
};

const validateServiceNumber = (value: string): string | null => {
    if (!/^[A-Za-z0-9/-]{3,100}$/.test(value.trim())) {
        return 'Service number must be 3-100 characters and use only letters, numbers, slash, or hyphen.';
    }

    return null;
};

const InternalRegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [surname, setSurname] = useState('');
    const [serviceNumber, setServiceNumber] = useState('');
    const [unitId, setUnitId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // New state for confirmation
    const [role, setRole] = useState('');
    const [availableRoles, setAvailableRoles] = useState<InternalRoleRecord[]>([]);
    const [availableUnits, setAvailableUnits] = useState<InternalOrganizationalUnitRecord[]>([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let isActive = true;

        const loadRoles = async () => {
            try {
                const [fetchedRoles, fetchedUnits] = await Promise.all([
                    fetchInternalRoles(),
                    fetchInternalUnits()
                ]);
                const activeRoles = fetchedRoles.filter((entry) => entry.IsActive);
                const assignableUnits = fetchedUnits.filter((entry) => entry.IsAssignable);

                if (!isActive) {
                    return;
                }

                setAvailableRoles(activeRoles);
                setAvailableUnits(assignableUnits);
                setRole((currentRole) => currentRole || activeRoles[0]?.RoleName || '');
                setUnitId((currentUnitId) => currentUnitId || assignableUnits[0]?.UnitId || '');
            } catch (err: any) {
                if (isActive) {
                    setError(err.message || 'Unable to load available roles.');
                }
            } finally {
                if (isActive) {
                    setRolesLoading(false);
                }
            }
        };

        void loadRoles();

        return () => {
            isActive = false;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setIsLoading(false);
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            setIsLoading(false);
            return;
        }

        if (!role) {
            setError('Select a role before continuing.');
            setIsLoading(false);
            return;
        }

        if (!unitId) {
            setError('Select an organizational unit before continuing.');
            setIsLoading(false);
            return;
        }

        const usernameError = validateUsername(username.trim());
        if (usernameError) {
            setError(usernameError);
            setIsLoading(false);
            return;
        }

        const firstNameError = validateName('First name', firstName);
        if (firstNameError) {
            setError(firstNameError);
            setIsLoading(false);
            return;
        }

        const middleNameError = validateName('Middle name', middleName, false);
        if (middleNameError) {
            setError(middleNameError);
            setIsLoading(false);
            return;
        }

        const surnameError = validateName('Surname', surname);
        if (surnameError) {
            setError(surnameError);
            setIsLoading(false);
            return;
        }

        const serviceNumberError = validateServiceNumber(serviceNumber);
        if (serviceNumberError) {
            setError(serviceNumberError);
            setIsLoading(false);
            return;
        }

        try {
            const registrationData: InternalRegistrationData = {
                Username: username,
                FirstName: firstName,
                MiddleName: middleName,
                Surname: surname,
                ServiceNumber: serviceNumber,
                UnitId: unitId,
                Email: email,
                Password: password,
                ConfirmPassword: confirmPassword,
                Role: role,
            };
            await registerInternalUser(registrationData);
            // On successful registration, redirect to login page
            router.push('/internal/login'); // Assuming an internal login route exists
        } catch (err: any) {
            setError(err.message || 'Internal user registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Internal User Registration</h2>
                <p className="text-gray-600 mb-6 text-center">Create an account for NIS internal users.</p>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                        <div>
                            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Username</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="john.doe"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="serviceNumber" className="block text-gray-700 text-sm font-bold mb-2">Service Number</label>
                            <input
                                id="serviceNumber"
                                type="text"
                                value={serviceNumber}
                                onChange={(e) => setServiceNumber(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="NIS/HR/00125"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="unitId" className="block text-gray-700 text-sm font-bold mb-2">Organizational Unit</label>
                            <select
                                id="unitId"
                                value={unitId}
                                onChange={(e) => setUnitId(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                disabled={rolesLoading || availableUnits.length === 0}
                                required
                            >
                                <option value="">Select organizational unit</option>
                                {availableUnits.map((entry) => {
                                    const context = entry.ParentUnitName ? `${entry.UnitName} (${entry.ParentUnitName})` : entry.UnitName;
                                    return (
                                        <option key={entry.UnitId} value={entry.UnitId}>
                                            {context}
                                        </option>
                                    );
                                })}
                            </select>
                            {!rolesLoading && availableUnits.length === 0 ? (
                                <p className="mt-2 text-sm text-red-500">No assignable organizational units are available in the backend.</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 mb-4">
                        <div>
                            <label htmlFor="firstName" className="block text-gray-700 text-sm font-bold mb-2">First Name</label>
                            <input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="John"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="middleName" className="block text-gray-700 text-sm font-bold mb-2">Middle Name</label>
                            <input
                                id="middleName"
                                type="text"
                                value={middleName}
                                onChange={(e) => setMiddleName(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Musa"
                            />
                        </div>
                        <div>
                            <label htmlFor="surname" className="block text-gray-700 text-sm font-bold mb-2">Surname</label>
                            <input
                                id="surname"
                                type="text"
                                value={surname}
                                onChange={(e) => setSurname(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Doe"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="user@nis.gov.ng"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="********"
                            required
                        />
                        <p className="text-xs text-gray-500">
                            Use 8+ characters with uppercase, lowercase, number, and special character.
                        </p>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-bold mb-2">Confirm Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="********"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="role" className="block text-gray-700 text-sm font-bold mb-2">Role</label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            disabled={rolesLoading || availableRoles.length === 0}
                            required
                        >
                            {availableRoles.map((entry) => {
                                return (
                                <option key={entry.RoleId} value={entry.RoleName}>
                                    {formatRoleLabel(entry.RoleName)}
                                </option>
                                );
                            })}
                        </select>
                        {!rolesLoading && availableRoles.length === 0 ? (
                            <p className="mt-2 text-sm text-red-500">No active roles are available in the backend.</p>
                        ) : null}
                        {!rolesLoading && availableRoles.length > 0 ? (
                            <p className="mt-2 text-sm text-gray-500">
                                {availableRoles.find((entry) => entry.RoleName === role)?.Description ?? 'Select the backend role to assign.'}
                            </p>
                        ) : null}
                    </div>

                    {error && <p className="text-red-500 text-center text-sm mb-4">{error}</p>}

                    <button
                        type="submit"
                        disabled={isLoading || rolesLoading || availableRoles.length === 0 || availableUnits.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full focus:outline-none focus:shadow-outline transition duration-300"
                    >
                        {rolesLoading ? 'Loading roles...' : isLoading ? 'Registering...' : 'Register'}
                    </button>
                </form>

                <p className="text-center text-gray-600 text-sm mt-4">
                    Already have an account? <Link href="/internal/login" className="text-blue-600 hover:underline">Login here</Link>
                </p>
            </div>
        </div>
    );
};

export default InternalRegisterPage;
