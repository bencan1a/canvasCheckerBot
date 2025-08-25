/**
 * Test-only in-memory vector store used by integration tests.
 *
 * - Lightweight and synchronous (no network).
 * - Deterministic embeddings computed from text (simple hashing -> low-dim vector).
 * - search returns distances in [0,1] where 0 = perfect match (smaller = more relevant).
 *
 * Mirrors IVectorStore contract from src/rag/vector-store-interface.ts
 */

import type { DocumentChunk } from '../../src/rag/data-preprocessor.js';
import type { SearchResult, SearchFilters, IVectorStore } from '../../src/rag/vector-store-interface.js';

function simpleEmbedding(text: string): number[] {
  // Deterministic keyword-aware embedding (3-dim):
  // [matrix-related score, http/express-related score, other-token score]
  const t = (text || '').toLowerCase();
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  let matrixScore = 0;
  let httpScore = 0;
  let otherScore = 0;
  for (const w of words) {
    if (w.includes('matrix') || w.includes('inverse') || w.includes('multiplication')) {
      matrixScore += 2;
    } else if (w.includes('http') || w.includes('rest') || w.includes('express') || w.includes('request') || w.includes('api')) {
      httpScore += 2;
    } else {
      otherScore += 1;
    }
  }
  // Fallback to lightweight char-based signal if all zero
  if (matrixScore === 0 && httpScore === 0 && otherScore === 0) {
    const nums = [0, 0, 0];
    for (let i = 0; i < (text || '').length; i++) {
      nums[i % 3] += (text || '').charCodeAt(i);
    }
    const norm = Math.sqrt(nums[0] * nums[0] + nums[1] * nums[1] + nums[2] * nums[2]) || 1;
    return nums.map(n => n / norm);
  }
  const vec = [matrixScore, httpScore, otherScore];
  const norm = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]) || 1;
  return vec.map(n => n / norm);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  const cos = dot / denom;
  const dist = 1 - cos;
  if (dist < 0) return 0;
  if (dist > 1) return 1;
  return dist;
}

export class InmemoryVectorStore implements IVectorStore {
  private docs: Map<string, { text: string; metadata: any; embedding: number[] }> = new Map();

  constructor(private batchSize = 10) {}

  async initialize(): Promise<void> {
    return;
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      for (const c of batch) {
        const embedding = simpleEmbedding(c.text);
        this.docs.set(c.id, {
          text: c.text,
          metadata: c.metadata ?? {},
          embedding
        });
      }
    }
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (this.docs.size === 0) return [];
    const qEmb = simpleEmbedding(query);
    const qTokens = (query || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const results: { id: string; document: string; metadata: any; score: number }[] = [];
 
    for (const [id, doc] of this.docs.entries()) {
      let dist = cosineDistance(qEmb, doc.embedding);
 
      // Boost documents that contain query tokens as a cheap lexical signal
      const docText = (doc.text || '').toLowerCase();
      let matchCount = 0;
      for (const t of qTokens) {
        if (t.length > 1 && docText.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        // Reduce distance (more relevant) proportionally, clamp to [0,1]
        dist = Math.max(0, dist - 0.5 * matchCount);
      }
 
      results.push({ id, document: doc.text, metadata: doc.metadata, score: dist });
    }
 
    results.sort((a, b) => a.score - b.score);
    return results.slice(0, topK).map(r => ({ document: r.document, metadata: r.metadata, score: r.score }));
  }

  async searchWithFilters(query: string, filters?: SearchFilters, topK: number = 5): Promise<SearchResult[]> {
    const all = await this.search(query, Math.max(topK, this.docs.size));
    if (!filters) return all.slice(0, topK);

    const filtered = all.filter(r => {
      if (filters.submitted !== undefined && typeof r.metadata.submitted === 'boolean') {
        if (r.metadata.submitted !== filters.submitted) return false;
      }
      if (filters.courseId !== undefined && typeof r.metadata.courseId === 'number') {
        if (r.metadata.courseId !== filters.courseId) return false;
      }
      if ((filters.dueAfter || filters.dueBefore) && r.metadata.dueDate) {
        const due = new Date(r.metadata.dueDate);
        if (filters.dueAfter && due < filters.dueAfter) return false;
        if (filters.dueBefore && due > filters.dueBefore) return false;
      }
      return true;
    });

    return filtered.slice(0, topK);
  }

  async reset(): Promise<void> {
    this.docs.clear();
  }

  // Test helper
  getDocumentIds(): string[] {
    return Array.from(this.docs.keys());
  }
}

export default InmemoryVectorStore;