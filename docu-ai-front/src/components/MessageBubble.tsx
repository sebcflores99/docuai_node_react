import type { Message } from '../types';

// Renders a single chat message. Assistant messages also show the grounding
// source passages they relied on (document title + page).
export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'USER';
  const isAssistant = message.role === 'ASSISTANT';

  return (
    <article className={`message message-${message.role.toLowerCase()}`}>
      <span className="message-avatar" aria-hidden="true">
        {isUser ? 'U' : '◆'}
      </span>
      <div className="message-content">
        <span className="message-role">{isUser ? 'You' : 'DocuAI'}</span>
        <div className="message-body">{message.content}</div>

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
      </div>
    </article>
  );
}
