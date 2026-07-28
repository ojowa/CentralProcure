import React, { useEffect, useState } from 'react';
import { fetchCgisDocuments } from '../../services/moduleService';

interface CgisDocument {
  DocumentType: string;
  FileName: string | null;
  FileUrl: string | null;
  Status: string | null;
  UpdatedAt: string | null;
}

interface CgisDocumentsPanelProps {
  entityType: string;
  entityId: string;
  token: string | null;
}

export const CgisDocumentsPanel = ({ entityType, entityId, token }: CgisDocumentsPanelProps) => {
  const [documents, setDocuments] = useState<CgisDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProcurementPlan = entityType.toLowerCase() === 'procurement_plan';

  useEffect(() => {
    const loadDocs = async () => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCgisDocuments(entityType, entityId, token);
        setDocuments(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadDocs();
  }, [entityType, entityId, token]);

  if (isProcurementPlan) {
    return (
      <div className="app-card">
        <div className="app-card__header">
          <h3 className="app-card__title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Departmental Plan Support Pack
          </h3>
        </div>
        <div className="app-card__body">
          <p className="app-muted">
            No tender-specific document pack is required at this stage. CGIS should review the departmental
            plan details, approval note, and workflow context before deciding.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-card">
        <div className="app-card__body">
          <div className="app-loading-spinner">Loading case documents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-alert app-alert--error">
        <span className="app-alert__icon">⚠</span>
        {error}
      </div>
    );
  }

  return (
    <div className="app-card">
      <div className="app-card__header">
        <h3 className="app-card__title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Case Documents & Compliance Pack
        </h3>
        <p className="app-card__description">Review the technical proposal and vendor statutory compliance records below.</p>
      </div>
      <div className="app-card__body">
        {documents.length > 0 ? (
          <div className="app-table-wrapper">
            <table className="app-table app-table--compact">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>File Name</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{doc.DocumentType}</strong>
                    </td>
                    <td className="app-table__cell--mono">{doc.FileName || 'Unspecified'}</td>
                    <td>
                      <span className={`app-badge app-badge--${doc.Status?.toLowerCase() || 'pending'}`}>
                        {doc.Status || 'Pending'}
                      </span>
                    </td>
                    <td>{doc.UpdatedAt ? new Date(doc.UpdatedAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <a
                        href={doc.FileUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-link"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="app-empty-state app-empty-state--small">
            <p>No documents found for this case.</p>
          </div>
        )}
      </div>
    </div>
  );
};
