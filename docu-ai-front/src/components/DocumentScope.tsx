import { useState } from 'react';
import type { Document } from '../types';

// Lets the user scope a chat to specific documents. With nothing selected the
// assistant searches across all READY documents ("ask about any document").
export function DocumentScope({
  documents,
  selected,
  onChange,
}: {
  documents: Document[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ready = documents.filter((d) => d.status === 'READY');

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  const summary =
    selected.length === 0
      ? `All documents (${ready.length})`
      : `${selected.length} selected`;

  return (
    <div className="scope">
      <button
        type="button"
        className="scope-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={ready.length === 0}
      >
        <span aria-hidden="true">🔎</span> Scope: {summary}
        <span className="scope-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && ready.length > 0 && (
        <div className="scope-panel">
          <label className="scope-option">
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
            />
            <span>All documents</span>
          </label>
          {ready.map((d) => (
            <label key={d.id} className="scope-option">
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={() => toggle(d.id)}
              />
              <span>{d.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
