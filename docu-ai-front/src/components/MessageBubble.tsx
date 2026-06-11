import type { Message } from '../types';
import { ConfidenceBadge, UncertaintyNotice } from './Confidence';

// Renders a single chat message. Assistant messages also show grounding
// sources, confidence, model + token metadata, and a re-ask affordance.
export function MessageBubble({
  message,
  onReask,
}: {
  message: Message;
  onReask?: (content: string) => void;
}) {
  const isUser = message.role === 'USER';
  const isAssistant = message.role === 'ASSISTANT';
  const hasConfidence = typeof message.confidence === 'number';

  return (
    <article className={`message message-${message.role.toLowerCase()}`}>
      <header className="message-head">
        <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
        {isAssistant && hasConfidence && (
          <ConfidenceBadge confidence={message.confidence as number} />
        )}
      </header>

      <div className="message-body">{message.content}</div>

      {isAssistant && hasConfidence && (
        <UncertaintyNotice confidence={message.confidence as number} />
      )}

      {isAssistant && message.sources && message.sources.length > 0 && (
        <details className="message-sources">
          <summary>{message.sources.length} source passage(s)</summary>
          <ul>
            {message.sources.map((s, i) => (
              <li key={i}>
                {s.documentTitle && <strong>{s.documentTitle}</strong>}
                {s.page && <span className="source-page"> (p. {s.page})</span>}
                {s.documentTitle && ': '}
                <span className="source-snippet">“{s.snippet}”</span>
                {typeof s.score === 'number' && (
                  <span className="source-score"> ({s.score.toFixed(2)})</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {isAssistant && (message.model || message.completionTokens != null) && (
        <footer className="message-meta">
          {message.model && <span>{message.model}</span>}
          {message.completionTokens != null && (
            <span>
              {(message.promptTokens ?? 0) + (message.completionTokens ?? 0)} tokens
            </span>
          )}
        </footer>
      )}

      {isUser && onReask && (
        <button
          type="button"
          className="btn btn-ghost btn-sm reask"
          onClick={() => onReask(message.content)}
          title="Send this question again"
        >
          ↻ Re-ask
        </button>
      )}
    </article>
  );
}
