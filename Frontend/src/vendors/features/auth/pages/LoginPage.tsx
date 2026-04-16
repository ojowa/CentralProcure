'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { vendorLogin } from '../../vendor/services/vendorService';
import { VendorLoginData } from '../../vendor/types/vendor';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  FileText,
  TrendingUp,
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const stats = [
    { label: 'Active Tenders', value: '24', icon: FileText },
    { label: 'Registered Vendors', value: '1,247', icon: Building2 },
    { label: 'Contracts Awarded', value: '89', icon: TrendingUp },
  ];

  const features = [
    'Access exclusive procurement opportunities',
    'Submit bids securely online',
    'Track your submissions in real-time',
    'Manage compliance documents',
  ];

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
    <div className="auth-page">
      <div className="auth-page__container">
        {/* Left Side - Visual */}
        <div className="auth-page__visual">
          <div className="auth-page__visual-content">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="auth-page__logo">
                <Shield className="auth-page__logo-icon" />
                <span className="auth-page__logo-text">NIS e-Procurement</span>
              </div>

              <h2 className="auth-page__visual-title">
                Welcome to the Vendor Portal
              </h2>
              <p className="auth-page__visual-text">
                Access procurement opportunities and manage your bids through our secure,
                transparent digital platform.
              </p>

              <ul className="auth-page__visual-features">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                  >
                    <CheckCircle className="auth-page__feature-icon" />
                    <span>{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="auth-page__stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              {stats.map((stat, index) => (
                <div key={stat.label} className="auth-page__stat-item">
                  <div className="auth-page__stat-value">{stat.value}</div>
                  <div className="auth-page__stat-label">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-page__form-wrapper">
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="auth-card__header">
              <div className="auth-card__icon">
                <div className="auth-card__icon-bg">
                  <Lock className="auth-card__icon-svg" />
                </div>
              </div>
              <h1 className="auth-card__title">Vendor Login</h1>
              <p className="auth-card__subtitle">
                Sign in to access your vendor dashboard
              </p>
            </div>

            {error && (
              <motion.div
                className="auth-alert auth-alert--error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle className="auth-alert__icon" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-form__field">
                <label htmlFor="email" className="auth-form__label">
                  Email Address
                </label>
                <div className="auth-form__input-wrapper">
                  <Mail className="auth-form__input-icon" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-form__input"
                    placeholder="your.email@company.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="auth-form__field">
                <label htmlFor="password" className="auth-form__label">
                  Password
                </label>
                <div className="auth-form__input-wrapper">
                  <Lock className="auth-form__input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-form__input auth-form__input--with-toggle"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="auth-form__toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="auth-form__toggle-icon" />
                    ) : (
                      <Eye className="auth-form__toggle-icon" />
                    )}
                  </button>
                </div>
              </div>

              <div className="auth-form__options">
                <Link
                  href="/vendors/forgot-password"
                  className="auth-form__forgot-link"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="auth-form__submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="auth-form__submit-icon auth-form__submit-icon--spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="auth-form__submit-icon" />
                  </>
                )}
              </button>
            </form>

            <div className="auth-card__divider">
              <span className="auth-card__divider-text">New to the portal?</span>
            </div>

            <div className="auth-card__footer">
              <Link href="/vendors/register" className="auth-card__secondary-btn">
                <Building2 className="auth-card__secondary-icon" />
                <span>Register your organization</span>
                <ArrowRight className="auth-card__secondary-arrow" />
              </Link>
            </div>

            <div className="auth-card__back">
              <Link href="/vendors" className="auth-card__back-link">
                ← Back to homepage
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
