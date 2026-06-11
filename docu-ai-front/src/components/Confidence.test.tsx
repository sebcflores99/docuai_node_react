import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfidenceBadge, UncertaintyNotice } from './Confidence';

describe('ConfidenceBadge', () => {
  it('labels high confidence and shows the percentage', () => {
    render(<ConfidenceBadge confidence={0.9} />);
    const badge = screen.getByText(/High confidence/);
    expect(badge).toHaveTextContent('90%');
    expect(badge).toHaveClass('confidence-high');
  });

  it('labels medium confidence at the 0.45 boundary', () => {
    render(<ConfidenceBadge confidence={0.45} />);
    const badge = screen.getByText(/Medium confidence/);
    expect(badge).toHaveClass('confidence-medium');
  });

  it('labels low confidence below the threshold', () => {
    render(<ConfidenceBadge confidence={0.2} />);
    const badge = screen.getByText(/Low confidence/);
    expect(badge).toHaveTextContent('20%');
    expect(badge).toHaveClass('confidence-low');
  });

  it('treats 0.75 as the high-confidence boundary', () => {
    render(<ConfidenceBadge confidence={0.75} />);
    expect(screen.getByText(/High confidence/)).toBeInTheDocument();
  });
});

describe('UncertaintyNotice', () => {
  it('warns when confidence is low', () => {
    render(<UncertaintyNotice confidence={0.3} />);
    expect(screen.getByRole('note')).toHaveTextContent(/isn't confident/i);
  });

  it('renders nothing when confidence is acceptable', () => {
    const { container } = render(<UncertaintyNotice confidence={0.45} />);
    expect(container).toBeEmptyDOMElement();
  });
});
