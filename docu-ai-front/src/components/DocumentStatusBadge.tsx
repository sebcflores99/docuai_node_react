import type { DocumentStatus } from '../types';

const LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
};

// Reflects the document ingestion/embedding pipeline state.
export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`doc-status doc-status-${status.toLowerCase()}`}>
      {status === 'PROCESSING' && <span className="spinner spinner-sm" aria-hidden="true" />}
      {LABELS[status]}
    </span>
  );
}
