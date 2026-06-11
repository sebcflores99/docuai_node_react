import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Document } from '../types';
import * as docsApi from '../api/documents';
import { ApiError } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';

// "Input" page: submit new documents and browse existing ones.
export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const docs = await docsApi.listDocuments();
        if (!active) return;
        setDocuments(docs);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load documents.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const doc = await docsApi.createDocument(title.trim(), content.trim());
      setDocuments((prev) => [doc, ...prev]);
      setTitle('');
      setContent('');
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Failed to create document.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await docsApi.deleteDocument(id);
    } catch {
      setDocuments(previous);
    }
  }

  return (
    <div className="documents-page">
      <section className="card">
        <h1>Add a document</h1>
        <p className="muted">
          Paste text content. Once processed, you can ask the assistant questions
          about it.
        </p>
        <form onSubmit={handleCreate} className="form">
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Financial Report"
            />
          </label>
          <label className="field">
            <span>Content</span>
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the document text here…"
            />
          </label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? 'Uploading…' : 'Add document'}
          </button>
        </form>
      </section>

      <section className="documents-list">
        <h2>Your documents</h2>
        {loading ? (
          <Loading label="Loading documents…" />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            detail="Add your first document above to start asking questions."
          />
        ) : (
          <ul className="doc-cards">
            {documents.map((doc) => (
              <li key={doc.id} className="card doc-card">
                <div className="doc-card-head">
                  <h3>{doc.title}</h3>
                  <DocumentStatusBadge status={doc.status} />
                </div>
                <p className="doc-preview">{doc.content.slice(0, 160)}…</p>
                <div className="doc-card-actions">
                  <Link
                    to={`/documents/${doc.id}/chat`}
                    className="btn btn-primary btn-sm"
                    aria-disabled={doc.status !== 'READY'}
                  >
                    Ask questions
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(doc.id)}
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
