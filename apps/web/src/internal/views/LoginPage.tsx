'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loginInternalUser } from '../services/internalAuthService';
import { useAuth } from '../hooks/useAuth';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';

type LoginForm = {
  usernameOrEmail: string;
  password: string;
  remember: boolean;
};

function isProbablyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginPage() {
  const [form, setForm] = useState<LoginForm>({
    usernameOrEmail: '',
    password: '',
    remember: true,
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  function update<K extends keyof LoginForm>(key: K, value: LoginForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage('');
  }

  function validate(values: LoginForm): string {
    const identifier = values.usernameOrEmail.trim();

    if (!identifier) {
      return 'Email, username, or service number is required.';
    }

    if (identifier.includes('@') && !isProbablyEmail(identifier)) {
      return 'Enter a valid email address.';
    }

    if (!identifier.includes('@') && identifier.length < 3) {
      return 'Username or service number must be at least 3 characters.';
    }

    if (!values.password) {
      return 'Password is required.';
    }

    if (values.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return '';
  }

  const canSubmit = useMemo(() => {
    const uOk = form.usernameOrEmail.trim().length > 0;
    const pOk = form.password.length >= 6;
    return uOk && pOk && status !== 'submitting';
  }, [form.usernameOrEmail, form.password, status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validate(form);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const identifier = form.usernameOrEmail.trim();

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await loginInternalUser({
        Email: identifier,
        Password: form.password,
      });

      if (!response.Role) {
        throw new Error(
          'Login succeeded, but no internal role was returned for this account.'
        );
      }

      setStatus('success');
      login({
        email: response.Email ?? identifier,
        role: response.Role,
        jwtToken: response.Token,
      });

      setTimeout(() => {
        router.push('/internal/dashboard');
      }, 500);
    } catch (err: any) {
      setStatus('idle');
      setErrorMessage(err?.message ?? 'Unable to sign in. Try again.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-green-700 shadow-md">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="text-lg font-bold text-slate-900">
                  Nigeria Immigration Service
                </div>
                <div className="text-xs text-slate-500 -mt-1">
                  eProcurement Portal
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <span>+234 123 456 7890</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-600" />
                <span>support@nis.gov.ng</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Login Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Internal Staff Login
                    </h2>
                    <p className="text-emerald-100 text-sm">
                      Access your procurement dashboard
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-8">
                {status === 'success' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      Login Successful!
                    </h3>
                    <p className="text-slate-600">
                      Redirecting you to your dashboard...
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-6">
                    {/* Username/Email Field */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email / Username / Service Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={form.usernameOrEmail}
                          onChange={(e) =>
                            update('usernameOrEmail', e.target.value)
                          }
                          className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-slate-900 placeholder:text-slate-400"
                          placeholder="Enter your credentials"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => update('password', e.target.value)}
                          className="block w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-slate-900 placeholder:text-slate-400"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.remember}
                          onChange={(e) => update('remember', e.target.checked)}
                          className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-600">
                          Remember me
                        </span>
                      </label>
                      <Link
                        href="/internal/forgot-password"
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200"
                      >
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{errorMessage}</span>
                      </motion.div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={!canSubmit || status === 'submitting'}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {status === 'submitting' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Form Footer */}
              <div className="bg-slate-50 px-8 py-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>Not registered?</span>
                    <Link
                      href="/support"
                      className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Request access
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>Need help?</span>
                    <Link
                      href="/support"
                      className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Contact support
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Info & Tips */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="space-y-8">
              {/* Welcome Message */}
              <div className="bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl p-8 text-white shadow-xl">
                <h2 className="text-3xl font-bold mb-4">
                  Welcome to the Internal Portal
                </h2>
                <p className="text-emerald-100 text-lg leading-relaxed">
                  Manage procurement workflows, review submissions, and oversee
                  the entire procurement lifecycle from a single secure
                  platform.
                </p>
              </div>

              {/* Login Tips */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-emerald-600" />
                  Secure Login Tips
                </h3>
                <ul className="space-y-4">
                  {[
                    'Use your official NIS email, username, or service number',
                    'Passwords are case sensitive and must be at least 6 characters',
                    'If locked out, use the Forgot Password link or contact Support',
                    'All login attempts are logged for security purposes',
                  ].map((tip, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-start gap-3 text-slate-600"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Security Note */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Shield className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-900 mb-1">
                      Security Notice
                    </h4>
                    <p className="text-sm text-emerald-700">
                      This portal uses enterprise-grade security with audit
                      logging. All activities are tracked and monitored for
                      accountability.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-500">
              © {new Date().getFullYear()} Nigeria Immigration Service. All
              rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/about"
                className="text-slate-600 hover:text-emerald-600 transition-colors"
              >
                About NIS
              </Link>
              <Link
                href="/terms"
                className="text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/contact"
                className="text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
