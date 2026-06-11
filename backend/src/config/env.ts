/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local/dev.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  weaviateUrl: process.env.WEAVIATE_URL ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  llmProvider: process.env.LLM_PROVIDER ?? 'openai',
} as const;
