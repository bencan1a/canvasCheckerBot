import { DocumentChunk } from './data-preprocessor.js';

export interface SearchResult {
  document: string;
  metadata: any;
  score: number;
}

export interface SearchFilters {
  courseId?: number;
  submitted?: boolean;
  dueAfter?: Date;
  dueBefore?: Date;
}

/**
 * Generic vector-store interface used by higher-level code.
 * Implementations (PersistentVectorStore, CachedVectorStore, SimpleVectorStore)
 * should be compatible with this contract.
 */
export interface IVectorStore {
  initialize(): Promise<void>;
  addDocuments(docs: DocumentChunk[]): Promise<void>;
  search(query: string, topK?: number): Promise<SearchResult[]>;
  searchWithFilters(query: string, filters: SearchFilters, topK?: number): Promise<SearchResult[]>;
  reset(): Promise<void>;
}