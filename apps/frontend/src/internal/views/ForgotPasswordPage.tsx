'use client';

import Link from 'next/link';

const passwordRules = [
  'Use at least 8 characters.',
  'Include uppercase and lowercase letters.',
  'Include at least one number.',
  'Include at least one special character.'
];

export default function ForgotPasswordPage() {
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
          <section className="nis-login-card" aria-labelledby="forgotTitle">
            <div className="nis-login-card__head">
              <div className="nis-badge" aria-hidden="true">
                <span className="nis-badge__icon">🔐</span>
                <span className="nis-badge__text">Internal Password Help</span>
              </div>
              <h1 id="forgotTitle" className="nis-login-title">Internal Password Support</h1>
              <p className="nis-login-subtitle">
                Internal user passwords now use a stricter security policy. If your old password stops working, retry once and then contact the ICT administrator for assisted reset.
              </p>
            </div>

            <div className="nis-sidecard" style={{ marginTop: '24px' }}>
              <h2 className="nis-sidecard__title">Password Rules</h2>
              <ul className="nis-sidecard__list">
                {passwordRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <div className="nis-sidecard__note">
                Legacy internal passwords are upgraded automatically on successful sign-in. If you still cannot sign in, request a reset from an internal administrator.
              </div>
            </div>

            <div className="nis-bottomlinks" style={{ marginTop: '24px' }}>
              <div className="nis-bottomlinks__row">
                <span>Return to sign in</span>
                <Link className="nis-link" href="/internal/login">Internal Login</Link>
              </div>
              <div className="nis-bottomlinks__row">
                <span>Need assisted reset?</span>
                <Link className="nis-link" href="/support">Contact Support</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
