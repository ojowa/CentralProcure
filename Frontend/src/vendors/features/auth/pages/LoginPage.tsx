'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import '../styles/auth.css';
import { vendorLogin } from '../../vendor/services/vendorService';
import { VendorLoginData } from '../../vendor/types/vendor';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Building2,
  ArrowLeft,
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await vendorLogin({ Email: email, Password: password });

      if (response.ErrorMessage) {
        setError(response.ErrorMessage);
        return;
      }

      localStorage.setItem('vendorId', response.VendorId);
      localStorage.setItem('vendorCompanyName', response.CompanyName);
      localStorage.setItem('vendorEmail', response.Email);

      await login({
        UserId: response.VendorId,
        Email: response.Email,
        Role: 'vendor',
      });

      const nextPath =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next')
          : null;
      router.replace(
        nextPath && nextPath.startsWith('/') ? nextPath : '/vendors/dashboard/profile-management'
      );
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vendor-login">
      {/* Background Image */}
      <div className="vendor-login__bg" />

      {/* Content */}
      <div className="vendor-login__content">
        {/* Header */}
        <div className="vendor-login__header">
          <Link href="/vendors" className="vendor-login__back">
            <ArrowLeft className="vendor-login__back-icon" />
            Back to Home
          </Link>
        </div>

        {/* Card */}
        <div className="vendor-login__card">
          {/* Logo */}
          <div className="vendor-login__brand">
            <div className="vendor-login__logo">
              <ShieldCheck className="vendor-login__logo-icon" />
            </div>
            <h1 className="vendor-login__title">Vendor Portal</h1>
            <p className="vendor-login__subtitle">
              Nigeria Immigration Service e-Procurement
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="vendor-login__error">
              <AlertCircle className="vendor-login__error-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="vendor-login__form">
            <div className="vendor-login__field">
              <label htmlFor="email" className="vendor-login__label">
                Email
              </label>
              <div className="vendor-login__input-wrap">
                <Mail className="vendor-login__input-icon" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vendor-login__input"
                  placeholder="you@company.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="vendor-login__field">
              <label htmlFor="password" className="vendor-login__label">
                Password
              </label>
              <div className="vendor-login__input-wrap">
                <Lock className="vendor-login__input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vendor-login__input"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="vendor-login__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="vendor-login__toggle-icon" />
                  ) : (
                    <Eye className="vendor-login__toggle-icon" />
                  )}
                </button>
              </div>
            </div>

            <div className="vendor-login__actions">
              <Link href="/vendors/forgot-password" className="vendor-login__link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="vendor-login__submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="vendor-login__spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="vendor-login__arrow" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="vendor-login__divider">
            <span>or</span>
          </div>

          {/* Register */}
          <Link href="/vendors/register" className="vendor-login__register">
            <Building2 className="vendor-login__register-icon" />
            Create a vendor account
          </Link>
        </div>

        {/* Footer */}
        <div className="vendor-login__footer">
          <p>Nigeria Immigration Service &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
