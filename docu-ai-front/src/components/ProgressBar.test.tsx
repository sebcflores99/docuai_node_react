import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders a determinate bar with the rounded percentage', () => {
    render(<ProgressBar value={42.6} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByText('43%')).toBeInTheDocument();
  });

  it('clamps values to the 0–100 range', () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('falls back to an indeterminate bar when value is missing', () => {
    render(<ProgressBar value={null} label="Processing…" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Processing…')).toBeInTheDocument();
  });
});
