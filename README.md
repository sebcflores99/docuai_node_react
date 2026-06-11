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

1. **Clone & navigate to the repo**
   ```bash
   cd FS_AI_ENG_Assessment
   ```

2. **Copy environment files**
   ```bash
   # Create service-specific env files from examples
   cp .env.backend .env.backend  # Fill in real OPENAI_API_KEY & JWT_SECRET
   cp .env.postgres .env.postgres
   cp .env.weaviate .env.weaviate
   ```

3. **Start services using Makefile**
   ```bash
   make up-d    # Start in background
   make logs    # View logs
   ```

4. **Verify services**
   ```bash
   make ps      # List running containers
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

# Create local .env file
cp .env.example .env

# Run Prisma migrations
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

### Environment Variables

Create `.env.*` files from the `.env.*.example` templates:

**`.env.backend`** — Backend secrets
```env
OPENAI_API_KEY=sk-...        # Your OpenAI API key
JWT_SECRET=<generate-random> # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
LLM_PROVIDER=openai          # Switch: openai | anthropic
```

**`.env.postgres`** — PostgreSQL credentials
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=docuai
```

**`.env.weaviate`** — Vector DB secrets
```env
OPENAI_APIKEY=sk-...  # Same as backend for text2vec-openai
```

---

## API Documentation

### Authentication

All endpoints (except `/health`) require JWT authentication in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

### Endpoints

#### Health Check
```http
GET /health
```
✅ Public endpoint — no auth required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-11T01:00:00.000Z",
  "version": "1.0.0"
}
```

#### Login / Register
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
  "user": {
    "id": "user-123",
    "email": "user@example.com"
  }
}
```

#### Ask Question About Document
```http
POST /chat/ask
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "documentId": "doc-123",
  "question": "What are the key findings in this document?",
  "context": "previous-message-id"
}
```

**Response:**
```json
{
  "messageId": "msg-456",
  "answer": "Based on the document...",
  "confidence": 0.92,
  "sources": [
    {
      "documentId": "doc-123",
      "excerpt": "...",
      "score": 0.95
    }
  ],
  "status": "completed",
  "processingTime": 1250
}
```

---

## AI Design & Implementation

### LLM Provider Abstraction

The backend abstracts LLM provider details to enable:
- **Easy switching** between OpenAI, Anthropic, etc.
- **Testing** with mocked providers
- **Cost control** and rate limiting per provider
- **Prompt versioning** independent of model changes

**Architecture:**
```typescript
interface LLMProvider {
  invoke(prompt: string, options: InvokeOptions): Promise<LLMResponse>;
  getName(): string;
  supportsStreaming(): boolean;
}
```

### Prompt Construction & Safety

**Injection Prevention:**
1. **Input Validation** — Strip/escape special characters before embedding in prompts
2. **Parametric Queries** — Use structured format specs instead of string concatenation
3. **Length Limits** — Cap questions/context to prevent token abuse
4. **Schema Enforcement** — Validate LLM responses against expected JSON schema

### Cost & Rate Limiting

```typescript
class RateLimiter {
  private tokenBudget = {
    openai: 1_000_000 / 30,      // ~33k tokens/day
    anthropic: 100_000_000 / 30  // ~3.3M tokens/day
  };

  async checkLimit(provider: string, tokens: number): Promise<void> {
    const remaining = await this.getRemaining(provider);
    if (remaining < tokens) {
      throw new Error(`Rate limit exceeded for ${provider}`);
    }
  }
}
```

### Vector Search Integration (RAG)

**Flow:**
1. User uploads document → Extract text & generate embeddings
2. Embeddings stored in Weaviate with document metadata
3. User asks question → Generate embedding for question
4. Semantic search retrieves top-K similar passages
5. Pass retrieved context to LLM for grounded answer

**Chunking Strategy:**
- 500-token chunks with 100-token overlap
- Preserves document continuity
- Enables efficient retrieval

### Handling Hallucinations & Uncertainty

