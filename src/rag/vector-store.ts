import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { Ollama } from 'ollama';
import { DocumentChunk } from './data-preprocessor.js';

export interface SearchResult {
  document: string;
  metadata: any;
  score: number;
}

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private ollama: Ollama;
  private embeddingModel: string;

  constructor(embeddingModel: string = 'nomic-embed-text') {
    this.client = new ChromaClient({
      path: 'http://localhost:8000'
    });
    this.ollama = new Ollama({
      host: 'http://localhost:11434'
    });
    this.embeddingModel = embeddingModel;
  }

  async initialize(): Promise<void> {
    try {
      // Delete existing collection if it exists
      try {
        await this.client.deleteCollection({ name: 'canvas-assignments' });
      } catch (e) {
        // Collection doesn't exist, which is fine
      }

      // Create new collection with custom embedding function
      this.collection = await this.client.createCollection({
        name: 'canvas-assignments',
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embeddings: number[][] = [];
            for (const text of texts) {
              const response = await this.ollama.embeddings({
                model: this.embeddingModel,
                prompt: text
              });
              embeddings.push(response.embedding);
            }
            return embeddings;
          }
        }
      });
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    const ids = chunks.map(c => c.id);
    const documents = chunks.map(c => c.text);
    const metadatas = chunks.map(c => c.metadata as any);

    await this.collection.add({
      ids,
      documents,
      metadatas
    });
  }

  async search(query: string, k: number = 5): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: k
    });

    const searchResults: SearchResult[] = [];
    
    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        searchResults.push({
          document: results.documents[0][i] || '',
          metadata: results.metadatas[0]?.[i] || {},
          score: results.distances?.[0]?.[i] || 0
        });
      }
    }

    return searchResults;
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
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    let whereClause: any = {};
    
    if (filters) {
      if (filters.courseId !== undefined) {
        whereClause.courseId = filters.courseId;
      }
      if (filters.submitted !== undefined) {
        whereClause.submitted = filters.submitted;
      }
      // ChromaDB doesn't support complex date queries directly,
      // so we'll filter those in post-processing
    }

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: k * 2, // Get more results for post-filtering
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined
    });

    let searchResults: SearchResult[] = [];
    
    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const metadata = results.metadatas[0]?.[i] || {};
        
        // Apply date filters
        if (filters?.dueAfter || filters?.dueBefore) {
          const dueDate = metadata.dueDate && typeof metadata.dueDate === 'string' 
            ? new Date(metadata.dueDate) 
            : null;
          
          if (filters.dueAfter && (!dueDate || dueDate < filters.dueAfter)) {
            continue;
          }
          if (filters.dueBefore && (!dueDate || dueDate > filters.dueBefore)) {
            continue;
          }
        }

        searchResults.push({
          document: results.documents[0][i] || '',
          metadata,
          score: results.distances?.[0]?.[i] || 0
        });
      }
    }

    return searchResults.slice(0, k);
  }

  async reset(): Promise<void> {
    if (this.collection) {
      await this.client.deleteCollection({ name: 'canvas-assignments' });
      this.collection = null;
    }
  }
}