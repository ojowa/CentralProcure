'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VendorRegistrationData } from '../../vendor/types/vendor';
import { checkVendorAvailability, registerVendor } from '../../vendor/services/vendorService';
import { useDebouncedAvailability } from '../hooks/useDebouncedAvailability';
import '../styles/auth.css';
import {
    CheckCircle,
    XCircle,
    Loader2,
    Eye,
    EyeOff,
    Building2,
    Mail,
    Phone,
    User,
    Lock,
    FileText,
    ArrowRight,
    Shield
} from 'lucide-react';

// Password requirements configuration
const PASSWORD_REQUIREMENTS = [
    { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { key: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { key: 'number', label: 'At least one number', test: (p: string) => /[0-9]/.test(p) },
    { key: 'special', label: 'One special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
] as const;

// Validation constants
const VALIDATION = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^\+?[0-9 ()-]{7,20}$/,
    MIN_COMPANY_NAME: 2,
    MAX_COMPANY_NAME: 100,
    MIN_REGISTRATION_NUMBER: 3,
    MAX_REGISTRATION_NUMBER: 50,
    MIN_TAX_ID: 3,
    MAX_TAX_ID: 50,
    MIN_ADDRESS: 10,
    MAX_ADDRESS: 500,
    MIN_CONTACT_PERSON: 2,
    MAX_CONTACT_PERSON: 100,
    DEBOUNCE_MS: 500,
} as const;

// Form section component for better organization
const FormSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, children }) => (
    <div className="app-form-section">
        <div className="app-form-section__header">
            <span className="app-form-section__icon">{icon}</span>
            <h3 className="app-form-section__title">{title}</h3>
        </div>
        <div className="app-form-section__content">{children}</div>
    </div>
);

// Form field component with consistent styling
interface FormFieldProps {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
    availability?: {
        status: 'idle' | 'loading' | 'available' | 'unavailable' | 'error';
        message?: string;
    };
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    htmlFor,
    error,
    hint,
    children,
    availability
}) => {
    const getAvailabilityIcon = () => {
        switch (availability?.status) {
            case 'loading':
                return <Loader2 className="app-field__availability-icon app-field__availability-icon--loading" />;
            case 'available':
                return <CheckCircle className="app-field__availability-icon app-field__availability-icon--success" />;
            case 'unavailable':
                return <XCircle className="app-field__availability-icon app-field__availability-icon--error" />;
            default:
                return null;
        }
    };

    return (
        <div className="app-form-field">
            <label htmlFor={htmlFor} className="app-form-field__label">
                {label}
            </label>
            <div className="app-form-field__input-wrapper">
                {children}
                {availability && (
                    <span className="app-form-field__availability">{getAvailabilityIcon()}</span>
                )}
            </div>
            {error && <p className="app-form-field__error">{error}</p>}
            {!error && availability?.message && (
                <p className={`app-form-field__hint app-form-field__hint--${availability.status}`}>
                    {availability.message}
                </p>
            )}
            {!error && !availability?.message && hint && (
                <p className="app-form-field__hint">{hint}</p>
            )}
        </div>
    );
};

