 'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

const VendorDashboardLayout = ({ children }: { children?: ReactNode }) => {
    const router = useRouter();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        router.push('/vendors/login');
    };

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-gray-100">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-gray-800 text-white shadow-md p-4">
                <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Vendor Dashboard</h2>
                <nav>
                    <ul>
                        <li className="mb-2">
                            <Link href="/vendors/dashboard/profile-management" className="block py-2 px-3 rounded hover:bg-gray-700 transition duration-200">
                                Profile Management
                            </Link>
                        </li>
                        <li className="mb-2">
                            <Link href="/vendors/dashboard/compliance-documents" className="block py-2 px-3 rounded hover:bg-gray-700 transition duration-200">
                                Compliance Documents
                            </Link>
                        </li>
                        <li className="mb-2">
                            <Link href="/vendors/dashboard/tender-listings" className="block py-2 px-3 rounded hover:bg-gray-700 transition duration-200">
                                Tender Listings
                            </Link>
                        </li>
                        <li className="mb-2">
                            <Link href="/vendors/dashboard/submitted-bids" className="block py-2 px-3 rounded hover:bg-gray-700 transition duration-200">
                                Submitted Bids Status
                            </Link>
                        </li>
                        {/* Add logout or other dashboard-specific links */}
                        <li className="mt-4 border-t border-gray-700 pt-4">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="block w-full text-left py-2 px-3 rounded bg-red-600 hover:bg-red-700 transition duration-200"
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-grow p-6 md:p-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default VendorDashboardLayout;
