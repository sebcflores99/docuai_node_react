import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './MessageBubble';
import { makeAssistantMessage, makeUserMessage } from '../test/fixtures';

describe('MessageBubble', () => {
  it('renders a user message with the "You" label and content', () => {
    render(<MessageBubble message={makeUserMessage()} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
  });

  it('renders an assistant message with sources and token metadata', () => {
    render(<MessageBubble message={makeAssistantMessage()} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    // 1 source passage
    expect(screen.getByText(/1 source passage/)).toBeInTheDocument();
    expect(screen.getByText('France Facts')).toBeInTheDocument();
    expect(screen.getByText(/Its capital is Paris\./)).toBeInTheDocument();
    // model + total tokens (100 + 20)
    expect(screen.getByText('mock-model')).toBeInTheDocument();
    expect(screen.getByText('120 tokens')).toBeInTheDocument();
  });

  it('omits the sources section when there are none', () => {
    render(<MessageBubble message={makeAssistantMessage({ sources: [] })} />);
    expect(screen.queryByText(/source passage/)).not.toBeInTheDocument();
  });

  it('invokes onReask with the question when the re-ask button is clicked', async () => {
    const onReask = vi.fn();
    render(<MessageBubble message={makeUserMessage()} onReask={onReask} />);
    await userEvent.click(screen.getByRole('button', { name: /re-ask/i }));
    expect(onReask).toHaveBeenCalledWith('What is the capital of France?');
  });

  it('does not show a re-ask button on assistant messages', () => {
    const onReask = vi.fn();
    render(<MessageBubble message={makeAssistantMessage()} onReask={onReask} />);
    expect(screen.queryByRole('button', { name: /re-ask/i })).not.toBeInTheDocument();
  });
});
