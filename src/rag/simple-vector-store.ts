/**
 * Archived SimpleVectorStore
 *
 * The original in-memory SimpleVectorStore implementation has been archived and moved to:
 *   src/rag/archive/simple-vector-store.ts.bak
 *
 * Runtime code should use PersistentVectorStore (src/rag/persistent-vector-store.ts).
 *
 * This stub remains to avoid breaking imports in tests or other archival references.
 */

export { SearchResult } from './vector-store-interface.js';

export class SimpleVectorStore {
  constructor(..._args: any[]) {
    throw new Error('SimpleVectorStore is archived. Use PersistentVectorStore from ./persistent-vector-store.js instead.');
  }
}