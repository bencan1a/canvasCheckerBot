/**
 * Integration Test for RAM-based Vector Cache System
 * Validates that the new caching approach is working correctly
 */

import { HybridQueryEngine } from '../../src/rag/hybrid-query-engine';
import { CachedVectorStore } from '../../src/rag/cached-vector-store';
import { RamVectorCache } from '../../src/rag/ram-vector-cache';

describe('RAM Cache Integration', () => {
  let hybridEngine: HybridQueryEngine;

  beforeEach(async () => {
    // Initialize with RAM cache enabled
    hybridEngine = new HybridQueryEngine({
      useRamCache: true,
      ramCacheConfig: {
        maxMemoryMB: 1024, // 1GB for testing
        vectorDimensions: 768,
        maxDocuments: 10000
      }
    });
  });

  test('HybridQueryEngine initializes with CachedVectorStore', () => {
    expect(hybridEngine).toBeInstanceOf(HybridQueryEngine);
    
    // Verify that the engine is using the cached implementation
    const vectorStore = (hybridEngine as any).vectorStore;
    expect(vectorStore).toBeInstanceOf(CachedVectorStore);
  });

  test('CachedVectorStore uses RamVectorCache internally', () => {
    const vectorStore = (hybridEngine as any).vectorStore as CachedVectorStore;
    const ramCache = (vectorStore as any).ramCache;
    
    expect(ramCache).toBeInstanceOf(RamVectorCache);
    expect(ramCache).toBeDefined();
  });

  test('System can add documents to RAM cache', async () => {
    const testDocuments = [
      {
        id: 'test-1',
        text: 'Canvas assignment submission with student feedback',
        metadata: { type: 'assignment', course: 'CS101' }
      },
      {
        id: 'test-2', 
        text: 'Discussion forum post about course materials',
        metadata: { type: 'discussion', course: 'CS101' }
      },
      {
        id: 'test-3',
        text: 'Quiz results showing student performance metrics',
        metadata: { type: 'quiz', course: 'CS102' }
      }
    ];

    // Add documents - should populate the RAM cache
    await hybridEngine.addDocuments(testDocuments);

    // Verify cache has documents
    const vectorStore = (hybridEngine as any).vectorStore as CachedVectorStore;
    const cacheStats = vectorStore.getCacheStats();
    
    expect(cacheStats.totalDocuments).toBe(3);
    expect(cacheStats.memoryUsageMB).toBeGreaterThan(0);
  });

  test('System can perform searches using RAM cache', async () => {
    // Add test documents
    const testDocuments = [
      {
        id: 'assignment-1',
        text: 'Student submitted assignment with code implementation',
        metadata: { type: 'assignment', subject: 'programming' }
      },
      {
        id: 'discussion-1',
        text: 'Forum discussion about programming concepts and algorithms',
        metadata: { type: 'discussion', subject: 'programming' }
      },
      {
        id: 'quiz-1',
        text: 'Quiz covering data structures and algorithm complexity',
        metadata: { type: 'quiz', subject: 'algorithms' }
      }
    ];

    await hybridEngine.addDocuments(testDocuments);

    // Perform search
    const results = await hybridEngine.search('programming assignment', {
      k: 2,
      includeMetadata: true
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
    
    // Verify results have the expected structure
    results.forEach(result => {
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('metadata');
      expect(typeof result.similarity).toBe('number');
    });
  });

  test('Cache statistics are properly tracked', async () => {
    const vectorStore = (hybridEngine as any).vectorStore as CachedVectorStore;
    
    // Initial state
    let stats = vectorStore.getCacheStats();
    expect(stats.cacheHits).toBe(0);
    expect(stats.cacheMisses).toBe(0);

    // Add documents
    await hybridEngine.addDocuments([
      {
        id: 'cache-test-1',
        text: 'Test document for cache statistics validation',
        metadata: { test: true }
      }
    ]);

    // Perform searches to generate cache activity
    await hybridEngine.search('test document', { k: 1 });
    await hybridEngine.search('cache validation', { k: 1 });

    // Check updated statistics
    stats = vectorStore.getCacheStats();
    expect(stats.totalDocuments).toBe(1);
    expect(stats.totalSearches).toBeGreaterThan(0);
  });

  test('Performance statistics are available', async () => {
    const performanceStats = hybridEngine.getPerformanceStats();
    
    expect(performanceStats).toHaveProperty('averageSearchTime');
    expect(performanceStats).toHaveProperty('totalSearches');
    expect(performanceStats).toHaveProperty('cacheHitRate');
    expect(performanceStats).toHaveProperty('memoryUsage');
  });

  test('Memory usage tracking works correctly', async () => {
    const memoryUsage = hybridEngine.getMemoryUsage();
    
    expect(memoryUsage).toHaveProperty('vectorCacheSize');
    expect(memoryUsage).toHaveProperty('documentsCached');
    expect(memoryUsage).toHaveProperty('maxMemoryMB');
    expect(memoryUsage).toHaveProperty('usedMemoryMB');
    
    expect(typeof memoryUsage.vectorCacheSize).toBe('number');
    expect(typeof memoryUsage.documentsCached).toBe('number');
  });

  test('System gracefully handles configuration changes', () => {
    // Test initialization with different configurations
    const smallCacheEngine = new HybridQueryEngine({
      useRamCache: true,
      ramCacheConfig: {
        maxMemoryMB: 512,
        vectorDimensions: 384,
        maxDocuments: 5000
      }
    });

    expect(smallCacheEngine).toBeInstanceOf(HybridQueryEngine);
    
    const memoryConfig = smallCacheEngine.getMemoryUsage();
    expect(memoryConfig.maxMemoryMB).toBe(512);
  });

  test('Backwards compatibility without RAM cache', () => {
    // Test that the system still works without RAM cache enabled
    const traditionalEngine = new HybridQueryEngine({
      useRamCache: false
    });

    expect(traditionalEngine).toBeInstanceOf(HybridQueryEngine);
    
    // Should fall back to SimpleVectorStore
    const vectorStore = (traditionalEngine as any).vectorStore;
    expect(vectorStore).not.toBeInstanceOf(CachedVectorStore);
  });
});