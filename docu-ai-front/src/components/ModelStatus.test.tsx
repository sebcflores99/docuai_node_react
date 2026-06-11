import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelStatus } from './ModelStatus';

describe('ModelStatus', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<ModelStatus phase="idle" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces thinking via a polite live region', () => {
    render(<ModelStatus phase="thinking" />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('shows an error alert with a re-ask hint', () => {
    render(<ModelStatus phase="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/re-ask/i);
  });
});
