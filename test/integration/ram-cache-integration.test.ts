/**
 * Integration Test for RAM-based Vector Cache System
 * Validates that the new caching approach is working correctly
 */

import { HybridQueryEngine } from '../../src/rag/hybrid-query-engine';
import { CachedVectorStore } from '../../src/rag/cached-vector-store';
import { RamVectorCache } from '../../src/rag/ram-vector-cache';

// Mock Ollama to avoid external dependencies
jest.mock('ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    embeddings: jest.fn().mockResolvedValue({
      embedding: new Array(768).fill(0).map(() => Math.random())
    })
  }))
}));

// Mock axios for VLLM calls
jest.mock('axios', () => {
  const mockPost = jest.fn().mockResolvedValue({
    data: {
      choices: [{
        text: 'Mocked response for testing'
      }]
    }
  });
  const mockGet = jest.fn().mockResolvedValue({ data: {} });
  
  return {
    default: {
      post: mockPost,
      get: mockGet
    },
    post: mockPost,
    get: mockGet
  };
});

describe('RAM Cache Integration', () => {
  let hybridEngine: HybridQueryEngine;

  beforeEach(async () => {
    // Initialize with RAM cache enabled
    const vllmConfig = {
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model'
    };
    
    hybridEngine = new HybridQueryEngine(
      vllmConfig,
      'nomic-embed-text',
      {
        enableRamCache: true,
        ramCacheConfig: {
          embeddingModel: 'nomic-embed-text',
          ramCache: {
            maxMemoryGB: 1, // 1GB for testing
            cacheStrategy: 'LRU',
            indexType: 'FLAT',
            embeddingDimensions: 768
          }
        }
      }
    );
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
    const testStudentData = {
      courses: [
        {
          id: 101,
          name: 'Computer Science 101',
          course_code: 'CS101'
        },
        {
          id: 102,
          name: 'Computer Science 102',
          course_code: 'CS102'
        }
      ],
      assignments: [
        {
          id: 1,
          name: 'Test Assignment 1',
          course_id: 101,
          due_at: '2024-12-30',
          points_possible: 100,
          submission: {
            submitted_at: '2024-12-25',
            score: 95,
            grade: 'A'
          }
        }
      ],
      discussions: [
        {
          id: 2,
          title: 'Discussion Topic',
          message: 'Discussion about course materials',
          course_id: 101
        }
      ],
      quizzes: [
        {
          id: 3,
          title: 'Quiz 1',
          course_id: 102,
          points_possible: 50
        }
      ],
      submissions: [
        {
          assignment_id: 1,
          workflow_state: 'submitted',
          submitted_at: '2024-12-25',
          score: 95,
          grade: 'A'
        }
      ]
    };

    // Initialize with student data - should populate the RAM cache
    await hybridEngine.initialize(testStudentData as any);

    // Verify cache has documents
    const vectorStore = (hybridEngine as any).vectorStore as CachedVectorStore;
    const ramCache = (vectorStore as any).ramCache as RamVectorCache;
    const cacheStats = ramCache.getStats();
    
    expect(cacheStats.totalDocuments).toBeGreaterThan(0);
    expect(cacheStats.memoryUsedBytes).toBeGreaterThan(0);
  });

  test('System can perform queries using RAM cache', async () => {
    // Add test student data
    const testStudentData = {
      courses: [
        {
          id: 101,
          name: 'Computer Science 101',
          course_code: 'CS101'
        }
      ],
      assignments: [
        {
          id: 1,
          name: 'Programming Assignment',
          course_id: 101,
          description: 'Implement a sorting algorithm',
          due_at: '2024-12-30',
          points_possible: 100,
          submission: {
            submitted_at: '2024-12-25',
            score: 95,
            grade: 'A'
          }
        },
        {
          id: 2,
          name: 'Data Structures Assignment',
          course_id: 101,
          description: 'Implement a binary tree',
          due_at: '2024-12-31',
          points_possible: 100
        }
      ],
      discussions: [
        {
          id: 3,
          title: 'Programming Concepts',
          message: 'Discussion about programming concepts and algorithms',
          course_id: 101
        }
      ],
      quizzes: [],
      submissions: [
        {
          assignment_id: 1,
          workflow_state: 'submitted',
          submitted_at: '2024-12-25',
          score: 95,
          grade: 'A'
        }
      ]
    };

    await hybridEngine.initialize(testStudentData as any);

    // Perform query
    const result = await hybridEngine.query('programming assignment');

    expect(result).toBeDefined();
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('sources');
    expect(typeof result.confidence).toBe('number');
  });

  test('Cache statistics are properly tracked', async () => {
    const vectorStore = (hybridEngine as any).vectorStore as CachedVectorStore;
    const ramCache = (vectorStore as any).ramCache as RamVectorCache;
    
    // Initial state
    let stats = ramCache.getStats();
    expect(stats.cacheHitRate).toBe(0);
    expect(stats.evictionCount).toBe(0);

    // Add documents
    const testStudentData = {
      courses: [
        {
          id: 101,
          name: 'Computer Science 101',
          course_code: 'CS101'
        }
      ],
      assignments: [
        {
          id: 1,
          name: 'Test Assignment',
          course_id: 101,
          description: 'Test document for cache statistics validation',
          due_at: '2024-12-30',
          points_possible: 100
        }
      ],
      discussions: [],
      quizzes: [],
      submissions: []
    };

    await hybridEngine.initialize(testStudentData as any);

    // Perform queries to generate cache activity
    await hybridEngine.query('test document');
    await hybridEngine.query('cache validation');

    // Check updated statistics
    stats = ramCache.getStats();
    expect(stats.totalDocuments).toBeGreaterThan(0);
    expect(stats.averageSearchTime).toBeGreaterThanOrEqual(0);
  });

  test('Performance statistics are available', () => {
    const performanceStats = hybridEngine.getPerformanceStats();
    
    expect(performanceStats).toHaveProperty('stats');
    expect(performanceStats).toHaveProperty('memoryUsage');
    expect(performanceStats).toHaveProperty('performanceMetrics');
  });

  test('Memory usage tracking works correctly', () => {
    const memoryUsage = hybridEngine.getMemoryUsage();
    
    expect(memoryUsage).toHaveProperty('totalAllocatedGB');
    expect(memoryUsage).toHaveProperty('ramCache');
    expect(memoryUsage.ramCache).toHaveProperty('vectorMemoryGB');
    expect(memoryUsage.ramCache).toHaveProperty('metadataMemoryMB');
    
    expect(typeof memoryUsage.totalAllocatedGB).toBe('number');
    expect(typeof memoryUsage.ramCache.vectorMemoryGB).toBe('number');
  });

  test('System gracefully handles configuration changes', () => {
    // Test initialization with different configurations
    const vllmConfig = {
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model'
    };
    
    const smallCacheEngine = new HybridQueryEngine(
      vllmConfig,
      'nomic-embed-text',
      {
        enableRamCache: true,
        ramCacheConfig: {
          embeddingModel: 'nomic-embed-text',
          ramCache: {
            maxMemoryGB: 0.5, // 512MB
            cacheStrategy: 'LRU',
            indexType: 'FLAT',
            embeddingDimensions: 384
          }
        }
      }
    );

    expect(smallCacheEngine).toBeInstanceOf(HybridQueryEngine);
    
    const vectorStore = (smallCacheEngine as any).vectorStore as CachedVectorStore;
    const ramCache = (vectorStore as any).ramCache as RamVectorCache;
    const memoryUsage = ramCache.getMemoryUsage();
    expect(memoryUsage.totalAllocatedGB).toBeLessThanOrEqual(0.5);
  });

  test('Backwards compatibility without RAM cache', () => {
    // Test that the system still works without RAM cache enabled
    const vllmConfig = {
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model'
    };
    
    const traditionalEngine = new HybridQueryEngine(
      vllmConfig,
      'nomic-embed-text',
      {
        enableRamCache: false
      }
    );

    expect(traditionalEngine).toBeInstanceOf(HybridQueryEngine);
    
    // Should fall back to SimpleVectorStore
    const vectorStore = (traditionalEngine as any).vectorStore;
    expect(vectorStore).not.toBeInstanceOf(CachedVectorStore);
  });
});