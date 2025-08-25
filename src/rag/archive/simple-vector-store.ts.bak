import { Ollama } from 'ollama';
import { DocumentChunk } from './data-preprocessor.js';

export interface SearchResult {
  document: string;
  metadata: any;
  score: number;
}

interface StoredDocument {
  id: string;
  text: string;
  metadata: any;
  embedding: number[];
}

export class SimpleVectorStore {
  private documents: StoredDocument[] = [];
  private ollama: Ollama;
  private embeddingModel: string;

  constructor(embeddingModel: string = 'nomic-embed-text') {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });
    this.embeddingModel = embeddingModel;
  }

  async initialize(): Promise<void> {
    this.documents = [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    console.log(`Starting addDocuments with ${chunks.length} chunks`);
    console.log(`Embedding model: ${this.embeddingModel}`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        console.log(`Processing chunk ${i + 1}/${chunks.length} - ID: ${chunk.id}`);
        console.log(`Chunk text preview: ${chunk.text.substring(0, 100)}...`);
        
        console.log(`Making embedding request for chunk ${i + 1}...`);
        const response = await this.ollama.embeddings({
          model: this.embeddingModel,
          prompt: chunk.text
        });

        this.documents.push({
          id: chunk.id,
          text: chunk.text,
          metadata: chunk.metadata,
          embedding: response.embedding
        });
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
        throw error;
      }
    }
    console.log(`Successfully added ${this.documents.length} documents to vector store`);
  }

  async search(query: string, k: number = 5): Promise<SearchResult[]> {
    const queryResponse = await this.ollama.embeddings({
      model: this.embeddingModel,
      prompt: query
    });
    const queryEmbedding = queryResponse.embedding;

    const scores = this.documents.map(doc => ({
      document: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, k).map(result => ({
      ...result,
      score: 1 - result.score // Convert similarity to distance
    }));
  }

  async searchWithFilters(
    query: string, 
    filters?: {
      courseId?: number;
      submitted?: boolean;
      dueAfter?: Date;
      dueBefore?: Date;
    },
    k: number = 5
  ): Promise<SearchResult[]> {
    let filteredDocs = this.documents;

    if (filters) {
      filteredDocs = this.documents.filter(doc => {
        if (filters.courseId !== undefined && doc.metadata.courseId !== filters.courseId) {
          return false;
        }
        if (filters.submitted !== undefined && doc.metadata.submitted !== filters.submitted) {
          return false;
        }
        if (filters.dueAfter || filters.dueBefore) {
          const dueDate = doc.metadata.dueDate ? new Date(doc.metadata.dueDate) : null;
          
          if (filters.dueAfter && (!dueDate || dueDate < filters.dueAfter)) {
            return false;
          }
          if (filters.dueBefore && (!dueDate || dueDate > filters.dueBefore)) {
            return false;
          }
        }
        return true;
      });
    }

    if (filteredDocs.length === 0) {
      return this.search(query, k);
    }

    const queryResponse = await this.ollama.embeddings({
      model: this.embeddingModel,
      prompt: query
    });
    const queryEmbedding = queryResponse.embedding;

    const scores = filteredDocs.map(doc => ({
      document: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, k).map(result => ({
      ...result,
      score: 1 - result.score
    }));
  }

  async reset(): Promise<void> {
    this.documents = [];
  }
}