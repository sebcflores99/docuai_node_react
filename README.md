# DocuAI — AI-Assisted Document Q&A Application

> A full-stack, AI-powered application where users paste documents and chat with an assistant that answers **using only that document**, grounding every answer in retrieved passages with **file + page citations**.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [AI Design & Implementation](#ai-design--implementation)
- [Security & Secrets Management](#security--secrets-management)
- [Data Flow & Storage](#data-flow--storage)
- [Known Limitations & Trade-offs](#known-limitations--trade-offs)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Bonus & Future Work](#bonus--future-work)

---

## Overview

**DocuAI** lets users extract insights from their own documents through conversation. Users can:

1. **Add a document** (paste text) via a React frontend
2. **Ask questions** about its content in natural language
3. **Receive grounded answers** with a confidence signal and **source citations (file + page)**
4. **Refine and re-ask** across a multi-turn conversation

### Runs offline by default

The whole stack runs locally with **no API keys**. The default `LLM_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` use a deterministic mock model and a deterministic local embedder, so you can demo the complete flow (auth → ingest → RAG retrieval → cited answer) entirely offline. Point the providers at OpenAI/Anthropic to use real models (see [Environment Setup](#environment-setup)).

### Use case

This implements **"AI assistant that answers questions about uploaded documents"** — suitable for support knowledge bases, legal/compliance review, and research-paper Q&A.

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend (Vite)                  │
│  Login · Documents (Input) · Chat (Results)                  │
│  Served by nginx, which also proxies /api → backend          │
└────────────────────────┬─────────────────────────────────────┘
                         │  /api/*  (same-origin, no CORS)
┌────────────────────────▼─────────────────────────────────────┐
│                 Express 5 Backend (Node + TS)                │
│  Routes: /api/health · /api/auth · /api/documents            │
│          · /api/conversations                                │
│  Middleware: JWT auth · zod validation · error handling      │
│                                                              │
│  AI layer (provider-agnostic):                               │
│   ├─ Prompt construction (versioned template + context)     │
│   ├─ Model invocation   (mock | openai | anthropic)         │
│   └─ Response post-processing (JSON parse → structured)     │
│                                                              │
│  RAG layer:                                                  │
│   ├─ Chunker (page-aware)                                   │
│   ├─ Embedder (mock | openai) — vectors computed in-app     │
│   └─ Retrieval (Weaviate nearVector, scoped per document)   │
└────┬──────────────────┬───────────────────┬─────────────────┘
     │                  │                   │
┌────▼────┐    ┌────────▼────────┐   ┌──────▼───────────────┐
│ Postgres │    │    Weaviate     │   │ OpenAI / Anthropic   │
│ (Prisma) │    │ vectorizer:none │   │ (only if configured) │
└──────────┘    └─────────────────┘   └──────────────────────┘
```

Embeddings are **computed by the backend** and stored in Weaviate with `vectorizer: none`. Weaviate therefore needs no vectorizer module or API key, which is what keeps the offline/mock path working.

### Technology Stack

| Layer       | Technology                       | Purpose                                   |
|-------------|----------------------------------|-------------------------------------------|
| Frontend    | React 19, TypeScript, Vite       | UI & routing; nginx serves + proxies /api |
| Backend     | Express 5, Node 20, TypeScript   | REST API & business logic                 |
| Database    | PostgreSQL 16 + Prisma 6         | Users, documents, conversations, messages |
| Vector DB   | Weaviate 1.24.6 (`vectorizer:none`) | Semantic search over document chunks   |
| LLM         | mock (default) · OpenAI · Anthropic | Pluggable provider via `LLM_PROVIDER`  |
| Embeddings  | mock (default) · OpenAI          | Pluggable via `EMBEDDING_PROVIDER`        |
| Container   | Docker & Docker Compose          | One-command local stack                   |

---

## Getting Started

### Prerequisites

- **Docker** & **Docker Compose** (for the containerized stack)
- For local dev without Docker: **Node 20+** and **pnpm 10** (`corepack enable`)
- **No API keys required** for the default mock providers

### Quick Start (with Docker)

```bash
make init      # first run: builds images, generates .env, starts everything (detached)
# open http://localhost:3000  → sign up → add a document → ask questions
make ps        # show running containers
make down      # stop and remove containers
```

`make init` (and `make up`/`make build`) auto-creates a demo `.env` (mock LLM + mock embeddings + a random `JWT_SECRET`) if one doesn't exist, so the stack runs offline with no API keys. After the first build, use `make up` to start and `make down` to stop. Migrations are applied automatically on backend startup.

Available targets: `make help` lists them — `init`, `build`, `up`, `down`, `ps`.
To follow logs or wipe data, use Docker directly: `docker compose logs -f` and `docker compose down -v`.

Service URLs:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/api/health
- Weaviate ready: http://localhost:8080/v1/.well-known/ready

### Local Development (without Docker)

You'll need Postgres and Weaviate running (e.g. `docker compose up -d postgres weaviate`).

```bash
# Backend
cd backend
pnpm install
cp .env.example .env        # then edit values
pnpm prisma:migrate         # apply migrations (prisma migrate dev)
pnpm dev                    # http://localhost:8000

# Frontend (separate terminal)
cd docu-ai-front
pnpm install
pnpm dev                    # http://localhost:5173 (Vite dev server)
```

For local dev the frontend reads `VITE_API_URL` (defaults to `http://localhost:8000/api`).

### Environment Setup

The Docker stack reads a single root `.env`. `make init`/`make up` auto-generate one for mock mode; to use real models, set the keys and switch providers:

```env
# Leave blank for offline mock mode
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Auth
JWT_SECRET=<32-byte hex>        # auto-generated by make init/up
JWT_EXPIRES_IN=7d

# Providers: mock (no key) | openai | anthropic
LLM_PROVIDER=mock
# Embeddings: mock (no key) | openai  (auto-selects openai when OPENAI_API_KEY is set)
EMBEDDING_PROVIDER=mock
# EMBEDDING_MODEL=text-embedding-3-small
```

> Switching embedders changes vector dimensionality (mock = 256, OpenAI `text-embedding-3-small` = 1536). **Re-ingest documents after switching**, or run `docker compose down -v` to reset the vector store.

---

## API Documentation

Base path: **`/api`**. In Docker the frontend calls it same-origin via the nginx proxy; directly it's `http://localhost:8000/api`.

### Authentication

All routes except `/api/health*` and `/api/auth/*` require a Bearer token:

```http
Authorization: Bearer <JWT_TOKEN>
```

Errors use a flat shape: `{ "message": string, "code": string }`.

### Health

```http
GET /api/health        → { "status": "ok", "service": "docu-ai-backend", "timestamp": "..." }
GET /api/health/db     → { "status": "ok", "database": "connected" }
```

### Auth

```http
POST /api/auth/register      # alias: POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me            # requires auth
```

`register` / `login` body: `{ "email": "...", "password": "..." }` (password ≥ 8 chars).

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "email": "user@example.com", "createdAt": "2026-06-11T07:16:36.297Z" }
}
```

### Documents

```http
GET    /api/documents          # list own documents
POST   /api/documents          # { "title": "...", "content": "..." }
GET    /api/documents/:id
DELETE /api/documents/:id      # 204; also removes vector chunks
```

On create, the document is chunked, embedded, and stored; its `status` moves `PROCESSING → READY` (or `FAILED` if ingestion errors, in which case retrieval falls back to full text).

### Conversations & Messages

```http
GET  /api/conversations?documentId=<id>     # list (optionally filtered)
POST /api/conversations                     # { "documentId": "...", "title?": "..." }
GET  /api/conversations/:id                 # conversation + messages[]
POST /api/conversations/:id/messages        # { "content": "your question" }
```

**`POST /:id/messages` response** — persists the user turn and the grounded assistant turn:
```json
{
  "userMessage": { "id": "uuid", "role": "USER", "content": "When was the Eiffel Tower completed?", "createdAt": "..." },
  "assistantMessage": {
    "id": "uuid",
    "role": "ASSISTANT",
    "content": "...answer...\n\nSources: France Facts (p. 1)",
    "confidence": 0.65,
    "model": "mock-model",
    "promptTokens": 210,
    "completionTokens": 45,
    "sources": [
      { "documentId": "uuid", "documentTitle": "France Facts", "page": "1", "snippet": "Paris is the capital...", "score": 0.91 }
    ],
    "createdAt": "..."
  }
}
```

`confidence` is normalized to `0..1` (low/medium/high → 0.3/0.65/0.9). `sources` are derived from the **actually retrieved chunks**, and the answer text gets an appended `Sources: <file> (pp. X–Y)` footer.

---

## AI Design & Implementation

### Clear separation of concerns

The AI pipeline is split into three independently testable stages (per the assessment):

- **Prompt construction** — `services/ai/promptBuilder.ts` wraps the question and retrieved context in explicit `<context>` / `<question>` delimiters using the active prompt template.
- **Model invocation** — `services/ai/providers/*` implement a single `LLMProvider` interface; the rest of the app never imports a vendor SDK directly.
- **Response post-processing** — `services/ai/postProcess.ts` defensively parses the model output into `{ answer, confidence, citations }` (strips code fences, extracts the JSON object, falls back to low-confidence prose).

### LLM provider abstraction

```typescript
interface LLMProvider {
  readonly name: string;                                   // "mock" | "openai" | "anthropic"
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
```

A factory (`services/ai/providers/index.ts`) selects the implementation from `LLM_PROVIDER` and caches it. Adding a provider means implementing the interface and registering it — no call-site changes.

### Prompt versioning

The active system prompt lives in the `PromptVersion` table (name, version, template, provider, model, isActive). It self-bootstraps a `document-qa` v1 on first use, and every assistant message links to the `promptVersionId` that produced it for auditability and A/B comparison.

### Prompt-injection & unsafe input

1. **Validation** — zod schemas cap question/content/context length and reject malformed bodies.
2. **Control-char sanitization** — stripped from user input before it reaches the model.
3. **Delimited, data-not-instructions framing** — the system prompt instructs the model to treat `<context>`/`<question>` strictly as data and never to follow instructions found inside them.
4. **Schema-enforced output** — responses are validated/normalized, never `eval`'d.
5. **Body size limit** — `express.json({ limit: '1mb' })`.

### RAG flow

1. On upload, text is **chunked** (≈1000 chars, 150 overlap) with **page tracking** — synthetic ~1800-char pages, or real form-feed (`\f`) breaks when present.
2. Each chunk is **embedded in the backend** and stored in Weaviate with `{documentId, ownerId, title, chunkIndex, pageStart, pageEnd}`.
3. A question is embedded and matched via `nearVector`, **scoped to the document** (top-K = 4).
4. Retrieved chunks become the labeled context block; sources + page footer are derived from them.

If retrieval fails or returns nothing (vector store down, not yet indexed), it **gracefully falls back** to the document's full text so answers still work.

### Cost & rate limiting (strategy)

> Not implemented in code beyond the request body-size cap — documented here as the production approach.

- **Per-user/IP request limits** at the edge or via middleware (e.g. `express-rate-limit` + Redis).
- **Token budgeting** per provider with pre-flight estimation and hard caps.
- **Caching** identical (document, question) pairs; **batching** embeddings.
- **Cheaper default models** (e.g. `gpt-4o-mini`) with escalation only when needed.

### Handling hallucinations / uncertainty

- System prompt: answer **only** from context, else say so → low confidence.
- Confidence surfaced numerically; the UI shows a warning + nudge to verify when low.
- Truthful **citations** drawn from retrieved chunks (not model self-report), shown with file + page.

---

## Security & Secrets Management

### Secrets approach

A single root **`.env`** (gitignored) holds shared secrets and is injected by Docker Compose. `*.env.example` files are committed as templates; `make init`/`make up` generate a working `.env` for local demos.

```
.env            ← OPENAI_API_KEY, ANTHROPIC_API_KEY, JWT_SECRET, provider switches
                  (never committed; in .gitignore)
```

Postgres uses inline non-sensitive dev defaults in `docker-compose.yml`. Weaviate needs no secret (vectorizer none).

### JWT implementation

- **Algorithm**: HS256 · **Secret**: 256-bit hex · **Lifetime**: `JWT_EXPIRES_IN` (default 7d)
- Stateless Bearer tokens; passwords hashed with **bcrypt** (cost 12)
- Login uses a constant-time dummy compare to avoid user-enumeration

### API key rotation (production)

```
1. Create the new key in the provider dashboard
2. Update the secret (.env locally; Secrets Manager in prod)
3. Roll the service (`make down && make up` / new task revision)
4. Verify, then revoke the old key
```

In production these keys would live in **AWS Secrets Manager / SSM**, not a file (see [Infrastructure](#infrastructure--deployment)).

---

## Data Flow & Storage

### What we store vs. don't

| Data              | Store    | Notes                                                        |
|-------------------|----------|--------------------------------------------------------------|
| User credentials  | Postgres | email + **bcrypt** hash (never plaintext)                    |
| Documents         | Postgres | user-owned text content                                      |
| Document chunks   | Weaviate | text + embedding vector + page metadata                      |
| Conversations/Messages | Postgres | includes model, token counts, confidence, sources      |
| API keys          | —        | env/secret store only; never persisted in the DB            |

### Retention & PII (policy)

- Hard-delete a document → its Postgres row **and** its Weaviate chunks are removed.
- Account deletion would cascade user data (FKs use `onDelete: Cascade`).
- Avoid logging PII; mask unexpected errors as generic 500s.
- Production: encrypt at rest (RDS/KMS), define explicit retention windows for conversations and logs.

See **`docs/PART2_AI_DATA_AND_ARCHITECTURE.md`** for the full Part 2 write-up (evaluation, regression detection, wrong-answer handling).

---

## Known Limitations & Trade-offs

| Decision               | Trade-off                              | Mitigation / future                          |
|------------------------|----------------------------------------|----------------------------------------------|
| Mock providers default | Mock embeddings are lexical, not semantic | Set `*_PROVIDER=openai` for real retrieval |
| Synchronous ingestion  | Large docs block the create request    | Move to a queue/worker (status already modeled) |
| Synchronous LLM calls  | Request blocks during model latency     | Streaming + async queue                      |
| Single backend instance| No horizontal scaling                   | Stateless JWT already enables scaling out    |
| Stateless JWT          | Can't revoke a token before expiry      | Short TTL; Redis blacklist in prod           |
| Char-offset "pages"    | Synthetic for pasted text               | Real page extraction when PDF upload is added |

**AI limitations:** hallucinations (mitigated via citations + confidence), context-window limits (mitigated via chunking/retrieval), and cost at scale (caching/batching/cheaper models).

---

## Infrastructure & Deployment

> Local-first for this assessment (`make init`). The AWS design below is the intended production target, not provisioned here.

```yaml
Compute:
  - ECS Fargate for backend (auto-scaling), CloudFront + S3 for the frontend
Data:
  - RDS Postgres (managed), Weaviate Cloud or self-managed on ECS/EKS
Secrets:
  - AWS Secrets Manager / SSM for API keys + JWT secret; IAM task roles
IaC:
  - Terraform modules, per-env tfvars (dev/staging/prod)
```

**Scaling AI workloads:** queue + rate-limit LLM calls, batch & cache embeddings, pool DB connections, and isolate bursty inference behind async workers so the API stays responsive.

---

## Bonus & Future Work

- **Vector store + RAG (implemented ✅)** — Weaviate, backend-computed embeddings, page-aware citations, graceful fallback.
- **Provider abstraction + prompt versioning (implemented ✅)**.
- **Async processing (planned)** — document `status` lifecycle is already modeled (`PROCESSING/READY/FAILED`); move ingestion to a Bull/SQS worker.
- **Streaming responses (planned)** — token-by-token SSE for the chat endpoint.
- **Rate limiting (planned)** — see strategy above.
- **Automated tests (planned)** — pure logic (chunker pages, source footer, post-processing) is structured to be unit-testable.

### Indicative cost (real OpenAI; mock = $0)

| Requests | LLM (gpt-4o-mini + embeddings) | Notes                    |
|----------|--------------------------------|--------------------------|
| 1k       | ~$1–5                          | depends on doc/answer size |
| 10k      | ~$15–50                        | add caching to reduce    |
| 100k     | ~$150–500                      | batch + cache + cheaper models |

---

## Troubleshooting

**Backend won't start** — `docker compose logs -f backend`; ensure Postgres/Weaviate are healthy (`make ps`). Migrations run on startup.

**Frontend can't reach backend** — in Docker the SPA uses the nginx `/api` proxy (no CORS). Confirm all containers are up; hard-refresh the browser.

**Weaviate issues** — `docker compose logs -f weaviate`; it uses `vectorizer: none` and needs no API key.

**Switched providers but retrieval looks off** — re-ingest documents (vector dimensions differ) or `docker compose down -v` to reset.

---

## License

ISC — see LICENSE.
