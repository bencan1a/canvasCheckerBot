import { CachedVectorStore, CachedVectorStoreConfig } from '../../src/rag/cached-vector-store';
import { DocumentChunk } from '../../src/rag/data-preprocessor';
import { RamVectorCache } from '../../src/rag/ram-vector-cache';
import { PersistentVectorStore } from '../../src/rag/persistent-vector-store';

// Mock the dependencies
jest.mock('../../src/rag/ram-vector-cache');
jest.mock('../../src/rag/persistent-vector-store');
jest.mock('ollama');

// Mock console methods to reduce noise
const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleTime = jest.spyOn(console, 'time').mockImplementation(() => {});
const consoleTimeEnd = jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

describe('CachedVectorStore.addDocuments', () => {
  let cachedStore: CachedVectorStore;
  let mockRamCache: jest.Mocked<RamVectorCache>;
  let mockFallbackStore: jest.Mocked<PersistentVectorStore>;
  let mockConfig: Partial<CachedVectorStoreConfig>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      embeddingModel: 'nomic-embed-text',
      ramCache: {
        maxMemoryGB: 1,
        cacheStrategy: 'LRU',
        indexType: 'FLAT',
        embeddingDimensions: 768,
        maxDocuments: 1000
      },
      fallbackToSimple: true,
      preloadStrategy: 'background',
      warmupEnabled: false
    };

    // Mock the dependencies
    mockRamCache = {
      addDocuments: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockFallbackStore = {
      addDocuments: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock the constructors
    (RamVectorCache as jest.MockedClass<typeof RamVectorCache>).mockImplementation(() => mockRamCache);
    (PersistentVectorStore as jest.MockedClass<typeof PersistentVectorStore>).mockImplementation(() => mockFallbackStore);

    cachedStore = new CachedVectorStore(mockConfig);
  });

  it('should successfully add documents to both RAM cache and fallback store', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document 1',
        metadata: {
          type: 'course',
          courseId: 1,
          courseName: 'Test Course'
        }
      },
      {
        id: 'doc2',
        text: 'Test document 2',
        metadata: {
          type: 'assignment',
          courseId: 1,
          assignmentId: 101
        }
      }
    ];

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1) // Mock 768-dimensional embedding
      })
    };
    (cachedStore as any).ollama = mockOllama;

    await cachedStore.addDocuments(mockChunks);

    // Verify RAM cache was called with correct parameters
    expect(mockRamCache.addDocuments).toHaveBeenCalledWith(
      mockChunks,
      expect.any(Array) // Embeddings array
    );

    // Verify embeddings were generated for both documents
    expect(mockOllama.embeddings).toHaveBeenCalledTimes(2);
    expect(mockOllama.embeddings).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      prompt: 'Test document 1'
    });
    expect(mockOllama.embeddings).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      prompt: 'Test document 2'
    });
  });

  it('should handle empty document arrays gracefully', async () => {
    const mockChunks: DocumentChunk[] = [];

    await cachedStore.addDocuments(mockChunks);

    // Should not call any storage methods for empty arrays
    expect(mockRamCache.addDocuments).not.toHaveBeenCalled();
    expect(mockFallbackStore.addDocuments).not.toHaveBeenCalled();
  });

  it('should use background strategy for fallback store when configured', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document',
        metadata: { type: 'course', courseId: 1 }
      }
    ];

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };
    (cachedStore as any).ollama = mockOllama;

    // Configure for background strategy
    mockConfig.preloadStrategy = 'background';
    cachedStore = new CachedVectorStore(mockConfig);
    (cachedStore as any).ollama = mockOllama;

    await cachedStore.addDocuments(mockChunks);

    // RAM cache should be called immediately
    expect(mockRamCache.addDocuments).toHaveBeenCalled();

    // Fallback store should be called in background
    expect(mockFallbackStore.addDocuments).toHaveBeenCalledWith(mockChunks);
  });

  it('should use eager strategy for fallback store when configured', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document',
        metadata: { type: 'course', courseId: 1 }
      }
    ];

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };

    // Configure for eager strategy
    mockConfig.preloadStrategy = 'eager';
    cachedStore = new CachedVectorStore(mockConfig);
    (cachedStore as any).ollama = mockOllama;

    await cachedStore.addDocuments(mockChunks);

    // Both RAM cache and fallback store should be called
    expect(mockRamCache.addDocuments).toHaveBeenCalled();
    expect(mockFallbackStore.addDocuments).toHaveBeenCalledWith(mockChunks);
  });

  it('should handle RAM cache failure and fallback to simple store', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document',
        metadata: { type: 'course', courseId: 1 }
      }
    ];

    // Mock RAM cache to fail
    mockRamCache.addDocuments.mockRejectedValue(new Error('RAM cache failed'));

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };
    (cachedStore as any).ollama = mockOllama;

    // Should not throw error when fallback is enabled
    await expect(cachedStore.addDocuments(mockChunks)).resolves.not.toThrow();

    // Fallback store should be called
    expect(mockFallbackStore.addDocuments).toHaveBeenCalledWith(mockChunks);
  });

  it('should throw error when both RAM cache and fallback fail', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document',
        metadata: { type: 'course', courseId: 1 }
      }
    ];

    // Mock both stores to fail
    mockRamCache.addDocuments.mockRejectedValue(new Error('RAM cache failed'));
    mockFallbackStore.addDocuments.mockRejectedValue(new Error('Fallback store failed'));

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };
    (cachedStore as any).ollama = mockOllama;

    // Configure to not fallback
    mockConfig.fallbackToSimple = false;
    cachedStore = new CachedVectorStore(mockConfig);
    (cachedStore as any).ollama = mockOllama;

    await expect(cachedStore.addDocuments(mockChunks)).rejects.toThrow('RAM cache failed');
  });

  it('should batch embedding generation for efficiency', async () => {
    const mockChunks: DocumentChunk[] = Array.from({ length: 5 }, (_, i) => ({
      id: `doc${i}`,
      text: `Test document ${i}`,
      metadata: { type: 'course', courseId: 1 }
    }));

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };
    (cachedStore as any).ollama = mockOllama;

    await cachedStore.addDocuments(mockChunks);

    // Should be called 5 times (once per document)
    expect(mockOllama.embeddings).toHaveBeenCalledTimes(5);

    // Verify RAM cache received all documents and embeddings
    expect(mockRamCache.addDocuments).toHaveBeenCalledWith(
      mockChunks,
      expect.any(Array)
    );
  });

  it('should skip fallback store when fallbackToSimple is disabled', async () => {
    const mockChunks: DocumentChunk[] = [
      {
        id: 'doc1',
        text: 'Test document',
        metadata: { type: 'course', courseId: 1 }
      }
    ];

    // Configure to not use fallback
    mockConfig.fallbackToSimple = false;
    cachedStore = new CachedVectorStore(mockConfig);

    // Mock the Ollama embeddings
    const mockOllama = {
      embeddings: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0.1)
      })
    };
    (cachedStore as any).ollama = mockOllama;

    await cachedStore.addDocuments(mockChunks);

    // RAM cache should still be called
    expect(mockRamCache.addDocuments).toHaveBeenCalled();

    // Fallback store should not be called
    expect(mockFallbackStore.addDocuments).not.toHaveBeenCalled();
  });
});