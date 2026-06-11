import { apiRequest } from './client';
import type { Document } from '../types';

export function listDocuments(): Promise<Document[]> {
  return apiRequest<Document[]>('/documents');
}

export function getDocument(id: string): Promise<Document> {
  return apiRequest<Document>(`/documents/${id}`);
}

/**
 * Uploads a document file. The backend extracts text, chunks, embeds, and
 * indexes it asynchronously — the returned document starts as PROCESSING and
 * transitions to READY (poll via getDocument).
 */
export function uploadDocument(file: File, title?: string): Promise<Document> {
  const form = new FormData();
  form.append('file', file);
  if (title?.trim()) form.append('title', title.trim());
  return apiRequest<Document>('/documents', { method: 'POST', body: form });
}

export function deleteDocument(id: string): Promise<void> {
  return apiRequest<void>(`/documents/${id}`, { method: 'DELETE' });
}
