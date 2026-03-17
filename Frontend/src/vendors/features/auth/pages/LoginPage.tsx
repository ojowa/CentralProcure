'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { vendorLogin } from '../../vendor/services/vendorService';
import { VendorLoginData } from '../../vendor/types/vendor';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Call the vendor login API with credentials object
            const response = await vendorLogin({ Email: email, Password: password });
            
            if (response.ErrorMessage) {
                setError(response.ErrorMessage);
                return;
            }

            // Store vendor info in localStorage for display (non-sensitive)
            localStorage.setItem('vendorId', response.VendorId);
            localStorage.setItem('vendorCompanyName', response.CompanyName);
            localStorage.setItem('vendorEmail', response.Email);
            
            // Set authenticated state immediately from the successful login result.
            await login({
                UserId: response.VendorId,
                Email: response.Email,
                Role: 'vendor'
            });
            
            const nextPath =
                typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('next')
                    : null;
            router.push(nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard/profile-management');
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Vendor Login</h2>
                <p className="text-gray-600 mb-6 text-center">Access your e-Procurement dashboard.</p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="your.email@example.com"
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
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="********"
                            required
                        />
                    </div>

                    {error && <p className="text-red-500 text-center text-sm mb-4">{error}</p>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full focus:outline-none focus:shadow-outline transition duration-300"
                    >
                        {isLoading ? 'Logging In...' : 'Login'}
                    </button>
                </form>

                <p className="text-center text-gray-600 text-sm mt-4">
                    Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Register here</Link>
                </p>
                <p className="text-center text-gray-600 text-sm mt-2">
                    <Link href="/forgot-password" className="text-blue-600 hover:underline">Forgot Password?</Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
