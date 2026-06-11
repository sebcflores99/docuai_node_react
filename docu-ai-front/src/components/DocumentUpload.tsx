import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
  ACCEPTED_FILE_EXTENSIONS,
  uploadSchema,
  validate,
} from '../validation/schemas';

// File picker + drag-and-drop zone with client-side validation. On a valid
// submission it hands the File (and optional title) to the parent.
export function DocumentUpload({
  onUpload,
  busy,
}: {
  onUpload: (file: File, title?: string) => Promise<void> | void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(selected: File | null) {
    setFile(selected);
    setErrors((e) => ({ ...e, file: '' }));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validate(uploadSchema, { title: title || undefined, file });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await onUpload(result.data.file, result.data.title);
    setFile(null);
    setTitle('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <form className="upload" onSubmit={handleSubmit} noValidate>
      <button
        type="button"
        className={`dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="dropzone-icon" aria-hidden="true">⬆</span>
        {file ? (
          <span className="dropzone-file">{file.name}</span>
        ) : (
          <>
            <span className="dropzone-title">Drop a file here or click to browse</span>
            <span className="dropzone-hint">
              {ACCEPTED_FILE_EXTENSIONS.join(', ')} · up to 10 MB
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          hidden
        />
      </button>
      {errors.file && <span className="field-error">{errors.file}</span>}

      <label className="field">
        <span>Title (optional)</span>
        <input
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to the file name"
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>

      <button type="submit" className="btn btn-primary" disabled={busy || !file}>
        {busy ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  );
}
