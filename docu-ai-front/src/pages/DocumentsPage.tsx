import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Document } from '../types';
import * as docsApi from '../api/documents';
import { ApiError } from '../api/client';
import { useDocuments } from '../hooks/useDocuments';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { DocumentUpload } from '../components/DocumentUpload';
import { ProgressBar } from '../components/ProgressBar';
import { formatBytes, formatDate, fileExtension } from '../lib/format';

// Documents management: upload files, watch ingestion progress, delete.
export function DocumentsPage() {
  const { documents, loading, error, retry, addDocument, removeDocument } =
    useDocuments();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [extension, setExtension] = useState('');

  async function handleUpload(file: File, title?: string) {
    setUploadError(null);
    setUploading(true);
    try {
      const doc = await docsApi.uploadDocument(file, title);
      addDocument(doc); // useDocuments will poll until READY/FAILED
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    removeDocument(doc.id);
    try {
      await docsApi.deleteDocument(doc.id);
    } catch {
      retry(); // restore from server on failure
    }
  }

  const readyCount = documents.filter((d) => d.status === 'READY').length;

  // Distinct extensions present across the user's documents, for the dropdown.
  const extensions = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      const ext = fileExtension(doc.fileName);
      if (ext) set.add(ext);
    }
    return [...set].sort();
  }, [documents]);

  // Client-side filtering by keyword (title/file name) and by extension.
  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return documents.filter((doc) => {
      if (extension && fileExtension(doc.fileName) !== extension) return false;
      if (!term) return true;
      const haystack = `${doc.title} ${doc.fileName ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [documents, keyword, extension]);

  const hasFilters = keyword.trim() !== '' || extension !== '';

  return (
    <div className="documents-page">
      <header className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="muted">
            Upload documents to make them searchable. Once a document is{' '}
            <strong>Ready</strong>, ask about it from any chat.
          </p>
        </div>
        <Link to="/chat" className="btn btn-primary">
          Go to chat →
        </Link>
      </header>

      <section className="card">
        <h2>Upload a document</h2>
        <DocumentUpload onUpload={handleUpload} busy={uploading} />
        {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
      </section>

      <section className="documents-list">
        <div className="documents-list-head">
          <h2>Your documents</h2>
          {readyCount > 0 && (
            <span className="muted">{readyCount} ready</span>
          )}
        </div>

        {!loading && !error && documents.length > 0 && (
          <div className="doc-filters">
            <input
              type="search"
              className="doc-filter-search"
              placeholder="Filter by keyword…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Filter documents by keyword"
            />
            <select
              className="doc-filter-ext"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              aria-label="Filter documents by extension"
            >
              <option value="">All extensions</option>
              {extensions.map((ext) => (
                <option key={ext} value={ext}>
                  .{ext}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setKeyword('');
                  setExtension('');
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <Loading label="Loading documents…" />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            detail="Upload your first document above to start asking questions."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching documents"
            detail="Try a different keyword or extension."
          />
        ) : (
          <ul className="doc-cards">
            {filtered.map((doc) => (
              <li key={doc.id} className="card doc-card">
                <div className="doc-card-head">
                  <div className="doc-card-title">
                    <span className="doc-icon" aria-hidden="true">📄</span>
                    <h3>{doc.title}</h3>
                  </div>
                  <DocumentStatusBadge status={doc.status} />
                </div>

                <div className="doc-meta">
                  {doc.fileName && <span>{doc.fileName}</span>}
                  {doc.sizeBytes ? <span>{formatBytes(doc.sizeBytes)}</span> : null}
                  <span>Added {formatDate(doc.createdAt)}</span>
                </div>

                {(doc.status === 'PROCESSING' || doc.status === 'PENDING') && (
                  <ProgressBar value={doc.progress} label="Processing…" />
                )}

                {doc.status === 'FAILED' && (
                  <p className="doc-error" role="alert">
                    Processing failed{doc.error ? `: ${doc.error}` : ''}. Try deleting
                    and re-uploading.
                  </p>
                )}

                <div className="doc-card-actions">
                  {doc.status === 'READY' ? (
                    <Link to="/chat" className="btn btn-primary btn-sm">
                      Ask in chat
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-sm" disabled>
                      {doc.status === 'FAILED' ? 'Unavailable' : 'Preparing…'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(doc)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
