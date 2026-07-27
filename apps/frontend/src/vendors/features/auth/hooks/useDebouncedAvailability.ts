'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CheckVendorAvailabilityFunction } from '../../vendor/services/vendorService';

interface UseDebouncedAvailabilityOptions {
    field: 'email' | 'registrationNumber' | 'taxId';
    checkFn: CheckVendorAvailabilityFunction;
    debounceMs: number;
    validateBeforeCheck?: (value: string) => string | null;
}

interface AvailabilityState {
    status: 'idle' | 'loading' | 'available' | 'unavailable' | 'error';
    message?: string;
}

export const useDebouncedAvailability = ({
    field,
    checkFn,
    debounceMs = 500,
    validateBeforeCheck
}: UseDebouncedAvailabilityOptions): {
    status: AvailabilityState['status'];
    check: (value: string) => void;
    message?: string;
} => {
    const [state, setState] = useState<AvailabilityState>({
        status: 'idle',
        message: undefined
    });

    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const check = useCallback((value: string) => {
        // Clear any existing debounce timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Abort any in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Validate before check
        if (validateBeforeCheck) {
            const validationError = validateBeforeCheck(value);
            if (validationError) {
                setState({
                    status: 'error',
                    message: validationError
                });
                return;
            }
        }

        // If value is empty, reset to idle
        if (!value || value.trim() === '') {
            setState({ status: 'idle', message: undefined });
            return;
        }

        // Set loading state immediately for better UX
        setState({ status: 'loading', message: 'Checking availability...' });

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        // Debounce the actual API call
        debounceRef.current = setTimeout(async () => {
            try {
                const params = {
                    email: field === 'email' ? value : undefined,
                    registrationNumber: field === 'registrationNumber' ? value : undefined,
                    taxId: field === 'taxId' ? value : undefined
                };

                const response = await checkFn(params, abortControllerRef.current?.signal);

                // Check if this specific field is available
                let isAvailable = false;
                if (field === 'email') isAvailable = response.EmailAvailable ?? false;
                else if (field === 'registrationNumber') isAvailable = response.RegistrationNumberAvailable ?? false;
                else if (field === 'taxId') isAvailable = response.TaxIdAvailable ?? false;

                if (isAvailable) {
                    setState({
                        status: 'available',
                        message: `${field === 'email' ? 'Email' : field === 'registrationNumber' ? 'Registration number' : 'Tax ID'} is available`
                    });
                } else {
                    setState({
                        status: 'unavailable',
                        message: `${field === 'email' ? 'Email' : field === 'registrationNumber' ? 'Registration number' : 'Tax ID'} is already registered`
                    });
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    // Request was aborted, don't update state
                    return;
                }

                console.error(`Availability check failed for ${field}:`, error);
                setState({
                    status: 'error',
                    message: error.message || `Failed to check ${field} availability`
                });
            }
        }, debounceMs);
    }, [field, checkFn, debounceMs, validateBeforeCheck]);

    return {
        status: state.status,
        check,
        message: state.message
    };
};
