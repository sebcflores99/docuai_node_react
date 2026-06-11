export type ModelPhase = 'idle' | 'thinking' | 'error';

// Surfaces the live model status (thinking / error) required by the AI-aware UX.
export function ModelStatus({ phase }: { phase: ModelPhase }) {
  if (phase === 'idle') return null;

  if (phase === 'thinking') {
    return (
      <div className="model-status model-status-thinking" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Assistant is thinking…</span>
      </div>
    );
  }

  return (
    <div className="model-status model-status-error" role="alert">
      <span aria-hidden="true">⚠️</span>
      <span>The assistant failed to respond. You can re-ask your question.</span>
    </div>
  );
}
