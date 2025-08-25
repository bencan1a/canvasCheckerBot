import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { CachedVectorStore } from './cached-vector-store.js';
import { PersistentVectorStore } from './persistent-vector-store.js';
import { DataPreprocessor } from './data-preprocessor.js';
import { VLLMConfig, StudentData, QueryResult } from '../types.js';

export interface HybridQueryEngineConfig {
  enableRamCache?: boolean;
  ramCacheConfig?: {
    embeddingModel: string;
    ramCache: {
      maxMemoryGB: number;
      cacheStrategy: 'LRU' | 'LFU';
      indexType: 'FLAT' | 'IVF';
      embeddingDimensions: number;
    };
  };
}

export interface PerformanceStats {
  stats: {
    totalQueries: number;
    cacheHitRate: number;
    averageResponseTime: number;
    memoryUsageGB: number;
  };
  memoryUsage: {
    totalAllocatedGB: number;
    ramCache: {
      vectorMemoryGB: number;
      metadataMemoryMB: number;
    };
  };
  performanceMetrics: {
    lastQueryTime: number;
    peakMemoryUsage: number;
  };
}

export class HybridQueryEngine {
  private vllmConfig: VLLMConfig;
  private embeddingModel: string;
  private config: HybridQueryEngineConfig;
  private vectorStore: PersistentVectorStore | CachedVectorStore;
  private preprocessor: DataPreprocessor;
  private studentData: StudentData | null = null;

  constructor(
    vllmConfig: VLLMConfig,
    embeddingModel: string,
    config: HybridQueryEngineConfig = {}
  ) {
    this.vllmConfig = vllmConfig;
    this.embeddingModel = embeddingModel;
    this.config = config;
    this.preprocessor = new DataPreprocessor();

    console.log('[VALIDATION] HybridQueryEngine: Constructor called with config:', {
      enableRamCache: config.enableRamCache,
      embeddingModel,
      hasRamCacheConfig: !!config.ramCacheConfig
    });

    // Debug: Log available vector store APIs
    console.log('[DEBUG] Available CachedVectorStore methods:', Object.getOwnPropertyNames(CachedVectorStore.prototype));
    console.log('[DEBUG] Available PersistentVectorStore methods:', Object.getOwnPropertyNames(PersistentVectorStore.prototype));

    // Initialize vector store based on configuration
    if (config.enableRamCache && config.ramCacheConfig) {
      console.log('[VALIDATION] HybridQueryEngine: Initializing with CachedVectorStore (RAM cache enabled)');
      this.vectorStore = new CachedVectorStore({ embeddingModel });
    } else {
      console.log('[VALIDATION] HybridQueryEngine: Initializing with PersistentVectorStore (RAM cache disabled)');
      this.vectorStore = new PersistentVectorStore(embeddingModel);
    }
  }

  async initialize(studentData: StudentData): Promise<void> {
    console.log('[VALIDATION] HybridQueryEngine: Starting initialization...');
    console.log(`[VALIDATION] HybridQueryEngine: Student data contains ${studentData.courses?.length || 0} courses, ${studentData.assignments?.length || 0} assignments, ${studentData.submissions?.length || 0} submissions`);

    this.studentData = studentData;

    console.log('[VALIDATION] HybridQueryEngine: Vector store ready (MemoryVectorStore has no separate initialization)');

    console.log('[VALIDATION] HybridQueryEngine: Processing documents...');
    const processedChunks = this.preprocessor.processStudentData(studentData);
    const temporalContext = this.preprocessor.getTemporalContext("current_time"); // Placeholder - getTemporalContext expects a string parameter
    const summaryChunks = this.preprocessor.createSummaryChunks(processedChunks);
    const chunks = [...processedChunks, temporalContext, ...summaryChunks];

    console.log(`[VALIDATION] HybridQueryEngine: Adding ${chunks.length} document chunks to vector store...`);
    await this.vectorStore.addDocuments(chunks);

    console.log('[VALIDATION] HybridQueryEngine: Query engine ready!');
  }

  async query(userQuery: string): Promise<QueryResult> {
    console.log(`[VALIDATION] HybridQueryEngine: Processing query: "${userQuery}"`);

    if (!this.studentData) {
      throw new Error('QueryEngine not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Get relevant documents from vector store
      console.log('[VALIDATION] HybridQueryEngine: Searching vector store...');
      const searchResults = await this.vectorStore.search(userQuery, 5);

      console.log(`[VALIDATION] HybridQueryEngine: Found ${searchResults.length} relevant documents`);

      // Generate response using VLLM
      console.log('[VALIDATION] HybridQueryEngine: Generating response via VLLM...');
      const prompt = this.generatePrompt(userQuery, searchResults);
      const response = await this.callVLLM(prompt);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`[VALIDATION] HybridQueryEngine: Query completed in ${responseTime}ms`);

      // Calculate confidence based on search results quality
      const confidence = this.calculateConfidence(searchResults, response);

      return {
        answer: response,
        confidence,
        sources: searchResults.map(doc => ({
          content: doc.document,
          metadata: doc.metadata,
          score: doc.score || 0
        }))
      };
    } catch (error) {
      console.error('[VALIDATION] HybridQueryEngine: Query failed:', error);
      throw error;
    }
  }