1. **Confidence Scoring** — Track when LLM deviates from retrieved context
2. **Citation Enforcement** — Require LLM to cite sources for factual claims
3. **Fallback to Retrieval** — If confidence < threshold, return top passages directly
4. **Explicit Uncertainty** — LLM trained to say "I don't know" when context insufficient

---

## Security & Secrets Management

### Secrets Handling

All sensitive data is isolated in **service-specific `.env` files** and never committed:

```
Root level - architecture documentation
.env.example

Service-specific - NEVER committed (in .gitignore)
.env.backend      ← Backend secrets (OPENAI_API_KEY, JWT_SECRET)
.env.postgres     ← DB credentials
.env.weaviate     ← Vector DB API keys
```

### Docker Compose Integration

Each service loads secrets via `env_file`:

```yaml
services:
  backend:
    env_file:
      - .env.backend    # Loads OPENAI_API_KEY, JWT_SECRET
    environment:
      - NODE_ENV=development  # Non-sensitive config
      
  postgres:
    env_file:
      - .env.postgres   # Loads POSTGRES_USER, POSTGRES_PASSWORD
```

### JWT Implementation

- **Secret**: 256-bit random hex (generated at setup)
- **Algorithm**: HS256 (HMAC-SHA256)
- **Expiration**: 7 days for session tokens
- **Rotation**: Implement via `/auth/refresh` endpoint

### API Key Rotation (Production)

```bash
# Rotate OpenAI API key without downtime:
1. Generate new key in OpenAI dashboard
2. Update .env.backend with new key
3. Redeploy backend: make restart
4. Monitor logs for successful auth
5. Delete old key from OpenAI dashboard
```

---

## Data Flow & Storage

### Data Retention Policy

| Data Type             | Storage      | Retention  | Rationale                    |
|-----------------------|--------------|------------|------------------------------|
| User Credentials      | PostgreSQL   | Until deletion | Must persist securely         |
| Documents             | PostgreSQL   | Until deletion | User-owned content            |
| AI Embeddings         | Weaviate     | Until deletion | Required for semantic search  |
| Conversation History  | PostgreSQL   | 90 days    | Audit trail & UX context     |
| API Logs              | Application  | 30 days    | Debugging, no PII stored      |
| OpenAI Responses      | PostgreSQL   | 90 days    | Quality evaluation & reuse    |

### PII Handling

**What's considered PII:**
- User email addresses
- Document file names
- User question history
- AI response text with user-specific data

**Safeguards:**
1. Database encryption for sensitive fields
2. No PII in application logs
3. Data anonymization for AI training
4. Hard delete all user data on account termination

### Document Processing Pipeline

```
User Upload
    ↓
Virus Scan (optional)
    ↓
Extract Text
    ↓
Split into Chunks (500 tokens, 100 overlap)
    ↓
Generate Embeddings (text2vec-openai)
    ↓
Store in PostgreSQL (metadata) + Weaviate (vectors)
    ↓
Ready for Q&A
```

---

## Known Limitations & Trade-offs

### Architecture Trade-offs

| Decision                    | Trade-off                                  | Rationale                           |
|-----------------------------|-------------------------------------------|-------------------------------------|
| Single Backend Instance     | No horizontal scaling out-of-box           | Simplifies for assessment; extend with load balancing |
| Synchronous LLM Calls       | Blocks during LLM latency (5-20s)          | Simpler MVP; async via Bull in production |
| Vector DB Local             | Single point of failure; no replication    | Dev-friendly; use managed Weaviate Cloud in production |
| JWT Stateless Auth          | Can't revoke tokens immediately            | Add Redis token blacklist for production logout |
| No Document Versioning      | Users can't access historical states       | Could implement via Prisma soft deletes |

### AI Limitations

1. **Hallucinations** — LLM may fabricate facts outside retrieved context
   - Mitigation: Enforce citation requirements; score confidence; show sources

2. **Context Window** — Large documents exceed LLM token limits
   - Mitigation: Chunking with overlap; summarization; multi-hop retrieval

3. **Semantic Gaps** — Embedding models may miss nuanced relationships
   - Mitigation: Hybrid search (keyword + semantic); human feedback loops

