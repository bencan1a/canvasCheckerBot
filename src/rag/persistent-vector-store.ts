import { IVectorStore, SearchResult, SearchFilters } from './vector-store-interface.js';
import { DocumentChunk } from './data-preprocessor.js';
import { VectorStore as ChromaVectorStore } from './vector-store.js';

/**
 * PersistentVectorStore adapter
 *
 * - Implements IVectorStore to hide Chroma implementation from higher layers.
 * - Delegates to the existing Chroma-backed VectorStore (src/rag/vector-store.ts).
 *
 * Collection naming guidance:
 * - Default main collection name: "content"
 * - Placeholder collections (future): "relationship", "metadata"
 */
export class PersistentVectorStore implements IVectorStore {
  private chStore: ChromaVectorStore;
  private collectionName: string;

  constructor(embeddingModel: string = 'nomic-embed-text', collectionName: string = 'content') {
    this.chStore = new ChromaVectorStore(embeddingModel);
    this.collectionName = collectionName;
  }

  async initialize(): Promise<void> {
    // Delegate initialization to existing Chroma-backed implementation.
    await this.chStore.initialize();
  }

  async addDocuments(docs: DocumentChunk[]): Promise<void> {
    return this.chStore.addDocuments(docs);
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    return this.chStore.search(query, topK);
  }

  async searchWithFilters(query: string, filters: SearchFilters, topK: number = 5): Promise<SearchResult[]> {
    return this.chStore.searchWithFilters(query, filters, topK);
  }

  async reset(): Promise<void> {
    return this.chStore.reset();
  }
}