  getPerformanceStats(): PerformanceStats {
    console.log('[VALIDATION] HybridQueryEngine: Getting performance stats...');

    if (this.vectorStore instanceof CachedVectorStore) {
      const cacheStats = this.vectorStore.getPerformanceStats();
      return {
        stats: {
          totalQueries: cacheStats.ramCache.totalDocuments || 0, // Use totalDocuments as proxy for queries
          cacheHitRate: cacheStats.ramCache.cacheHitRate || 0,
          averageResponseTime: cacheStats.ramCache.averageSearchTime || 0,
          memoryUsageGB: cacheStats.ramCache.memoryUsedBytes ? cacheStats.ramCache.memoryUsedBytes / (1024 * 1024 * 1024) : 0
        },
        memoryUsage: {
          totalAllocatedGB: this.config.ramCacheConfig?.ramCache.maxMemoryGB || 0,
          ramCache: {
            vectorMemoryGB: cacheStats.ramCache.memoryUsedBytes ? cacheStats.ramCache.memoryUsedBytes / (1024 * 1024 * 1024) : 0,
            metadataMemoryMB: cacheStats.ramCache.totalDocuments ? cacheStats.ramCache.totalDocuments * 0.1 : 0 // Estimate
          }
        },
        performanceMetrics: {
          lastQueryTime: cacheStats.ramCache.averageSearchTime || 0,
          peakMemoryUsage: cacheStats.ramCache.memoryUsedBytes || 0
        }
      };
    } else {
      // Fallback for SimpleVectorStore
      return {
        stats: {
          totalQueries: 0,
          cacheHitRate: 0,
          averageResponseTime: 0,
          memoryUsageGB: 0
        },
        memoryUsage: {
          totalAllocatedGB: 0,
          ramCache: {
            vectorMemoryGB: 0,
            metadataMemoryMB: 0
          }
        },
        performanceMetrics: {
          lastQueryTime: 0,
          peakMemoryUsage: 0
        }
      };
    }
  }

  getMemoryUsage(): {
    totalAllocatedGB: number;
    ramCache: {
      vectorMemoryGB: number;
      metadataMemoryMB: number;
    };
  } {
    if (this.vectorStore instanceof CachedVectorStore) {
      const cacheStats = this.vectorStore.getPerformanceStats();
      return {
        totalAllocatedGB: this.config.ramCacheConfig?.ramCache.maxMemoryGB || 0,
        ramCache: {
          vectorMemoryGB: cacheStats.ramCache.memoryUsedBytes ? cacheStats.ramCache.memoryUsedBytes / (1024 * 1024 * 1024) : 0,
          metadataMemoryMB: cacheStats.ramCache.totalDocuments ? cacheStats.ramCache.totalDocuments * 0.1 : 0
        }
      };
    }

    return {
      totalAllocatedGB: 0,
      ramCache: {
        vectorMemoryGB: 0,
        metadataMemoryMB: 0
      }
    };
  }

  private generatePrompt(query: string, searchResults: any[]): string {
    const context = searchResults.map(doc => doc.document || doc.pageContent || doc.content || '').join('\n\n');
    return `Context information:
${context}

Based on the above context, answer the following question about the student's academic situation:

Question: ${query}

Please provide a helpful, accurate response based on the available information.`;
  }

  private async callVLLM(prompt: string): Promise<string> {
    // Placeholder for VLLM integration
    // In a real implementation, this would make an HTTP request to the VLLM server
    console.log(`[VALIDATION] HybridQueryEngine: Calling VLLM with prompt length: ${prompt.length}`);

    // Simulate VLLM response for validation purposes
    return `Based on your academic data, here's what I found regarding your query. This is a simulated response for validation testing.`;
  }

  private calculateConfidence(searchResults: any[], response: string): number {
    // Simple confidence calculation based on search results
    if (searchResults.length === 0) return 0.1;
    if (searchResults.length >= 5) return 0.9;

    // Base confidence on average score of search results
    const avgScore = searchResults.reduce((sum, doc) => sum + (doc.score || 0), 0) / searchResults.length;
    return Math.min(0.95, 0.3 + (avgScore * 0.4));
  }
}