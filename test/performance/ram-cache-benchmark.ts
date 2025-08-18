import { DocumentChunk } from '../../src/rag/data-preprocessor.js';

/**
 * Simplified Performance Benchmark for RAM Cache vs Linear Search
 * Testing core vector similarity computation performance
 */

// Mock vector store interfaces for testing
interface TestDocument {
  id: string;
  text: string;
  metadata: any;
  embedding: number[];
}

interface SearchResult {
  document: string;
  metadata: any;
  score: number;
}

// Simple linear search implementation (simulating SimpleVectorStore behavior)
class MockSimpleVectorStore {
  private documents: TestDocument[] = [];

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.documents.push({
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding: Array.from({ length: 768 }, () => Math.random() - 0.5) // Mock embedding
      });
    }
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

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async search(query: string, k: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = Array.from({ length: 768 }, () => Math.random() - 0.5);

    // Linear search through all documents (O(n) complexity)
    const scores = this.documents.map(doc => ({
      document: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k);
  }
}

// Mock RAM cache implementation with optimized search
class MockRamVectorStore {
  private documents: TestDocument[] = [];
  private vectorCache: Float32Array | null = null;
  private searchStats = { searches: 0, totalTime: 0 };

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.documents.push({
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding: Array.from({ length: 768 }, () => Math.random() - 0.5)
      });
    }
    this.buildCache();
  }

  private buildCache(): void {
    // Build optimized cache structure
    const vectorDim = 768;
    this.vectorCache = new Float32Array(this.documents.length * vectorDim);
    
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      for (let j = 0; j < vectorDim; j++) {
        this.vectorCache[i * vectorDim + j] = doc.embedding[j];
      }
    }
  }

  private simdCosineSimilarity(queryEmbedding: number[], docIndex: number): number {
    if (!this.vectorCache) return 0;

    const vectorDim = 768;
    const offset = docIndex * vectorDim;
    
    let dotProduct = 0;
    let queryMag = 0;
    let docMag = 0;

    // Optimized loop with unrolling (simulating SIMD operations)
    for (let i = 0; i < vectorDim; i += 4) {
      const q0 = queryEmbedding[i];
      const q1 = queryEmbedding[i + 1] || 0;
      const q2 = queryEmbedding[i + 2] || 0;
      const q3 = queryEmbedding[i + 3] || 0;

      const d0 = this.vectorCache[offset + i];
      const d1 = this.vectorCache[offset + i + 1] || 0;
      const d2 = this.vectorCache[offset + i + 2] || 0;
      const d3 = this.vectorCache[offset + i + 3] || 0;

      dotProduct += q0 * d0 + q1 * d1 + q2 * d2 + q3 * d3;
      queryMag += q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3;
      docMag += d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
    }

    const magnitude = Math.sqrt(queryMag) * Math.sqrt(docMag);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async search(query: string, k: number = 5): Promise<SearchResult[]> {
    const start = performance.now();
    
    const queryEmbedding = Array.from({ length: 768 }, () => Math.random() - 0.5);

    // Optimized search using cached vectors and SIMD-style operations
    const scores: SearchResult[] = [];
    
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      const score = this.simdCosineSimilarity(queryEmbedding, i);
      scores.push({
        document: doc.text,
        metadata: doc.metadata,
        score
      });
    }

    scores.sort((a, b) => b.score - a.score);
    
    const end = performance.now();
    this.searchStats.searches++;
    this.searchStats.totalTime += (end - start);

    return scores.slice(0, k);
  }

  getPerformanceStats() {
    return {
      averageSearchTime: this.searchStats.searches > 0 ? this.searchStats.totalTime / this.searchStats.searches : 0,
      totalSearches: this.searchStats.searches,
      cacheHits: this.searchStats.searches,
      cacheMisses: 0
    };
  }

  getMemoryUsage() {
    const vectorCacheSize = this.vectorCache ? this.vectorCache.byteLength : 0;
    return {
      vectorCacheSize,
      documentsCached: this.documents.length
    };
  }
}

/**
 * Performance benchmark comparing linear search vs optimized RAM cache
 * Target: Validate significant speed improvement for vector search operations
 */
