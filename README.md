# DocuAI — AI-Assisted Document Q&A Application

> A full-stack AI-powered application that enables users to upload documents and interact with an AI assistant to extract insights, answer questions, and retrieve information from their content.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [AI Design & Implementation](#ai-design--implementation)
- [Security & Secrets Management](#security--secrets-management)
- [Data Flow & Storage](#data-flow--storage)
- [Known Limitations & Trade-offs](#known-limitations--trade-offs)
- [Bonus Implementations](#bonus-implementations)

---

## Overview

**DocuAI** addresses the challenge of extracting structured insights from unstructured documents. Users can:

1. **Upload documents** (text or files) via a React frontend
2. **Ask questions** about their content in natural language
3. **Receive AI-generated answers** with context and confidence signals
4. **Refine queries** and explore multi-turn conversations

### Use Case

This implementation covers **AI assistant that answers questions about uploaded documents** — suitable for:
- Customer support document repositories
- Legal/compliance document analysis
- Research paper Q&A
- Knowledge base exploration

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│  (Routing, Auth, Document Upload, Chat UI)                 │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Express.js Backend (Node.js)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes: /health, /auth, /documents, /chat/ask        │   │
│  │ Middleware: JWT auth, validation, error handling     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ AI Layer (LLM Provider Abstraction)                  │   │
│  │ ├─ Prompt Construction & Template Engine            │   │
│  │ ├─ Model Invocation (OpenAI / Anthropic)            │   │
│  │ ├─ Response Parsing & Validation                    │   │
│  │ └─ Cost & Rate Limiting                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Vector Store & Retrieval (RAG Layer)                 │   │
│  │ ├─ Weaviate Vector DB                               │   │
│  │ ├─ Embedding Generation (text2vec-openai)           │   │
│  │ └─ Semantic Similarity Search                        │   │
│  └────────────────────────────────────────────────────┘   │
└────┬──────────────┬──────────────────────┬─────────────────┘
     │              │                      │
┌────▼──┐   ┌──────▼──────┐    ┌──────────▼──────────┐
│Postgres│   │  Weaviate   │    │  OpenAI / Anthropic │
│  (DB)  │   │ (Vector DB) │    │   (LLM Provider)    │
└────────┘   └─────────────┘    └─────────────────────┘
```

### Technology Stack

| Layer       | Technology              | Purpose                                 |
|-------------|-------------------------|-----------------------------------------|
| Frontend    | React 18, TypeScript    | User interface & routing                |
| Backend     | Express.js, Node.js     | API server & business logic             |
| Database    | PostgreSQL 16           | Structured data (users, documents)      |
| Vector DB   | Weaviate 1.24.6         | Semantic search & embeddings            |
| LLM         | OpenAI API              | AI model for Q&A & analysis             |
| Container   | Docker & Docker Compose | Local development & deployment          |
| ORM         | Prisma 6.1              | Type-safe database access               |

---

## Getting Started

### Prerequisites

- **Docker** & **Docker Compose** (for containerized setup)
- **Node.js 18+** & **pnpm** (for local development without Docker)
- **OpenAI API Key** (or compatible LLM provider)

### Quick Start (with Docker)

1. **Clone & navigate to repo**
   ```bash
   cd FS_AI_ENG_Assessment
   ```

2. **Create `.env` from template**
   ```bash
   cp .env.example .env
   # Edit .env and add your real OPENAI_API_KEY and JWT_SECRET
   ```

3. **Start services**
   ```bash
   make up-d    # Start in background
   make logs    # View logs
   ```

4. **Verify services**
   ```bash
   make ps
   # Backend: http://localhost:8000/health
   # Frontend: http://localhost:3000
   # Weaviate: http://localhost:8080
   ```

5. **Stop services**
   ```bash
   make down
   ```

### Local Development (without Docker)

#### Backend Setup

```bash
cd backend
pnpm install

# Create .env from template
cp .env.example .env

# Run migrations
pnpm prisma:migrate

# Start dev server
pnpm dev  # Runs on http://localhost:8000
```

#### Frontend Setup

```bash
cd docu-ai-front
pnpm install
pnpm dev  # Runs on http://localhost:3000
```

### Environment Setup

Create `.env` file from `.env.example`:

```env
# OpenAI API Key — used by backend & Weaviate text2vec-openai
OPENAI_API_KEY=sk-...

# JWT signing secret — generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-secret-here

# LLM provider (openai | anthropic)
LLM_PROVIDER=openai
```

**For local backend dev**, copy `.env` to `backend/.env`:
```bash
cp .env backend/.env
```

---

## API Documentation

### Authentication

All endpoints (except `/health`) require JWT:

```http
Authorization: Bearer <JWT_TOKEN>
```

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-11T01:00:00.000Z",
  "version": "1.0.0"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {"id": "user-123", "email": "user@example.com"}
}
```

#### Ask Question About Document
```http
POST /chat/ask
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "documentId": "doc-123",
  "question": "What are the key findings?",
  "context": "previous-message-id"
}
```

**Response:**
```json
{
  "messageId": "msg-456",
  "answer": "Based on the document...",
  "confidence": 0.92,
  "sources": [{"documentId": "doc-123", "excerpt": "...", "score": 0.95}],
  "status": "completed",
  "processingTime": 1250
}
```

---

## AI Design & Implementation

### LLM Provider Abstraction

Abstracts LLM provider details to enable:
- Easy switching between OpenAI, Anthropic, etc.
- Testing with mocked providers
- Cost control and rate limiting per provider
- Prompt versioning independent of model changes

```typescript
interface LLMProvider {
  invoke(prompt: string, options: InvokeOptions): Promise<LLMResponse>;
  getName(): string;
  supportsStreaming(): boolean;
}
```

### Prompt Construction & Safety

**Injection Prevention:**
1. Input validation — strip/escape special characters before embedding
2. Parametric queries — structured format specs instead of concatenation
3. Length limits — cap question/context to prevent token abuse
4. Schema enforcement — validate LLM responses against expected JSON

### Cost & Rate Limiting

```typescript
class RateLimiter {
  private tokenBudget = {
    openai: 1_000_000 / 30,       // ~33k tokens/day
    anthropic: 100_000_000 / 30   // ~3.3M tokens/day
  };

  async checkLimit(provider: string, tokens: number): Promise<void> {
    const remaining = await this.getRemaining(provider);
    if (remaining < tokens) {
      throw new Error(`Rate limit exceeded`);
    }
  }
}
```

### Vector Search Integration (RAG)

**Flow:**
1. User uploads document → extract text & generate embeddings
2. Embeddings stored in Weaviate with metadata
3. User asks question → generate embedding for question
4. Semantic search retrieves top-K similar passages
5. Pass context to LLM for grounded answer

**Chunking:** 500-token chunks with 100-token overlap

### Handling Hallucinations

1. **Confidence scoring** — track LLM deviation from retrieved context
2. **Citation enforcement** — require sources for factual claims
3. **Fallback retrieval** — return top passages if confidence < threshold
4. **Explicit uncertainty** — LLM trained to say "I don't know"

---

## Security & Secrets Management

### Secrets Approach

**Single `.env` file for the entire stack:**

```
.env              ← Shared secrets (never committed, in .gitignore)
                    Contains: OPENAI_API_KEY, JWT_SECRET
                    Loaded by: backend, weaviate
```

**Why simple is better:**
- ✅ Single source of truth
- ✅ Easy rotation (update `.env`, restart services)
- ✅ No duplication across multiple env files
- ✅ Postgres credentials stay inline (not sensitive in dev)

### Docker Compose Integration

```yaml
backend:
  env_file:
    - .env          # Loads OPENAI_API_KEY, JWT_SECRET

weaviate:
  env_file:
    - .env          # Loads OPENAI_APIKEY for text2vec-openai

postgres:
  environment:
    POSTGRES_USER: postgres           # Dev defaults
    POSTGRES_PASSWORD: postgres       # (inline, not sensitive)
    POSTGRES_DB: docuai
```

### JWT Implementation

- **Secret**: 256-bit random hex
- **Algorithm**: HS256
- **Expiration**: 7 days
- **Rotation**: Via `/auth/refresh` endpoint

### API Key Rotation (Production)

```bash
1. Generate new key in OpenAI dashboard
2. Update .env with new key
3. Redeploy: make restart
4. Monitor logs for successful auth
5. Delete old key
```

---

## Data Flow & Storage

### Data Retention Policy

| Data Type          | Storage   | Retention | Rationale                  |
|--------------------|-----------|-----------|----------------------------|
| User Credentials   | Postgres  | Until deletion | Must persist securely   |
| Documents          | Postgres  | Until deletion | User-owned content      |
| AI Embeddings      | Weaviate  | Until deletion | Required for search     |
| Conversation       | Postgres  | 90 days   | Audit trail & UX context   |
| API Logs           | App       | 30 days   | Debugging, no PII stored   |
| OpenAI Responses   | Postgres  | 90 days   | Quality evaluation      |

### PII Handling

**Safeguards:**
1. Database encryption for sensitive fields
2. No PII in application logs
3. Data anonymization for AI training
4. Hard delete all user data on account termination

### Document Processing

```
Upload → Scan → Extract → Chunk → Embed → Store → Ready
```

---

## Known Limitations & Trade-offs

### Architecture Trade-offs

| Decision           | Trade-off                        | Mitigation                            |
|--------------------|---------------------------------|---------------------------------------|
| Single Backend     | No horizontal scaling            | Add load balancing + multiple instances |
| Sync LLM Calls     | Blocks during latency (5-20s)    | Async via Bull queues in production   |
| Vector DB Local    | Single point of failure          | Use managed Weaviate Cloud in prod    |
| Stateless JWT      | Can't revoke immediately         | Redis token blacklist for production  |

### AI Limitations

1. **Hallucinations** — LLM may fabricate facts
   - Mitigation: Citations, confidence scoring, source display

2. **Context Window** — Large documents exceed token limits
   - Mitigation: Chunking, summarization, multi-hop retrieval

3. **Semantic Gaps** — Embeddings miss nuanced relationships
   - Mitigation: Hybrid search (keyword + semantic), human feedback

4. **Cost at Scale** — API costs scale with usage
   - Mitigation: Caching, batching, cheaper models, self-hosted inference

---

## Bonus Implementations

### Vector Store (Implemented ✅)
- Weaviate 1.24.6
- OpenAI embeddings (1536 dimensions)
- Semantic similarity search
- 500-token chunks with 100-token overlap

### Async Processing (Ready)
```typescript
const queue = new Queue('document-processing');
queue.process(async (job) => {
  // Generate embeddings, store, notify frontend
});
```

### Streaming Responses (Ready)
```typescript
app.get('/chat/ask-stream', (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  // Stream tokens as they arrive
});
```

### Cost Estimation

| Metric | 1k Requests | 10k Requests | 100k Requests |
|--------|-------------|--------------|---------------|
| OpenAI | $2-5 | $20-50 | $200-500 |
| Weaviate | $0 | $0 | $0 |
| Postgres | $10/mo | $25/mo | $50/mo |
| **Total** | ~$15 | ~$50 | ~$300 |

---

## Infrastructure & Deployment

### AWS Strategy

```yaml
Compute:
  - ECS Fargate (serverless, auto-scaling)
  - CloudFront CDN for frontend
  - RDS Postgres managed

AI:
  - Weaviate Cloud managed service
  - OpenAI API

Secrets:
  - AWS Secrets Manager for API keys
  - IAM roles for authentication

IaC:
  - Terraform modules
  - Separate tfvars for dev/staging/prod
```

### Scaling AI Workloads

1. **LLM rate limits** — Implement request queue
2. **Embedding generation** — Batch & cache
3. **Vector DB indexing** — Manage refresh latency
4. **Database connections** — Connection pooling

---

## Development

### Code Structure

```
backend/
├── src/
│   ├── api/routes/
│   ├── services/{llm,rag,auth}/
│   ├── config/{env,prisma}/
│   └── index.ts
├── prisma/{schema,migrations}/
└── Dockerfile

frontend/
├── src/{pages,components,services,hooks}/
└── Dockerfile
```

### Workflow

1. Create branch: `git checkout -b feature/my-feature`
2. Implement & test locally
3. Commit: `git commit -m "feat: description"`
4. Push & open PR

---

## Troubleshooting

### Backend fails to start
- Check `.env` has valid `OPENAI_API_KEY`
- Verify Postgres running: `make ps`
- Check logs: `make logs-backend`

### Frontend can't reach backend
- Verify backend on `localhost:8000`: `make ps`
- Check CORS config
- Clear browser cache (Ctrl+Shift+R)

### Weaviate connection fails
- Verify healthy: `make ps`
- Check `.env` has `OPENAI_APIKEY`
- Check logs: `make logs-weaviate`

### Out of memory
- Reduce chunk size
- Limit concurrent embeddings to 3-5
- Use managed Weaviate Cloud

---

## License

ISC — See LICENSE file.

---

**Questions?** See `docs/Full_Stack_AI_Engineer_Assessment\ \(1\).md`.
