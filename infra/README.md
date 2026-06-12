# Part 3 — Infrastructure & Deployment (AWS)

This is a **reference / mock** deployment: it shows how DocuAI would run in
production on AWS, defined entirely as code. It is intended to demonstrate the
deployment approach — it is not wired to a live account.

## Architecture

```
                    ┌──────────────────────── CloudFront ────────────────────────┐
   Browser ───────▶ │  default behavior  ──▶ S3 (private, OAC)   [SPA static]     │
                    │  /api/*            ──▶ App Runner (HTTPS)   [backend API]    │
                    └──────────────────────────────┬─────────────────────────────┘
                                                    │ VPC Connector
                                                    ▼
                                   ┌────────────────────────────────┐
                                   │ App Runner (backend, port 8000) │
                                   │  - image pulled from ECR        │
                                   │  - secrets from Secrets Manager │
                                   └──────┬───────────────┬──────────┘
                                          │               │
                              private VPC │               │ HTTPS (egress)
                                          ▼               ▼
                                  RDS PostgreSQL     Weaviate Cloud (managed,
                                  (encrypted,         external) + OpenAI API
                                   private subnets)
   Uploaded docs ──▶ S3 documents bucket (private, encrypted, versioned)
```

Single-origin model: the SPA and the API are served under one CloudFront
domain, so the browser calls `/api/*` same-origin — **no CORS** — mirroring the
local nginx proxy in `docker-compose.yml`.

## Why these services

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Backend runtime | **App Runner** | Container-native, autoscaling, managed TLS; no cluster to operate. Runs the existing `backend.Dockerfile` unchanged. |
| Relational store | **RDS PostgreSQL** | Managed Postgres, encrypted at rest, private subnets. The app already targets Postgres via Prisma. |
| Vector store | **Weaviate Cloud** | Managed; keeps the stack focused. URL + API key supplied via Secrets Manager. |
| Document storage | **S3** | Durable, cheap, encrypted, versioned object storage. |
| Frontend hosting | **S3 + CloudFront** | Static SPA on a CDN; origin bucket stays private behind Origin Access Control (OAC). |
| Image registry | **ECR** | Private registry with image scanning + lifecycle expiry. |
| CI identity | **GitHub OIDC role** | Short-lived credentials, **no long-lived AWS keys** in GitHub. |

## Files

- `cloudformation/docuai-stack.yaml` — the entire stack in one template.
- `cloudformation/parameters.example.json` — example parameters (no secrets).
- `../.github/workflows/deploy.yml` — the CI/CD pipeline.

> No `samconfig.toml` / SAM: the template uses no `AWS::Serverless` transform,
> so it deploys with plain `aws cloudformation deploy`.

## Config vs. code separation

- **Config** lives in CloudFormation parameters (`parameters.example.json`) —
  instance sizes, scaling bounds, names, the GitHub repo. No secret material.
- **Secrets** live only in **AWS Secrets Manager** and are injected into App
  Runner at runtime as `RuntimeEnvironmentSecrets`. They never appear in the
  template, the repo, or container images.
- **Code** (app + Dockerfiles) is environment-agnostic and reads everything
  from environment variables (see `backend/src/config/env.ts`).

## Where AI API keys live & how they rotate

- `OPENAI_API_KEY`, `WEAVIATE_URL`, `WEAVIATE_API_KEY`, and `JWT_SECRET` are
  stored in the `docuai/<env>/app` secret. RDS credentials are generated into
  `docuai/<env>/rds`.
- The stack creates the app secret with **placeholder** values; real values are
  set out-of-band after the first deploy (see below).
- **Rotation:** update the secret value (manually, or via a Secrets Manager
  rotation Lambda for the DB), then trigger a new App Runner deployment so the
  running tasks pick up the new value. Because the app reads keys from the
  environment at startup, rotation is a secret update + a rolling redeploy — no
  code change. Swapping the LLM provider entirely is just a different key + the
  `LLM_PROVIDER` env var, thanks to the provider abstraction in the backend.

## Scaling under bursty AI usage

- **App Runner** autoscaling: `MaxConcurrency` (requests per instance) plus
  `MinSize`/`MaxSize` let it absorb spikes and scale back to a warm floor.
- **AI calls are I/O-bound**, so concurrency per instance can be relatively
  high; the practical ceiling is the **LLM provider's rate limits**, not CPU.
  Backpressure should be handled with provider-side rate-limit handling /
  queueing rather than only adding instances.
- **RDS** is the stateful bottleneck: cap Prisma's connection pool and scale the
  instance class / add read replicas before raising App Runner `MaxSize` too far.
- **Weaviate Cloud** scales independently as a managed service.
- **CloudFront** absorbs all static traffic, so backend scaling is driven by API
  volume only.
- Long-running ingestion is already **async** in the app; a heavier production
  setup would move it to a queue + worker (e.g. SQS) — a natural next step.

## Deploy (reference steps)

> Prerequisites: an AWS account, the AWS CLI, and permission to create the
> resources. The CI pipeline performs all of this automatically; the manual
> steps below are for the bootstrap / first run.

1. **Bootstrap the stack (backend off — ECR is still empty):**
   ```sh
   aws cloudformation deploy \
     --template-file infra/cloudformation/docuai-stack.yaml \
     --stack-name docuai-prod \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       GitHubOrg=<your-org> GitHubRepo=FS_AI_ENG_Assessment \
       DeployBackendService=false
   ```

2. **Set the real secret values** (never commit these):
   ```sh
   aws secretsmanager put-secret-value \
     --secret-id docuai/prod/app \
     --secret-string '{
       "JWT_SECRET":"<random-64-hex>",
       "OPENAI_API_KEY":"sk-...",
       "WEAVIATE_URL":"https://<cluster>.weaviate.cloud",
       "WEAVIATE_API_KEY":"<key>"
     }'
   ```

3. **Configure GitHub repo variables** (Settings → Secrets and variables →
   Actions → *Variables*), using the stack outputs:
   - `AWS_REGION` — e.g. `us-east-1`
   - `AWS_DEPLOY_ROLE_ARN` — stack output `GitHubDeployRoleArn`
   - `GITHUB_ORG` — your org/user

4. **Push to `main`** (or run the `deploy` workflow). CI builds & pushes the
   backend image, then redeploys with `DeployBackendService=true`, provisioning
   App Runner and the CloudFront `/api` origin, and publishes the SPA.

5. Open the **`CloudFrontDomain`** stack output in a browser.

## Database migrations

The backend image runs `prisma migrate deploy` on startup
(`backend/docker-entrypoint.sh`), so each App Runner deployment applies pending
migrations before serving traffic.

## Known limitation / documented follow-up

Uploaded documents are currently persisted as extracted text in Postgres
(`Document.content`). This template **provisions** the encrypted, versioned
`DocumentsBucket` and grants the App Runner instance role read/write access, but
the application is not yet wired to store raw files in S3. Making that switch is
a config-only change in `backend/src/services/document.service.ts` (write the
upload buffer to the bucket, keep extracted text for retrieval) — the
infrastructure is already in place.
