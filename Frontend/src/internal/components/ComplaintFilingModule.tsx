'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AdministrativeReviewCreateRequest, AdministrativeReviewDetail } from '../types/internal';
import {
  createAdministrativeReview,
  fetchAdministrativeReviewFilingContext,
  type AdministrativeReviewFilingContext
} from '../services/administrativeReviewService';

interface Props {
  entityType: string;
  entityId: string;
  entityTitle: string;
  currentStage: string;
  onComplaintFiled?: (complaint: AdministrativeReviewDetail) => void;
  token?: string | null;
}

export const ComplaintFilingModule = ({
  entityType,
  entityId,
  entityTitle,
  currentStage,
  onComplaintFiled,
  token
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filingContext, setFilingContext] = useState<AdministrativeReviewFilingContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const [formData, setFormData] = useState<AdministrativeReviewCreateRequest>({
    EntityType: entityType,
    EntityId: entityId,
    Subject: '',
    Summary: '',
    Details: '',
    ComplaintChannel: 'Web Portal',
    RequestedRemedy: '',
    FiledBy: ''
  });

  useEffect(() => {
    if (!token) {
      setFilingContext(null);
      return;
    }

    let disposed = false;
    setIsLoadingContext(true);
    fetchAdministrativeReviewFilingContext(token, entityType, entityId)
      .then((context) => {
        if (!disposed) {
          setFilingContext(context);
        }
      })
      .catch((err: Error) => {
        if (!disposed) {
          setError(err.message || 'Unable to load complaint filing context.');
        }
      })
      .finally(() => {
        if (!disposed) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [token, entityType, entityId]);

  const canFileComplaint = Boolean(filingContext?.CanFile);
  const effectiveStage = filingContext?.CurrentStageTitle ?? filingContext?.CurrentStageKey ?? currentStage;

  const handleInputChange = (field: keyof AdministrativeReviewCreateRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!token) {
      setError('Authentication required');
      return;
    }

    if (!formData.Subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!formData.Summary.trim()) {
      setError('Summary is required');
      return;
    }
    if (!formData.Details.trim()) {
      setError('Details are required');
      return;
    }
    if (!formData.FiledBy?.trim()) {
      setError('Filed By is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createAdministrativeReview(token, formData);
      setSuccess(`Complaint filed successfully: ${result.ComplaintReference}`);
      onComplaintFiled?.(result);

      // Reset form after successful submission
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(null);
        setFormData({
          EntityType: entityType,
          EntityId: entityId,
          Subject: '',
          Summary: '',
          Details: '',
          ComplaintChannel: 'Web Portal',
          RequestedRemedy: '',
          FiledBy: ''
        });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, token, entityType, entityId, onComplaintFiled]);

  if (!canFileComplaint) {
    return (
      <div className="complaint-filing-disabled">
        <p className="text-sm text-gray-500">
          {isLoadingContext
            ? 'Checking complaint filing eligibility...'
            : filingContext?.Reason || 'Complaint filing is not available for this record.'}
        </p>
      </div>
    );
  }

  return (
    <div className="complaint-filing-module">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="complaint-file-btn"
          type="button"
        >
          <span className="icon">⚠️</span>
          File Administrative Review (Complaint)
        </button>
      ) : (
        <div className="complaint-form-container">
          <div className="complaint-form-header">
            <h3>File Administrative Review Complaint</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="close-btn"
              type="button"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="complaint-entity-info">
            <p><strong>Entity:</strong> {entityTitle}</p>
            <p><strong>Type:</strong> {entityType}</p>
            <p><strong>Current Stage:</strong> {effectiveStage}</p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="alert">
              {success}
            </div>
          )}

          <form className="complaint-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="form-group">
              <label htmlFor="complaint-subject">
                Subject <span className="required">*</span>
              </label>
              <input
                id="complaint-subject"
                type="text"
                value={formData.Subject ?? ''}
                onChange={(e) => handleInputChange('Subject', e.target.value)}
                placeholder="Brief subject of the complaint"
                maxLength={255}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="complaint-summary">
                Summary <span className="required">*</span>
              </label>
              <textarea
                id="complaint-summary"
                value={formData.Summary ?? ''}
                onChange={(e) => handleInputChange('Summary', e.target.value)}
                placeholder="Executive summary of the complaint"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="complaint-details">
                Details <span className="required">*</span>
              </label>
              <textarea
                id="complaint-details"
                value={formData.Details ?? ''}
                onChange={(e) => handleInputChange('Details', e.target.value)}
                placeholder="Detailed description of the complaint and grounds"
                rows={5}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="complaint-channel">
                Complaint Channel
              </label>
              <select
                id="complaint-channel"
                value={formData.ComplaintChannel ?? ''}
                onChange={(e) => handleInputChange('ComplaintChannel', e.target.value)}
                disabled={isSubmitting}
              >
                <option value="Web Portal">Web Portal</option>
                <option value="Email">Email</option>
                <option value="Letter">Letter</option>
                <option value="In Person">In Person</option>
                <option value="Phone">Phone</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="complaint-remedy">
                Requested Remedy
              </label>
              <textarea
                id="complaint-remedy"
                value={formData.RequestedRemedy ?? ''}
                onChange={(e) => handleInputChange('RequestedRemedy', e.target.value)}
                placeholder="What remedy is being requested?"
                rows={2}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="complaint-filed-by">
                Filed By <span className="required">*</span>
              </label>
              <input
                id="complaint-filed-by"
                type="text"
                value={formData.FiledBy ?? ''}
                onChange={(e) => handleInputChange('FiledBy', e.target.value)}
                placeholder="Name of person filing the complaint"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'File Complaint'}
              </button>
            </div>
          </form>

          <div className="complaint-notice">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> {filingContext?.FilingEffectNote ?? 'If filed, this record will be routed into Administrative Review.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
