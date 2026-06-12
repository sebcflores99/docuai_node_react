import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageBubble } from './MessageBubble';
import { makeAssistantMessage, makeUserMessage } from '../test/fixtures';

describe('MessageBubble', () => {
  it('renders a user message with the "You" label and content', () => {
    render(<MessageBubble message={makeUserMessage()} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
  });

  it('renders an assistant message with its label and source passages', () => {
    render(<MessageBubble message={makeAssistantMessage()} />);
    expect(screen.getByText('DocuAI')).toBeInTheDocument();
    expect(screen.getByText(/1 source passage/)).toBeInTheDocument();
    expect(screen.getByText('France Facts')).toBeInTheDocument();
    expect(screen.getByText(/Its capital is Paris\./)).toBeInTheDocument();
  });

  it('omits the sources section when there are none', () => {
    render(<MessageBubble message={makeAssistantMessage({ sources: [] })} />);
    expect(screen.queryByText(/source passage/)).not.toBeInTheDocument();
  });
});
