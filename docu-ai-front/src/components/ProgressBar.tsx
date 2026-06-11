// A progress indicator for document ingestion. Renders a determinate bar when
// a numeric percentage is known, or an indeterminate animated bar otherwise.
export function ProgressBar({
  value,
  label,
}: {
  value?: number | null;
  label?: string;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const pct = hasValue ? Math.min(100, Math.max(0, Math.round(value))) : undefined;

  return (
    <div className="progress" aria-label={label ?? 'Processing'}>
      <div
        className={`progress-track ${hasValue ? '' : 'is-indeterminate'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="progress-fill"
          style={hasValue ? { width: `${pct}%` } : undefined}
        />
      </div>
      <span className="progress-label">
        {hasValue ? `${pct}%` : (label ?? 'Processing…')}
      </span>
    </div>
  );
}
