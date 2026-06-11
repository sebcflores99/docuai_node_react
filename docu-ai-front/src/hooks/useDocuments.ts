import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from '../types';
import * as docsApi from '../api/documents';
import { ApiError } from '../api/client';

const POLL_INTERVAL_MS = 2000;

function isPending(doc: Document): boolean {
  return doc.status === 'PROCESSING' || doc.status === 'PENDING';
}

/**
 * Loads the user's documents and, while any are still ingesting, polls the API
 * so the UI reflects PROCESSING -> READY/FAILED transitions and live progress.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Initial load (and explicit retries via reloadKey).
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

  // Poll while any document is still being processed.
  const anyPending = documents.some(isPending);
  useEffect(() => {
    if (!anyPending) return;
    timerRef.current = setInterval(() => {
      void docsApi
        .listDocuments()
        .then((docs) => setDocuments(docs))
        .catch(() => {
          /* transient; keep last known state and retry next tick */
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [anyPending]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const addDocument = useCallback((doc: Document) => {
    setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { documents, loading, error, retry, addDocument, removeDocument };
}
