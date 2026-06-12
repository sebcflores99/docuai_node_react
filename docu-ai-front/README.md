# DocuAI — Frontend

React + TypeScript + Vite frontend for **DocuAI**, an AI assistant that answers
questions about uploaded documents. Users sign in, add documents, and chat with an
assistant that answers from those documents while surfacing its sources and live
status.

## Tech stack

- React 19 + TypeScript
- Vite (dev/build)
- React Router 7 (routing + protected routes)
- Plain CSS with light/dark theming (no UI framework)
- JWT auth (token stored in `localStorage`)

## Pages

| Route                       | Page              | Purpose                                                        |
| --------------------------- | ----------------- | -------------------------------------------------------------- |
| `/login`                    | Login / Sign‑up   | Authenticate via a clear tabbed switch between log in and sign up. |
| `/documents`                | Documents         | Upload document files, watch ingestion progress, delete.       |
| `/chat`, `/chat/:id`        | Chat              | Ask questions answered across **all** ready documents; answers cite sources. |

All routes except `/login` are protected and redirect unauthenticated users.

## AI-aware UX

- **Model status** — a "thinking…" indicator while the assistant responds, and an
  error state if the call fails.
- **Refine / re‑ask** — every user question has a ↻ Re‑ask action; the input also
  lets users rephrase and ask follow‑ups.
- **Grounded, honest answers** — answers list the document passages they relied on
  (file + page) so users can verify each claim. When nothing relevant is found, the
  assistant says so instead of guessing (no fabricated confidence score).
- **Document processing feedback** — uploads show a progress bar and a status badge
  (Processing → Ready / Failed).
- **Loading / error / empty states** — consistent primitives across every page.

## Forms & validation

All forms validate client‑side with **zod** (`src/validation/schemas.ts`) before any
request: login, sign‑up (with password confirmation + match check), document upload
(file type/size), and the chat message box. Errors render inline per field.

## Project structure

```
src/
  api/         # Typed fetch client + per-resource API modules
    client.ts        # fetch wrapper (JSON + FormData), JWT handling, ApiError
    auth.ts          # login / register / me
    documents.ts     # list / get / upload (multipart) / delete
    conversations.ts # conversations + messages (cross-document)
  auth/        # AuthContext, provider, useAuth hook, ProtectedRoute
  components/  # Layout, Sidebar, States, MessageBubble, ModelStatus,
               # ProgressBar, DocumentUpload, ConversationList, DocumentScope
  conversations/ # ConversationsContext (shared chat list)
  hooks/       # useDocuments (list + progress polling)
  lib/         # formatting helpers
  pages/       # LoginPage, DocumentsPage, ChatPage
  validation/  # zod schemas + validate() helper
  types/       # Domain types
```

## Backend API contract

The frontend talks to the backend over REST. Base URL comes from `VITE_API_URL`
(default `http://localhost:8000/api`). Authenticated requests send
`Authorization: Bearer <jwt>`.

| Method & path                       | Body                                  | Returns                              |
| ----------------------------------- | ------------------------------------- | ------------------------------------ |
| `POST /auth/register`               | `{ email, password }`                 | `{ token, user }`                    |
| `POST /auth/login`                  | `{ email, password }`                 | `{ token, user }`                    |
| `GET  /auth/me`                     | —                                     | `{ user }`                           |
| `GET  /documents`                   | —                                     | `Document[]`                         |
| `POST /documents`                   | `multipart/form-data`: `file`, `title?` | `Document` (`status:PROCESSING`)  |
| `GET  /documents/:id`               | —                                     | `Document` (incl. `progress`)        |
| `DELETE /documents/:id`             | —                                     | `204`                                |
| `GET  /conversations`               | —                                     | `Conversation[]`                     |
| `POST /conversations`               | `{ title?, documentIds? }`            | `Conversation`                       |
| `GET  /conversations/:id`           | —                                     | `Conversation` (with `messages`)     |
| `PATCH /conversations/:id`          | `{ title }`                           | `Conversation` (rename)              |
| `DELETE /conversations/:id`         | —                                     | `204`                                |
| `POST /conversations/:id/messages`  | `{ content, documentIds? }`           | `{ userMessage, assistantMessage }` |

The assistant `Message` includes AI metadata: `model`, `promptTokens`,
`completionTokens`, and `sources[]` (`{ documentId, documentTitle?, snippet,
score?, page? }`). See `src/types/index.ts`.

## Development

The app runs as part of the Docker Compose stack (see the root `README.md`);
the SPA is built and served behind nginx, with `VITE_API_URL` supplied as a
Docker build arg (`/api`, proxied to the backend).

These package scripts are available for working on the frontend in isolation:

```bash
pnpm install
pnpm build    # type-check (tsc -b) + production build to dist/
pnpm lint     # ESLint
pnpm test     # run the Vitest suite once
pnpm test:watch  # run Vitest in watch mode
pnpm preview  # serve the production build locally
```

## Testing

Unit/component tests use **Vitest** + **React Testing Library** (jsdom). Tests live
next to the code they cover (`*.test.ts[x]`). Coverage focuses on the logic that
matters for the AI-aware UX and API integration:

- `api/client` — base URL, JWT header, body serialization, 204 handling, and
  `ApiError` normalization (including network failures).
- `components/MessageBubble` — user vs. assistant rendering, sources, and token
  metadata, plus the re-ask action.
- `components/States`, `ModelStatus`, `DocumentStatusBadge` — loading/error/empty
  and status indicators.

```bash
pnpm test
```

## Configuration

| Variable       | Default                      | Description                  |
| -------------- | ---------------------------- | ---------------------------- |
| `VITE_API_URL` | `http://localhost:8000/api`  | Base URL of the backend API. |

## Docker

A multi-stage `Dockerfile` builds the static bundle and serves it with nginx
(SPA fallback in `nginx.conf`). It's wired into the repo `docker-compose.yml`
as the `frontend` service on port `3000`.
