# Part 2 — AI Data & Architecture Thinking

This document addresses the design questions for **Part 2** of the assessment:
data flow & storage decisions, PII & audit concerns, and the AI evaluation &
reliability strategy.

---

## 2.1 Data Flow & Storage

### What We Store vs What We Don't

| Data | Stored? | Location | Why |
|------|---------|----------|-----|
| User credentials (email + bcrypt hash) | ✅ | Postgres | Required for auth |
| Document raw text | ✅ | Postgres (`Document.content`) | Source of truth for re-ingestion |
| Vector embeddings + chunk text | ✅ | Weaviate | Required for semantic retrieval (RAG) |
| Conversation messages (user + assistant) | ✅ | Postgres (`Message`) | Audit trail, multi-turn context, evaluation |
| Prompt version per message | ✅ | Postgres (`Message.promptVersionId`) | Regression detection, auditability |
| Model name + token counts per message | ✅ | Postgres (`Message.model`, `promptTokens`, `completionTokens`) | Cost tracking, evaluation |
| Confidence + grounding sources | ✅ | Postgres (`Message.confidence`, `Message.sources`) | UX signals, quality baseline |
| Raw OpenAI HTTP responses | ❌ | — | Redundant; structured fields capture what matters |
| PII from document content | ❌ logged | App logger | Logs contain no document text or user content |
| User passwords in plaintext | ❌ | — | bcrypt-hashed only |

The rule of thumb: **store structured metadata, not raw payloads**. The full
document text lives in Postgres because users need it back and it drives
re-ingestion; raw LLM response JSON does not justify the storage cost.

---

### AI Input/Output Retention Policy

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| User credentials | Until account deletion | Auth requirement |
| Documents + embeddings | Until user deletion | User-owned content; RAG needs them |
| Conversation messages | **90 days** | Audit trail + evaluation; old chats have diminishing value |
| API / access logs | **30 days** | Debugging; contains no PII |
| Token usage metadata | **90 days** | Cost analysis and anomaly detection |
| Prompt versions | **Indefinitely** | Required for regression analysis against historical messages |

Retention is enforced by a scheduled job (e.g., a daily cron or Bull worker)
that soft-deletes or hard-deletes expired rows:

```typescript
// Pseudocode — runs nightly
await prisma.message.deleteMany({
  where: {
    createdAt: { lt: subDays(new Date(), 90) },
    conversation: { user: { deletedAt: null } }, // don't double-delete
  },
});
```

---

### PII Handling

Three categories of PII risk and their mitigations:

**1. Document content may contain PII (names, emails, addresses)**
- Never logged — the application logger emits structured JSON with event names
  and IDs only, never content fields.
- Stored in Postgres with encryption-at-rest (AWS RDS AES-256 in production).
- Hard-deleted (Postgres `onDelete: Cascade`) when a user account is removed.
- Weaviate chunks also deleted on document/account removal via `removeDocument()`.

**2. Questions asked by users may contain PII**
- Same log-suppression policy: `Message.content` is never written to app logs.
- Covered by the 90-day retention and the Cascade delete chain.

**3. LLM provider receives content**
- OpenAI's API terms are reviewed; data is not used for training by default
  under the enterprise agreement.
- In high-compliance environments, swap the provider to an on-premise model
  (the `LLMProvider` abstraction makes this a config change, not a code change).

**Auditability without PII in logs:**
Every assistant message is linked to a `PromptVersion` row (via
`promptVersionId`), a model name, token counts, and a confidence score. This
means every response can be traced back to the exact prompt template that
produced it — without needing to store or log the raw content anywhere outside
the database.

---

### Bonus: Vector Store & RAG Flow

The RAG pipeline is fully implemented:

```
User uploads document
  → chunkDocument() — 500-token chunks, 100-token overlap
  → embedder.embed()  — OpenAI text-embedding-3-small (1536-dim)
  → upsertChunks()   — stored in Weaviate with documentId + ownerId metadata

User asks question
  → sanitizeInput()  — strip control characters
  → embedder.embed([question])
  → searchChunks(documentId, queryVector, topK=4)  — cosine similarity
  → top-K chunks assembled into <context> block
  → buildMessages()  — injected into prompt with XML delimiters
  → LLM call         — grounded answer with citations
```

Ownership is enforced at the Weaviate query level (`ownerId` filter) so users
can only retrieve chunks from their own documents.

---

## 2.2 AI Evaluation & Reliability

### How We Measure Output Quality

Quality is measured along three axes, all of which have hooks already in the
schema:

#### 1. Confidence Distribution (automated)
Every assistant `Message` stores a `confidence` value (`low | medium | high`,
normalized to `0 | 0.5 | 1.0` for aggregation). A healthy system should trend
toward `medium` and `high`:

```sql
-- Weekly confidence breakdown per prompt version
SELECT
  pv.name,
  pv.version,
  m.confidence,
  COUNT(*) AS count
FROM "Message" m
JOIN "PromptVersion" pv ON m."promptVersionId" = pv.id
WHERE m.role = 'ASSISTANT'
  AND m."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY pv.name, pv.version, m.confidence
ORDER BY pv.version DESC;
```

