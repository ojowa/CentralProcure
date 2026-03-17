'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginInternalUser } from '../services/internalAuthService';
import { useAuth } from '../hooks/useAuth';
import { RoleKey } from '../types/internal';

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
    remember: true
  });

  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
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
      const response = await loginInternalUser({ Email: identifier, Password: form.password });

      if (!response.Role) {
        throw new Error('Login succeeded, but no internal role was returned for this account.');
      }

      login({
        email: response.Email ?? identifier,
        role: response.Role as RoleKey
      });

      router.push('/internal/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Unable to sign in. Try again.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="nis-login-page">
      <header className="nis-topbar">
        <div className="nis-container nis-topbar__inner">
          <div className="nis-brand">
            <div className="nis-brand__logo" aria-hidden="true">
              NIS
            </div>
            <div className="nis-brand__text">
              <div className="nis-brand__title">Nigeria Immigration Service</div>
              <div className="nis-brand__subtitle">e-Procurement Portal</div>
            </div>
          </div>

        </div>
      </header>

      <div className="nis-flagband" aria-hidden="true" />

      <main className="nis-main">
        <div className="nis-container nis-main__grid">
          <section className="nis-login-card" aria-labelledby="loginTitle">
            <div className="nis-login-card__head">
              <div className="nis-badge" aria-hidden="true">
                <span className="nis-badge__icon">🔒</span>
                <span className="nis-badge__text">Secure Login</span>
              </div>

              <h1 id="loginTitle" className="nis-login-title">Login to eProcurement</h1>
              <p className="nis-login-subtitle">
                Sign in to access internal procurement workflows and approvals.
              </p>
            </div>

            <form className="nis-form" onSubmit={onSubmit} noValidate>
              <label className="nis-field">
                <span className="nis-field__label">Email / Username / Service Number</span>
                <input
                  className="nis-input"
                  type="text"
                  name="usernameOrEmail"
                  autoComplete="username"
                  placeholder="Enter email, username, or service number"
                  value={form.usernameOrEmail}
                  onChange={(e) => update('usernameOrEmail', e.target.value)}
                />
              </label>

              <label className="nis-field">
                <span className="nis-field__label">Password</span>
                <div className="nis-inputwrap">
                  <input
                    className="nis-input nis-input--withbtn"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                  />
                  <button
                    type="button"
                    className="nis-ghostbtn"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <div className="nis-row">
                <label className="nis-check">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) => update('remember', e.target.checked)}
                  />
                  <span>Remember Me</span>
                </label>

                <Link className="nis-link" href="/internal/forgot-password">Forgot Password?</Link>
              </div>

              {errorMessage ? <div className="nis-alert">{errorMessage}</div> : null}

              <button type="submit" className="nis-btn" disabled={!canSubmit}>
                {status === 'submitting' ? 'Signing in...' : 'Login'}
              </button>

              <div className="nis-divider" role="separator" aria-label="divider" />

              <div className="nis-bottomlinks">
                <div className="nis-bottomlinks__row">
                  <span>Not registered?</span>
                  <Link className="nis-link" href="/support">Request access</Link>
                </div>
                <div className="nis-bottomlinks__row">
                  <span>Need help?</span>
                  <Link className="nis-link" href="/support">Support & FAQs</Link>
                </div>
              </div>
            </form>
          </section>

          <aside className="nis-side">
            <div className="nis-sidecard">
              <h2 className="nis-sidecard__title">Login Tips</h2>
              <ul className="nis-sidecard__list">
                <li>Use your official NIS email, username, or service number.</li>
                <li>Passwords are case sensitive.</li>
                <li>If locked out, use Forgot Password or contact Support.</li>
              </ul>
              <div className="nis-sidecard__note">
                Secure access controls and audit logging are enabled for accountability.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="nis-footer">
        <div className="nis-container nis-footer__inner">
          <div className="nis-footer__links">
            <Link href="/about">About NIS</Link>
            <Link href="/terms">Terms & Conditions</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/contact">Contact Support</Link>
          </div>
          <div className="nis-footer__copy">
            {new Date().getFullYear()} Nigeria Immigration Service. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
