'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginInternalUser } from '../services/internalAuthService';
import { useAuth } from '../hooks/useAuth';
import '../../vendors/features/auth/styles/auth.css';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
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
      }, 700);
    } catch (err: any) {
      setStatus('idle');
      setErrorMessage(err?.message ?? 'Unable to sign in. Try again.');
    }
  }

  return (
    <div className="vendor-login">
      {/* Background Image */}
      <div className="vendor-login__bg" />

      {/* Content */}
      <div className="vendor-login__content">
        {/* Card */}
        <div className="vendor-login__card">
          {/* Logo */}
          <div className="vendor-login__brand">
            <div className="vendor-login__logo">
              <ShieldCheck className="vendor-login__logo-icon" />
            </div>
            <h1 className="vendor-login__title">Internal Staff Portal</h1>
            <p className="vendor-login__subtitle">
              Nigeria Immigration Service e-Procurement
            </p>
          </div>

          {status === 'success' ? (
            <div className="vendor-login__success">
              <div className="vendor-login__success-icon-wrap">
                <CheckCircle2 className="vendor-login__success-icon" />
              </div>
              <h2 className="vendor-login__success-title">Login Successful!</h2>
              <p className="vendor-login__success-text">
                Redirecting you to your dashboard...
              </p>
            </div>
          ) : (
            <>
              {/* Error */}
              {errorMessage && (
                <div className="vendor-login__error">
                  <AlertCircle className="vendor-login__error-icon" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={onSubmit} className="vendor-login__form">
                <div className="vendor-login__field">
                  <label htmlFor="usernameOrEmail" className="vendor-login__label">
                    Email / Username / Service Number
                  </label>
                  <div className="vendor-login__input-wrap">
                    <User className="vendor-login__input-icon" />
                    <input
                      id="usernameOrEmail"
                      type="text"
                      value={form.usernameOrEmail}
                      onChange={(e) => update('usernameOrEmail', e.target.value)}
                      className="vendor-login__input"
                      placeholder="Enter your credentials"
                      required
                      disabled={status === 'submitting'}
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
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      className="vendor-login__input"
                      placeholder="••••••••"
                      required
                      disabled={status === 'submitting'}
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

                <div className="vendor-login__remember-row">
                  <label className="vendor-login__remember">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={(e) => update('remember', e.target.checked)}
                      className="vendor-login__remember-check"
                    />
                    <span>Remember me</span>
                  </label>
                  <Link href="/internal/forgot-password" className="vendor-login__link">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="vendor-login__submit"
                >
                  {status === 'submitting' ? (
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
            </>
          )}

          {/* Divider */}
          {status !== 'success' && (
            <div className="vendor-login__divider">
              <span>or</span>
            </div>
          )}

          {/* Request Access */}
          {status !== 'success' && (
            <Link href="/support" className="vendor-login__register">
              <ShieldCheck className="vendor-login__register-icon" />
              Request staff access
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="vendor-login__footer">
          <p>Nigeria Immigration Service &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
