# Frontend API Contract — Backend Changes Required

The frontend has been built against the contract below. Three changes are needed on
the backend for the document-upload and cross-document chat experience to work
end-to-end. Verified against the running backend on 2026-06-11 — all three currently
return `VALIDATION_ERROR`.

Base path: `/api`. Auth: `Authorization: Bearer <jwt>`.

---

## 1. Document upload via file (multipart) — `POST /documents`

**Today:** accepts only JSON `{ title, content }`. A `multipart/form-data` upload is
rejected with `"expected object, received undefined"`.

**Needed:** accept `multipart/form-data` with:
- `file` (required) — the document file. Accept `.txt`, `.md`, `.pdf`, `.doc`,
  `.docx` (≤ 10 MB).
- `title` (optional) — defaults to the file name.

The backend should extract text from the file (parse PDF/Word as needed), then run
the existing chunk → embed → index pipeline.

**Response:** `201` with a `Document` whose `status` is `PROCESSING` (see §2).

> Keeping the JSON `{ title, content }` form working is fine for backward compat, but
> the frontend now sends multipart.

---

## 2. Asynchronous ingestion + progress — `Document.progress`

**Today:** `createDocument` ingests **synchronously** and returns `status: READY`
immediately. There is no `progress` field.

**Needed (for the upload UX / progress bar):**
- Ingest in the background so `POST /documents` returns quickly with
  `status: PROCESSING`.
- Add an integer `progress` field (0–100) to the `Document` model/response,
  updated as ingestion proceeds.
- `GET /documents` and `GET /documents/:id` return the current `status` + `progress`.
  The frontend polls `GET /documents` every ~2s while any document is `PROCESSING`.
- On completion set `status: READY` (and `progress: 100`); on error `status: FAILED`
  with an optional `error` string.

If true percentage is impractical, returning `progress: null` is acceptable — the
frontend then shows an indeterminate bar and still flips to **Ready** on `READY`.

Suggested `Document` fields the UI will render if present (all optional):
`progress`, `fileName`, `mimeType`, `sizeBytes`, `error`.

---

## 3. Cross-document conversations

The product goal: **a user can ask, in any chat, about any of their documents.**
Today a conversation is bound to a single required `documentId`, and retrieval is
scoped to that one document.

### `POST /conversations`
**Today:** requires `documentId` (UUID). Sending `{}` is rejected.

**Needed:** make document binding optional. Accept:
```json
{ "title": "optional", "documentIds": ["optional", "subset"] }
```
- No `documentIds` → a conversation that retrieves across **all** the user's `READY`
  documents.
- `documentIds` present → scope retrieval to that subset.

### `POST /conversations/:id/messages`
**Today:** `{ content }`, retrieval scoped to the conversation's single document.

**Needed:** also accept an optional per-message scope:
```json
{ "content": "…", "documentIds": ["optional", "subset"] }
```
- Retrieval should search across all the user's `READY` documents (or the provided
  subset), not a single bound document.
- Each `assistantMessage.sources[]` entry already carries `documentId` +
  `documentTitle`, so cross-document citations work in the UI as-is.

### `GET /conversations`
The frontend now calls this **without** a `documentId` query param and expects all of
the user's conversations.

---

## Unchanged / already correct

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` — `{ token, user }`.
- `DELETE /documents/:id` → `204`.
- `GET /conversations/:id` → conversation including `messages[]`.
- Error shape `{ message, code }` and assistant metadata (`model`, token counts,
  `confidence` 0–1, `sources[]` with `page`) — all consumed as-is.
