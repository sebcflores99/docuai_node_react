// Visualizes the assistant's self-reported confidence (0..1) so users can
// gauge how much to trust an answer — part of graceful uncertainty handling.

function level(confidence: number): { label: string; cls: string } {
  if (confidence >= 0.75) return { label: 'High confidence', cls: 'high' };
  if (confidence >= 0.45) return { label: 'Medium confidence', cls: 'medium' };
  return { label: 'Low confidence', cls: 'low' };
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const { label, cls } = level(confidence);
  const pct = Math.round(confidence * 100);
  return (
    <span className={`confidence confidence-${cls}`} title={`${pct}% confidence`}>
      {label} · {pct}%
    </span>
  );
}

// Inline warning shown when the model is uncertain, nudging users to verify.
export function UncertaintyNotice({ confidence }: { confidence: number }) {
  if (confidence >= 0.45) return null;
  return (
    <p className="uncertainty-notice" role="note">
      ⚠️ The assistant isn't confident about this answer. Double-check it against the
      source document before relying on it.
    </p>
  );
}
