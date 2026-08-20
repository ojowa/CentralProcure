'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';

type DocumentViewerProps = {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: string;
  fileName?: string;
  apiEndpoint: 'vendor' | 'admin';
  token?: string;
  onDownload?: () => void;
};

const isImageFile = (name?: string) => {
  if (!name) return false;
  const ext = name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '');
};

const isPdfFile = (name?: string) => {
  if (!name) return true;
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' || !ext;
};

const getStoredToken = (apiEndpoint: 'vendor' | 'admin'): string | null => {
  if (typeof window === 'undefined') return null;
  const key = apiEndpoint === 'vendor' ? 'vendorAuthToken' : '__internal_jwt_token__';
  return window.localStorage.getItem(key);
};

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType,
  fileName,
  apiEndpoint,
  token,
  onDownload,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    let cancelled = false;
    const url = apiEndpoint === 'vendor'
      ? `/api/Vendor/compliance/${documentId}/file`
      : `/api/admin/vendors/compliance/${documentId}/file`;

    setLoading(true);
    setError(null);
    setBlobUrl(null);

    const authToken = token || getStoredToken(apiEndpoint);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load document');
        const blob = await res.blob();
        if (cancelled) return;
        const url = window.URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Unable to load document.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
  }, [isOpen, documentId, apiEndpoint, token]);

  useEffect(() => {
    if (!isOpen) {
      setBlobUrl(null);
      setLoading(true);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!blobUrl) return;
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName || `${documentType}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  if (!isOpen) return null;

  const showImage = blobUrl && isImageFile(fileName);
  const showPdf = blobUrl && isPdfFile(fileName);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '90vw', maxWidth: '960px', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {fileName || documentType}
              </h3>
              <p className="text-xs text-slate-500">{documentType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Loading document...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-red-500 p-6">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm text-center">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          )}

          {showImage && blobUrl && (
            <img
              src={blobUrl}
              alt={fileName || documentType}
              className="max-w-full max-h-full object-contain p-4"
            />
          )}

          {showPdf && blobUrl && (
            <iframe
              src={blobUrl}
              title={fileName || documentType}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
};