async function runBenchmark() {
  console.log('🚀 Starting RAM Cache Performance Benchmark');
  console.log('Testing: Linear Search vs Optimized RAM Cache');
  console.log('=' .repeat(60));

  // Test configuration
  const testSizes = [1000, 5000, 10000, 25000];
  const searchQueries = [
    'Canvas assignment submission analysis',
    'Student grade performance metrics',
    'Course discussion forum engagement',
    'Quiz completion rate statistics',
    'Assignment rubric evaluation criteria'
  ];

  // Generate test documents
  function generateTestDocuments(count: number): DocumentChunk[] {
    const documents: DocumentChunk[] = [];
    const sampleTexts = [
      'Canvas LMS assignment submission with student feedback and grading rubric',
      'Discussion forum post about course materials and assignment requirements',
      'Quiz results showing student performance across multiple attempts',
      'Grade analytics dashboard displaying course-wide performance metrics',
      'Student submission with instructor comments and evaluation criteria'
    ];

    for (let i = 0; i < count; i++) {
      documents.push({
        id: `doc-${i}`,
        text: `${sampleTexts[i % sampleTexts.length]} - Document ${i}`,
        metadata: {
          type: 'canvas_data',
          course_id: `course-${Math.floor(i / 100)}`,
          timestamp: new Date().toISOString()
        }
      });
    }
    return documents;
  }

  // Test function for measuring performance
  async function measurePerformance(
    vectorStore: MockSimpleVectorStore | MockRamVectorStore,
    query: string,
    iterations: number = 10
  ): Promise<{ avgTime: number; minTime: number; maxTime: number }> {
    const times: number[] = [];
    
    // Warm up
    await vectorStore.search(query, 5);
    
    // Measure multiple iterations
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await vectorStore.search(query, 5);
      const end = performance.now();
      times.push(end - start);
    }

    return {
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    };
  }

  // Run benchmark for each test size
  for (const docCount of testSizes) {
    console.log(`\n📊 Testing with ${docCount.toLocaleString()} documents`);
    console.log('-'.repeat(50));

    const testDocs = generateTestDocuments(docCount);

    // Initialize MockSimpleVectorStore (baseline - linear search)
    console.log('🔧 Initializing Linear Search (baseline)...');
    const linearStore = new MockSimpleVectorStore();
    await linearStore.addDocuments(testDocs);

    // Initialize MockRamVectorStore (optimized - RAM cache)
    console.log('🔧 Initializing RAM Cache (optimized)...');
    const ramStore = new MockRamVectorStore();
    await ramStore.addDocuments(testDocs);

    console.log('\n📈 Performance Results:');
    console.log('Query'.padEnd(40) + 'Linear (ms)'.padEnd(15) + 'RAM Cache (ms)'.padEnd(15) + 'Speedup'.padEnd(10));
    console.log('='.repeat(80));

    let totalSpeedup = 0;
    
    for (const query of searchQueries) {
      // Test Linear Search
      const linearPerf = await measurePerformance(linearStore, query);
      
      // Test RAM Cache
      const ramPerf = await measurePerformance(ramStore, query);

      const speedup = linearPerf.avgTime / ramPerf.avgTime;
      totalSpeedup += speedup;

      console.log(
        query.substring(0, 38).padEnd(40) +
        linearPerf.avgTime.toFixed(2).padEnd(15) +
        ramPerf.avgTime.toFixed(3).padEnd(15) +
        `${speedup.toFixed(0)}x`.padEnd(10)
      );
    }

    const avgSpeedup = totalSpeedup / searchQueries.length;
    console.log('-'.repeat(80));
    console.log(`Average Speedup: ${avgSpeedup.toFixed(0)}x`);
    
    // Performance statistics
    const stats = ramStore.getPerformanceStats();
    console.log('\n📊 Cache Performance Statistics:');
    console.log(`Average search time: ${stats.averageSearchTime.toFixed(3)}ms`);
    console.log(`Total searches: ${stats.totalSearches}`);
    
    const memory = ramStore.getMemoryUsage();
    console.log(`Memory usage: ${(memory.vectorCacheSize / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`Documents cached: ${memory.documentsCached}`);

    // Performance assessment
    if (avgSpeedup >= 10) {
      console.log(`✅ EXCELLENT: Achieved ${avgSpeedup.toFixed(0)}x speedup through optimization`);
    } else if (avgSpeedup >= 3) {
      console.log(`✅ GOOD: Achieved ${avgSpeedup.toFixed(0)}x speedup through optimization`);
    } else {
      console.log(`⚠️  MODEST: Only ${avgSpeedup.toFixed(0)}x speedup achieved`);
    }
  }

  console.log('\n🎯 Benchmark Complete!');
  console.log('=' .repeat(60));
  console.log('Note: This benchmark demonstrates core optimization principles.');
  console.log('Real-world performance with actual implementations may vary.');
}

// Export for use in test suites
export { runBenchmark };

// Run if called directly
if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log('✅ Benchmark completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}