A spike in `low` confidence answers signals either a prompt regression or a
shift in the kinds of documents/questions users are submitting.

#### 2. Citation Coverage (automated)
The `sources` JSON field on each `Message` stores the Weaviate chunks that
were passed as context. Low citation count on high-confidence answers is a
hallucination signal:

```typescript
// Automated check after each response
const suspiciousAnswer =
  result.confidence === 'high' && result.citations.length === 0;
if (suspiciousAnswer) metrics.increment('ai.suspicious_citation_gap');
```

#### 3. Human / Thumbs Feedback (manual baseline)
A lightweight `feedback` column (`thumbsUp | thumbsDown | null`) on `Message`
would give a ground-truth signal. Even a 2–5% sampled rating is enough to
track quality over time. This is the natural next column to add to the schema.

---

### How We Detect Regressions After Prompt or Model Changes

The schema is designed for this from day one: every assistant message is
linked to the exact `PromptVersion` that produced it. A regression workflow
looks like this:

**Step 1 — Shadow evaluation before rolling out**
Before activating a new prompt version, run it in shadow mode against the last
N real questions (sourced from `Message` rows where `role = 'USER'`) and
compare confidence distributions and citation counts:

```typescript
const shadowResults = await Promise.all(
  sampleQuestions.map((q) =>
    generateAnswer({ question: q.content, context: q.context, promptVersionId: candidate.id })
  )
);
const regressionFlag = shadowResults.filter((r) => r.confidence === 'low').length / shadowResults.length;
if (regressionFlag > 0.15) throw new Error('Prompt candidate has >15% low-confidence rate — blocked');
```

**Step 2 — Canary rollout**
Activate the new `PromptVersion` (`isActive: true`) for a small percentage of
traffic while keeping the old version running in parallel. Compare live
confidence and citation metrics between versions in a time-windowed query.

**Step 3 — Version pinning for rollback**
Because `PromptVersion` rows are immutable and messages reference them by ID,
rolling back is a single database update:

```sql
UPDATE "PromptVersion" SET "isActive" = false WHERE version = 3;
UPDATE "PromptVersion" SET "isActive" = true  WHERE version = 2;
```

No code deploy required.

**Step 4 — A/B evaluation with token cost**
Token counts (`promptTokens`, `completionTokens`) are stored per message.
A regression isn't just quality — a new prompt that uses 40% more tokens at
the same quality level is also a regression from a cost perspective.

---

### How We Handle "AI Gives Wrong Answer" in Production

This is an operational playbook, not just a code concern:

#### Immediate Detection
| Signal | Source | Action |
|--------|--------|--------|
| `confidence: low` on an answer with citations | DB metric | Flag for human review queue |
| `citations: []` on `confidence: high` answer | Runtime check | Increment `ai.suspicious_citation_gap` counter; alert if >1% |
| User thumbs-down feedback | Frontend event | Store on `Message`; route to review queue |
| LLM returns non-JSON / parse failure | `postProcess()` fallback | Logged as `ai.parse_failure`; answer served with `confidence: low` |

#### Graceful Degradation (already implemented)
The `postProcess()` function never throws — if the model returns malformed
output or plain prose instead of JSON, it wraps the raw text in a `low`
confidence answer and returns it. Users always get something rather than a 500.

The prompt itself instructs the model explicitly:
> "If the answer is not contained in the context, set 'answer' to a brief
> explanation… Never fabricate facts."

This means the model's own output declares uncertainty, which the UI can
surface directly.

#### Incident Response Flow

```
Wrong answer reported
  │
  ├─ 1. Retrieve Message by ID — check promptVersionId, confidence, sources
  │
  ├─ 2. Reproduce: re-run with same question + same context chunks
  │       → is it a retrieval failure (wrong chunks) or a reasoning failure?
  │
  ├─ 3a. Retrieval failure → tune chunking strategy or topK; re-ingest document
  │
  ├─ 3b. Reasoning failure → update prompt template, bump PromptVersion.version
  │       → run shadow eval → canary → promote
  │
  └─ 4. If systemic: add the question/answer pair to a regression test suite
         (golden set) that runs in CI against every future prompt change
```

#### Longer-Term: Golden Test Set
As wrong answers are identified and fixed, they become regression test inputs.
A CI job re-runs the golden set against any new `PromptVersion` candidate and
blocks promotion if the pass rate drops:

```typescript
// ci/eval.ts
const goldenSet = loadGoldenSet(); // {question, context, expectedConfidence, forbiddenPhrases}[]
for (const sample of goldenSet) {
  const result = await generateAnswer(sample);
  assert(result.confidence !== 'low', `Regression on: ${sample.question}`);
  forbiddenPhrases.forEach((p) => assert(!result.answer.includes(p)));
}
```

This turns each production incident into a permanent guard against recurrence.