4. **Cost at Scale** — OpenAI API costs scale with usage
   - Mitigation: Caching, batching, cheaper models (GPT-3.5), self-hosted inference

---

## Bonus Implementations

### Vector Store Integration (Implemented ✅)

- **Vector DB**: Weaviate 1.24.6
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Retrieval**: Semantic similarity search with cosine distance
- **Chunking**: 500-token chunks with 100-token overlap

### Async Processing (Ready for Implementation)

```typescript
// Future: Bull queue for background jobs
import Queue from 'bull';

const documentProcessingQueue = new Queue('document-processing');

documentProcessingQueue.process(async (job) => {
  const { documentId } = job.data;
  // Extract text, generate embeddings, store
  // Send notification when done
});
```

### Streaming Responses (Ready for Implementation)

```typescript
// Future: SSE for token-by-token streaming
app.get('/chat/ask-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  
  const stream = await llmProvider.invokeStream(prompt);
  stream.on('data', (chunk) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  });
});
```

### Cost Estimation

For **1k / 10k / 100k requests**:

| Metric | 1k Requests | 10k Requests | 100k Requests |
|--------|-------------|--------------|---------------|
| OpenAI API | $2-5 | $20-50 | $200-500 |
| Weaviate (self-hosted) | $0 | $0 | $0 |
| PostgreSQL (AWS RDS) | $10/mo | $25/mo | $50/mo |
| **Total Monthly** | ~$15 | ~$50 | ~$300 |

---

## Infrastructure & Deployment (Future)

### AWS Deployment Strategy

```yaml
Compute:
  - ECS Fargate for backend (serverless, auto-scaling)
  - CloudFront for frontend CDN
  - RDS Postgres for primary DB

AI & Vector Search:
  - Weaviate Cloud managed service
  - OpenAI API (no self-hosting)

Secrets:
  - AWS Secrets Manager for API keys
  - IAM roles for service authentication

Infrastructure as Code:
  - Terraform modules for reproducible deployment
  - Separate .tfvars for dev/staging/prod
```

### Scaling Constraints for AI Workloads

1. **LLM API Rate Limits** — OpenAI rate-limits by tokens/min; implement queue
2. **Embedding Generation** — Batch embeddings; cache repeated documents
3. **Vector DB** — Index refresh latency during bulk loads
4. **Database Connections** — Pool connections; close idle after 5min

---

## Making Changes

### Code Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/          # Express routes
│   │   └── middleware/       # Auth, validation, error handling
│   ├── services/
│   │   ├── llm/             # LLM provider abstraction
│   │   ├── rag/             # RAG & vector search
│   │   └── auth/            # JWT & authentication
│   ├── config/
│   │   ├── env.ts           # Environment configuration
│   │   └── prisma.ts        # Prisma client setup
│   └── index.ts             # Entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Schema migrations
└── Dockerfile
```

### Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Implement & test locally: `make up-d && make logs`
3. Commit with conventional commits: `git commit -m "feat: description"`
4. Push & open a PR
5. Ensure tests pass before merging

---

## Troubleshooting

### Backend fails to start
- Check `.env.backend` has valid `OPENAI_API_KEY`
- Verify PostgreSQL is running: `make ps`
- Check logs: `make logs-backend`

### Frontend can't reach backend
- Verify backend is running on `localhost:8000`
- Check CORS config in `backend/src/index.ts`
- Clear browser cache (Ctrl+Shift+R)

### Weaviate connection fails
- Verify Weaviate is healthy: `make ps`
- Check `.env.weaviate` has valid `OPENAI_APIKEY`
- Inspect logs: `make logs-weaviate`

### Out of memory errors
- Reduce document chunk size in `RagService`
- Limit concurrent embedding jobs to 3-5
- Use managed Weaviate Cloud instead of self-hosted

---

## License

ISC — See LICENSE file for details.

---

**Questions?** Open an issue or review the assessment in `docs/Full_Stack_AI_Engineer_Assessment\ \(1\).md`.
