import 'dotenv/config';

/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local/dev.
 *
 * Locally (pnpm dev) values come from backend/.env via dotenv.
 * In Docker they are injected by docker-compose.yml.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  weaviateUrl: process.env.WEAVIATE_URL ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  llmProvider: process.env.LLM_PROVIDER ?? 'openai',
} as const;
