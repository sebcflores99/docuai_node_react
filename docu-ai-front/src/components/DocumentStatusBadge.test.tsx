import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentStatusBadge } from './DocumentStatusBadge';

describe('DocumentStatusBadge', () => {
  it('renders a human-readable label per status', () => {
    const { rerender } = render(<DocumentStatusBadge status="READY" />);
    expect(screen.getByText('Ready')).toHaveClass('doc-status-ready');

    rerender(<DocumentStatusBadge status="PROCESSING" />);
    expect(screen.getByText('Processing')).toHaveClass('doc-status-processing');

    rerender(<DocumentStatusBadge status="PENDING" />);
    expect(screen.getByText('Pending')).toHaveClass('doc-status-pending');

    rerender(<DocumentStatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toHaveClass('doc-status-failed');
  });
});