// Password strength indicator
const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
    const checks = useMemo(() =>
        PASSWORD_REQUIREMENTS.map(req => ({
            ...req,
            valid: req.test(password)
        })),
        [password]
    );

    const strength = useMemo(() => {
        const validCount = checks.filter(c => c.valid).length;
        if (validCount === 0) return { level: 0, label: 'Enter password' };
        if (validCount <= 2) return { level: 1, label: 'Weak', color: '#dc2626' };
        if (validCount <= 4) return { level: 2, label: 'Fair', color: '#ca8a04' };
        return { level: 3, label: 'Strong', color: '#16a34a' };
    }, [checks]);

    return (
        <div className="password-strength">
            <div className="password-strength__meter">
                <div
                    className="password-strength__fill"
                    style={{
                        width: `${(strength.level / 3) * 100}%`,
                        backgroundColor: strength.color
                    }}
                />
            </div>
            <div className="password-strength__requirements">
                {checks.map(check => (
                    <span
                        key={check.key}
                        className={`password-strength__requirement ${check.valid ? 'password-strength__requirement--met' : ''}`}
                    >
                        <CheckCircle className="password-strength__icon" />
                        {check.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

// Password visibility toggle button
const PasswordToggle: React.FC<{
    visible: boolean;
    onToggle: () => void;
}> = ({ visible, onToggle }) => (
    <button
        type="button"
        className="password-toggle"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
    >
        {visible ? <EyeOff className="password-toggle__icon" /> : <Eye className="password-toggle__icon" />}
    </button>
);

const RegisterPage: React.FC = () => {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        control
    } = useForm<VendorRegistrationData>({
        mode: 'onBlur',
        reValidateMode: 'onChange'
    });

    // Watch password for strength indicator
    const passwordValue = useWatch({ control, name: 'Password', defaultValue: '' });

    // Debounced availability checks - cost effective validation
    const emailAvailability = useDebouncedAvailability({
        field: 'email',
        checkFn: checkVendorAvailability,
        debounceMs: VALIDATION.DEBOUNCE_MS,
        validateBeforeCheck: (value) => {
            if (!value) return 'Email is required';
            if (!VALIDATION.EMAIL_REGEX.test(value)) return 'Please enter a valid email address';
            return null;
        }
    });

    const registrationAvailability = useDebouncedAvailability({
        field: 'registrationNumber',
        checkFn: checkVendorAvailability,
        debounceMs: VALIDATION.DEBOUNCE_MS,
        validateBeforeCheck: (value) => {
            if (!value) return 'Registration number is required';
            if (value.length < VALIDATION.MIN_REGISTRATION_NUMBER) return `Registration number must be at least ${VALIDATION.MIN_REGISTRATION_NUMBER} characters`;
            return null;
        }
    });

    const taxIdAvailability = useDebouncedAvailability({
        field: 'taxId',
        checkFn: checkVendorAvailability,
        debounceMs: VALIDATION.DEBOUNCE_MS,
        validateBeforeCheck: (value) => {
            if (!value) return 'Tax ID is required';
            if (value.length < VALIDATION.MIN_TAX_ID) return `Tax ID must be at least ${VALIDATION.MIN_TAX_ID} characters`;
            return null;
        }
    });

    // Password validation
    const validatePassword = useCallback((value: string): true | string => {
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must include a number';
        if (!/[^a-zA-Z0-9]/.test(value)) return 'Password must include a special character';
        return true;
    }, []);

    // Form submission handler
    const onSubmit = useCallback(async (data: VendorRegistrationData) => {
        setServerError(null);

        // Final availability check before submission
        if (emailAvailability.status === 'unavailable' ||
            registrationAvailability.status === 'unavailable' ||
            taxIdAvailability.status === 'unavailable') {
            setServerError('Some fields are already registered. Please update them and try again.');
            return;
        }

        // Wait for any pending availability checks
        if (emailAvailability.status === 'loading' ||
            registrationAvailability.status === 'loading' ||
            taxIdAvailability.status === 'loading') {
            setServerError('Please wait for availability checks to complete.');
            return;
        }

        // Manual password match validation (react-hook-form validate runs before availability)
        if (data.Password !== data.ConfirmPassword) {
            setFormError('ConfirmPassword', { message: 'Passwords do not match' });
            return;
        }

        try {
            await registerVendor(data);
            setRegistrationSuccess(true);
        } catch (error: any) {
            setServerError(error.message || 'Registration failed. Please try again.');
        }
    }, [emailAvailability.status, registrationAvailability.status, taxIdAvailability.status, setFormError]);

    // Success screen
    if (registrationSuccess) {
        return (
            <div className="auth-success">
                <div className="auth-success__card">
                    <div className="auth-success__icon">
                        <CheckCircle />
                    </div>
                    <h2 className="auth-success__title">Registration Successful!</h2>
                    <p className="auth-success__message">
                        Your vendor account has been created and is awaiting procurement approval.
                    </p>
                    <p className="auth-success__submessage">
                        You will be able to sign in after your account is activated.
                    </p>
                    <button
                        onClick={() => router.push('/vendors')}
                        className="app-btn app-btn--primary app-btn--lg"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-page__container">
                {/* Left side - decorative */}
                <div className="auth-page__visual">
                    <div className="auth-page__visual-content">
                        <Shield className="auth-page__visual-icon" />
                        <h2 className="auth-page__visual-title">Join Our Vendor Network</h2>
                        <p className="auth-page__visual-text">
                            Register your company to access procurement opportunities and grow your business
                            with eProcurement.
                        </p>
                        <ul className="auth-page__visual-features">
                            <li><CheckCircle /> Access exclusive tenders</li>
                            <li><CheckCircle /> Streamlined bidding process</li>
                            <li><CheckCircle /> Real-time notifications</li>
                            <li><CheckCircle /> Secure document management</li>
                        </ul>
                    </div>
                </div>

                {/* Right side - form */}
                <div className="auth-page__form-wrapper">
                    <div className="auth-card">
                        <div className="auth-card__header">
                            <h1 className="auth-card__title">Create Your Account</h1>
                            <p className="auth-card__subtitle">
                                Fill in the details below to register as a vendor
                            </p>
                        </div>

                        {serverError && (
                            <div className="auth-alert auth-alert--error">
                                <XCircle className="auth-alert__icon" />
                                <span>{serverError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
                            {/* Company Information */}
                            <FormSection title="Company Information" icon={<Building2 />}>
                                <FormField
                                    label="Company Name"
                                    htmlFor="companyName"
                                    error={errors.CompanyName?.message}
                                    hint="Enter your registered company name"
                                >
                                    <input
                                        id="companyName"
                                        type="text"
                                        className={`app-form__input ${errors.CompanyName ? 'app-form__input--error' : ''}`}
                                        {...register('CompanyName', {
                                            required: 'Company name is required',
                                            minLength: { value: VALIDATION.MIN_COMPANY_NAME, message: `Minimum ${VALIDATION.MIN_COMPANY_NAME} characters` },
                                            maxLength: { value: VALIDATION.MAX_COMPANY_NAME, message: `Maximum ${VALIDATION.MAX_COMPANY_NAME} characters` }
                                        })}
                                    />
                                </FormField>

                                <FormField
                                    label="Registration Number (CAC)"
                                    htmlFor="registrationNumber"
                                    error={errors.RegistrationNumber?.message}
                                    availability={registrationAvailability.status !== 'idle' ? {
                                        status: registrationAvailability.status,
                                        message: registrationAvailability.message
                                    } : undefined}
                                >
                                    <input
                                        id="registrationNumber"
                                        type="text"
                                        className={`app-form__input ${errors.RegistrationNumber ? 'app-form__input--error' : ''}`}
                                        {...register('RegistrationNumber', {
                                            required: 'Registration number is required',
                                            onBlur: (e) => registrationAvailability.check(e.target.value)
                                        })}
                                    />
                                </FormField>

                                <FormField
                                    label="Tax Identification Number (TIN)"
                                    htmlFor="taxId"
                                    error={errors.TaxId?.message}
                                    availability={taxIdAvailability.status !== 'idle' ? {
                                        status: taxIdAvailability.status,
                                        message: taxIdAvailability.message
                                    } : undefined}
                                >
                                    <input
                                        id="taxId"
                                        type="text"
                                        className={`app-form__input ${errors.TaxId ? 'app-form__input--error' : ''}`}
                                        {...register('TaxId', {
                                            required: 'Tax ID is required',
                                            onBlur: (e) => taxIdAvailability.check(e.target.value)
                                        })}
                                    />
                                </FormField>

                                <FormField
                                    label="Company Address"
                                    htmlFor="companyAddress"
                                    error={errors.CompanyAddress?.message}
                                    hint="Full registered business address"
                                >
                                    <textarea
                                        id="companyAddress"
                                        rows={3}
                                        className={`app-form__textarea ${errors.CompanyAddress ? 'app-form__input--error' : ''}`}
                                        {...register('CompanyAddress', {
                                            required: 'Company address is required',
                                            minLength: { value: VALIDATION.MIN_ADDRESS, message: `Address must be at least ${VALIDATION.MIN_ADDRESS} characters` },
                                            maxLength: { value: VALIDATION.MAX_ADDRESS, message: `Address must not exceed ${VALIDATION.MAX_ADDRESS} characters` }
                                        })}
                                    />
                                </FormField>
                            </FormSection>

                            {/* Contact Information */}
                            <FormSection title="Contact Information" icon={<User />}>
                                <FormField
                                    label="Contact Person"
                                    htmlFor="contactPerson"
                                    error={errors.ContactPerson?.message}
                                    hint="Primary contact for your company"
                                >
                                    <input
                                        id="contactPerson"
                                        type="text"
                                        className={`app-form__input ${errors.ContactPerson ? 'app-form__input--error' : ''}`}
                                        {...register('ContactPerson', {
                                            required: 'Contact person is required',
                                            minLength: { value: VALIDATION.MIN_CONTACT_PERSON, message: `Minimum ${VALIDATION.MIN_CONTACT_PERSON} characters` },
                                            maxLength: { value: VALIDATION.MAX_CONTACT_PERSON, message: `Maximum ${VALIDATION.MAX_CONTACT_PERSON} characters` }
                                        })}
                                    />
                                </FormField>

                                <FormField
                                    label="Phone Number"
                                    htmlFor="phoneNumber"
                                    error={errors.PhoneNumber?.message}
                                    hint="Include country code if applicable (e.g., +234)"
                                >
                                    <div className="app-input-with-icon">
                                        <Phone className="app-input-with-icon__icon" />
                                        <input
                                            id="phoneNumber"
                                            type="tel"
                                            className={`app-form__input app-form__input--with-icon ${errors.PhoneNumber ? 'app-form__input--error' : ''}`}
                                            {...register('PhoneNumber', {
                                                required: 'Phone number is required',
                                                pattern: {
                                                    value: VALIDATION.PHONE_REGEX,
                                                    message: 'Please enter a valid phone number'
                                                }
                                            })}
                                        />
                                    </div>
                                </FormField>

                                <FormField
                                    label="Email Address"
                                    htmlFor="email"
                                    error={errors.Email?.message}
                                    hint="This will be your username for login"
                                    availability={emailAvailability.status !== 'idle' ? {
                                        status: emailAvailability.status,
                                        message: emailAvailability.message
                                    } : undefined}
                                >
                                    <div className="app-input-with-icon">
                                        <Mail className="app-input-with-icon__icon" />
                                        <input
                                            id="email"
                                            type="email"
                                            className={`app-form__input app-form__input--with-icon ${errors.Email ? 'app-form__input--error' : ''}`}
                                            {...register('Email', {
                                                required: 'Email is required',
                                                pattern: {
                                                    value: VALIDATION.EMAIL_REGEX,
                                                    message: 'Please enter a valid email address'
                                                },
                                                onBlur: (e) => emailAvailability.check(e.target.value)
                                            })}
                                        />
                                    </div>
                                </FormField>
                            </FormSection>

                            {/* Security */}
                            <FormSection title="Security" icon={<Lock />}>
                                <FormField
                                    label="Password"
                                    htmlFor="password"
                                    error={errors.Password?.message}
                                >
                                    <div className="app-input-with-icon app-input-with-icon--right">
                                        <Lock className="app-input-with-icon__icon" />
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            className={`app-form__input app-form__input--with-icon ${errors.Password ? 'app-form__input--error' : ''}`}
                                            {...register('Password', {
                                                required: 'Password is required',
                                                validate: validatePassword
                                            })}
                                        />
                                        <PasswordToggle
                                            visible={showPassword}
                                            onToggle={() => setShowPassword(!showPassword)}
                                        />
                                    </div>
                                    <PasswordStrength password={passwordValue} />
                                </FormField>

                                <FormField
                                    label="Confirm Password"
                                    htmlFor="confirmPassword"
                                    error={errors.ConfirmPassword?.message}
                                >
                                    <div className="app-input-with-icon app-input-with-icon--right">
                                        <Lock className="app-input-with-icon__icon" />
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            className={`app-form__input app-form__input--with-icon ${errors.ConfirmPassword ? 'app-form__input--error' : ''}`}
                                            {...register('ConfirmPassword', {
                                                required: 'Please confirm your password',
                                                validate: (value) => value === passwordValue || 'Passwords do not match'
                                            })}
                                        />
                                        <PasswordToggle
                                            visible={showConfirmPassword}
                                            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                                        />
                                    </div>
                                </FormField>
                            </FormSection>

                            {/* Document Notice */}
                            <div className="auth-notice">
                                <FileText className="auth-notice__icon" />
                                <div className="auth-notice__content">
                                    <h4 className="auth-notice__title">Statutory Documents</h4>
                                    <p className="auth-notice__text">
                                        After registration, you will be required to upload compliance documents
                                        from your vendor dashboard before you can start bidding.
                                    </p>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="auth-form__actions">
                                <button
                                    type="submit"
                                    disabled={isSubmitting ||
                                        emailAvailability.status === 'loading' ||
                                        registrationAvailability.status === 'loading' ||
                                        taxIdAvailability.status === 'loading'}
                                    className="app-btn app-btn--primary app-btn--lg app-btn--full"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="app-btn__spinner" />
                                            Creating Account...
                                        </>
                                    ) : (
                                        <>
                                            Create Account
                                            <ArrowRight className="app-btn__icon" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        <div className="auth-card__footer">
                            <p className="auth-card__footer-text">
                                Already have an account?{' '}
                                <Link href="/vendors/login" className="auth-card__link">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
