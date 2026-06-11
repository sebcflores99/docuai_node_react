import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, Loading } from './States';

describe('Loading', () => {
  it('renders the default label as a status region', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('renders a custom label', () => {
    render(<Loading label="Fetching documents…" />);
    expect(screen.getByText('Fetching documents…')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the message as an alert', () => {
    render(<ErrorState message="Boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });

  it('shows a retry button only when onRetry is provided', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="Boom" />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

    rerender(<ErrorState message="Boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('renders the title and optional detail', () => {
    render(<EmptyState title="Nothing here" detail="Add something" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something')).toBeInTheDocument();
  });
});
