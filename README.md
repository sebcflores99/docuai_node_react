# DocuAI — AI-Assisted Document Q&A Application

> A full-stack, AI-powered application where users paste documents and chat with an assistant that answers **using only that document**, grounding every answer in retrieved passages with **file + page citations**. Agentic - AI First development, using Claude Opus 4.8 in VsCode Copilot.

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

1. **Add a document** (upload a PDF/DOCX/text file, or paste text) via a React frontend
2. **Ask questions** about its content in natural language
3. **Receive grounded answers** with **source citations (file + page)**
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
│  Two-agent AI layer (provider-agnostic):                     │
│   ├─ General agent: answers directly, or calls a tool        │
│   ├─ Tool: search_documents  →  RAG agent (function calling)  │
│   └─ Providers: mock | openai | anthropic (one interface)     │
│                                                              │
│  RAG layer:                                                  │
│   ├─ Chunker (page-aware)                                   │
│   ├─ Embedder (mock | openai) — vectors computed in-app     │
│   └─ Retrieval (Weaviate nearVector, per-user tenant)       │
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

- **Docker** & **Docker Compose** (the app runs entirely in containers)
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
POST   /api/documents          # multipart file upload, or JSON { title, content }
GET    /api/documents/:id
DELETE /api/documents/:id      # 204; also removes vector chunks
```

On create, the document is extracted (PDF/DOCX/text), chunked, embedded, and stored **in the background**; its `status` moves `PROCESSING → READY` (or `FAILED` if ingestion errors). The full ingestion lifecycle is logged as structured JSON.

### Conversations & Messages

```http
GET    /api/conversations?documentId=<id>     # list (optionally filtered)
POST   /api/conversations                     # { documentIds?: [...], title?: "..." }
GET    /api/conversations/:id                 # conversation + messages[]
PATCH  /api/conversations/:id                 # { title } — rename
DELETE /api/conversations/:id                 # 204
POST   /api/conversations/:id/messages        # { content, documentIds? }
```

With no `documentIds`, a conversation searches across **all** the user's READY documents; pass a subset to scope retrieval.

**`POST /:id/messages` response** — persists the user turn and the grounded assistant turn:
```json
{
  "userMessage": { "id": "uuid", "role": "USER", "content": "When was the Eiffel Tower completed?", "createdAt": "..." },
  "assistantMessage": {
    "id": "uuid",
    "role": "ASSISTANT",
    "content": "...answer...\n\nSources: France Facts (p. 1)",
    "model": "gpt-4o-mini",
    "promptTokens": 210,
    "completionTokens": 45,
    "sources": [
      { "documentId": "uuid", "documentTitle": "France Facts", "page": "1", "snippet": "Paris is the capital...", "score": 0.91 }
    ],
    "createdAt": "..."
  }
}
```

`sources` are derived from the **actually retrieved chunks** (not model self-report), and the answer text gets an appended `Sources: <file> (pp. X–Y)` footer.

---

## AI Design & Implementation

### Two-agent design & separation of concerns

A **general agent** answers the user. It is given a single tool, `search_documents`, and decides at inference time whether to call it. When it does, a **RAG agent** embeds the query, retrieves the most relevant passages from the user's documents, and feeds them back so the general agent can answer from real content. The loop is capped at two tool rounds.

The pipeline keeps the three stages the assessment asks for cleanly separated and independently testable:

- **Prompt construction** — `services/ai/promptVersion.ts` holds the versioned system prompt; `ai.service.ts` assembles the message list (system + history + user) and the tool schema.
- **Model invocation** — `services/ai/providers/*` implement one `LLMProvider` interface (including tool calling); the rest of the app never imports a vendor SDK directly.
- **Response post-processing** — `services/rag/sources.ts` turns the retrieved chunks into structured `sources[]` and the human-readable `Sources: <file> (p. X)` footer that is appended to the answer.

### LLM provider abstraction

```typescript
interface LLMProvider {
  readonly name: string;                                   // "mock" | "openai" | "anthropic"
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
```

The request/result types carry optional `tools` and `toolCalls`, so function calling is part of the provider contract — implemented for OpenAI, Anthropic, and the offline mock (which deterministically simulates a `search_documents` call). A factory (`services/ai/providers/index.ts`) selects the implementation from `LLM_PROVIDER` and caches it. Adding a provider means implementing the interface and registering it — no call-site changes.

### Prompt versioning

The active system prompt lives in the `PromptVersion` table (name, version, template, provider, model, isActive). It self-bootstraps a `document-qa` v1 on first use, and every assistant message links to the `promptVersionId` that produced it for auditability and A/B comparison.

### Prompt-injection & unsafe input

1. **Validation** — zod schemas cap question/content/title length and reject malformed bodies.
2. **Control-char sanitization** — stripped from user input before it reaches the model.
3. **Data-not-instructions framing** — the system prompt instructs the model to treat all document content and user questions strictly as data and never to follow instructions found inside them.
4. **Tool output is data** — retrieved passages are returned as a labeled tool result, never executed.
5. **Body size limit** — `express.json({ limit: '1mb' })`.

### RAG flow

1. On upload, text is extracted (PDF/DOCX/text) and **chunked** (~1000 chars, 150 overlap) with **page tracking** — real PDF page boundaries when available, else synthetic ~1800-char pages (or form-feed `\f` breaks).
2. Each chunk is **embedded in the backend** and stored in Weaviate under the user's **tenant** with `{documentId, ownerId, title, chunkIndex, pageStart, pageEnd}`.
3. When the general agent calls `search_documents`, the question is embedded and matched via `nearVector` within the user's tenant (top-K = 6), optionally narrowed to a document subset.
4. Retrieved chunks become the tool result; structured `sources` + the page footer are derived from them.

If retrieval fails or returns nothing (vector store down, not yet indexed), the tool returns "no relevant passages" and the agent says it couldn't find the answer in the user's documents — it never fabricates.

### Cost & rate limiting (strategy)

> Not implemented in code beyond the request body-size cap — documented here as the production approach.

- **Per-user/IP request limits** at the edge or via middleware (e.g. `express-rate-limit` + Redis).
- **Token budgeting** per provider with pre-flight estimation and hard caps.
- **Caching** identical (document, question) pairs; **batching** embeddings.
- **Cheaper default models** (e.g. `gpt-4o-mini`) with escalation only when needed.

### Handling hallucinations / uncertainty

- The system prompt forces the model to search before answering factual questions, to ground its answer **only** in the retrieved passages, and to prefer document facts over its own prior knowledge.
- When nothing relevant is retrieved, the model says it **couldn't find the answer in the user's documents** rather than guessing.
- Every grounded claim ships with **citations** (file + page) drawn from the actual retrieved chunks — a verifiable trust signal the user can check.
- We deliberately **dropped a self-reported confidence score**: LLMs are poorly calibrated, so a fabricated "90% confident" is more misleading than honest, source-backed citations.

---

## Security & Secrets Management

### Secrets approach

A single root **`.env`** (gitignored) holds shared secrets and is injected by Docker Compose. The committed **`.env.example`** is a template; `make init`/`make up` generate a working `.env` for local demos.

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
| Conversations/Messages | Postgres | includes model, token counts, sources                   |
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
| Synchronous LLM calls  | Request blocks during model latency     | Streaming + async queue                      |
| Single backend instance| No horizontal scaling                   | Stateless JWT already enables scaling out    |
| Stateless JWT          | Can't revoke a token before expiry      | Short TTL; Redis blacklist in prod           |
| In-process ingestion   | Background task tied to the API process | Already non-blocking; move to a queue/worker for durability + retries |

**AI limitations:** hallucinations (mitigated via forced retrieval + verifiable citations), context-window limits (mitigated via chunking/retrieval), and cost at scale (caching/batching/cheaper models).

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

- **Tool / function calling (implemented ✅)** — the general agent invokes a `search_documents` tool; the RAG agent runs retrieval and feeds results back.
- **Vector store + RAG (implemented ✅)** — Weaviate, backend-computed embeddings, per-user multi-tenancy, page-aware citations.
- **Background async processing (implemented ✅)** — document extraction + embedding run in the background; `status` lifecycle (`PROCESSING/READY/FAILED`) with structured logs. Next: a durable queue (Bull/SQS) for retries.
- **Provider abstraction + prompt versioning (implemented ✅)**.
- **Streaming responses (planned)** — token-by-token SSE for the chat endpoint.
- **Rate limiting (planned)** — see strategy above.

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
