/**
 * Provider-agnostic embedding contract. Concrete embedders (OpenAI, mock)
 * implement this so the RAG layer never depends on a specific vendor.
 */
export interface Embedder {
  readonly name: string;
  /** Vector dimensionality produced by this embedder. */
  readonly dimensions: number;
  /** Embeds a batch of texts, preserving input order. */
  embed(texts: string[]): Promise<number[][]>;
}
