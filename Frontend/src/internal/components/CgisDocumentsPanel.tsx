import React, { useEffect, useState } from 'react';
import { fetchCgisDocuments } from '../services/moduleService';

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

  if (isLoading) return <div className="plan-loading">Loading case documents...</div>;
  if (error) return <div className="portal-alert">{error}</div>;

  return (
    <div className="requisition-detail-note" style={{ marginTop: '24px' }}>
      <h4>Case Documents & Compliance Pack</h4>
      <p className="plan-muted" style={{ marginBottom: '12px' }}>Review the technical proposal and vendor statutory compliance records below.</p>
      
      <table className="plan-table">
        <thead>
          <tr>
            <th>Document Type</th>
            <th>File Name</th>
            <th>Verification Status</th>
            <th>Last Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {documents.length > 0 ? (
            documents.map((doc, idx) => (
              <tr key={idx}>
                <td><strong>{doc.DocumentType}</strong></td>
                <td>{doc.FileName || 'Unspecified'}</td>
                <td>
                  <span className={`admin-status ${doc.Status === 'Approved' ? 'admin-status--good' : 'admin-status--warn'}`}>
                    {doc.Status || 'Pending'}
                  </span>
                </td>
                <td>{doc.UpdatedAt ? new Date(doc.UpdatedAt).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <button className="plan-link" onClick={() => window.open(doc.FileUrl || '#', '_blank')}>
                    View Document
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="plan-empty">No documents found for this case.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
