/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local/dev.
 *
 * Values are injected by docker-compose.yml (the stack runs in Docker) from
 * the root .env file.
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
  // Embeddings auto-select OpenAI when a key is present, else the offline mock.
  embeddingProvider:
    process.env.EMBEDDING_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'mock'),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
} as const;
