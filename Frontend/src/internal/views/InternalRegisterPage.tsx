'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InternalRegistrationData, InternalRoleRecord } from '../types/internal';
import { fetchInternalRoles, registerInternalUser } from '../services/internalAuthService';

const formatRoleLabel = (roleName: string): string =>
    roleName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();

const InternalRegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // New state for confirmation
    const [role, setRole] = useState('');
    const [availableRoles, setAvailableRoles] = useState<InternalRoleRecord[]>([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let isActive = true;

        const loadRoles = async () => {
            try {
                const fetchedRoles = await fetchInternalRoles();
                const activeRoles = fetchedRoles.filter((entry) => entry.IsActive);

                if (!isActive) {
                    return;
                }

                setAvailableRoles(activeRoles);
                setRole((currentRole) => currentRole || activeRoles[0]?.RoleName || '');
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

        if (!role) {
            setError('Select a role before continuing.');
            setIsLoading(false);
            return;
        }

        try {
            const registrationData: InternalRegistrationData = {
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
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Internal User Registration</h2>
                <p className="text-gray-600 mb-6 text-center">Create an account for NIS internal users.</p>

                <form onSubmit={handleSubmit}>
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
                        disabled={isLoading || rolesLoading || availableRoles.length === 0}
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
