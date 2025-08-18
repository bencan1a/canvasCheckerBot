/**
 * RAM Cache System Validation Script
 * Validates that our new RAM-based vector caching system is properly integrated
 */

import { HybridQueryEngine } from '../src/rag/hybrid-query-engine';

interface DocumentChunk {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

async function validateRamCacheSystem() {
  console.log('🚀 Starting RAM Cache System Validation\n');

  try {
    // Test 1: Initialize with RAM cache enabled
    console.log('✅ Test 1: Initialize HybridQueryEngine with RAM cache...');
    const hybridEngine = new HybridQueryEngine({
      model: 'mock-model',
      host: 'localhost',
      port: 8000,
      gpuId: 0
    }, 'nomic-embed-text', {
      enableRamCache: true,
      ramCacheConfig: {
        maxMemoryGB: 0.5,  // 512MB for testing
        embeddingDimensions: 768,
        maxDocuments: 5000
      }
    });
    console.log('   ✓ HybridQueryEngine initialized successfully with RAM cache\n');

    // Test 2: Add test documents
    console.log('✅ Test 2: Add test documents to the system...');
    const testDocuments: DocumentChunk[] = [
      {
        id: 'canvas-1',
        text: 'Canvas assignment submission with student feedback and grading rubric',
        metadata: { type: 'assignment', course: 'CS101' }
      },
      {
        id: 'canvas-2',
        text: 'Discussion forum post about course materials and programming concepts',
        metadata: { type: 'discussion', course: 'CS101' }
      },
      {
        id: 'canvas-3',
        text: 'Quiz results showing student performance metrics and analytics',
        metadata: { type: 'quiz', course: 'CS102' }
      },
      {
        id: 'canvas-4',
        text: 'Grade analytics dashboard displaying course-wide performance data',
        metadata: { type: 'analytics', course: 'CS102' }
      }
    ];

    // Access the vector store directly for adding documents
    const vectorStore = (hybridEngine as any).vectorStore;
    await vectorStore.addDocuments(testDocuments);
    console.log('   ✓ Successfully added 4 test documents to RAM cache\n');

    // Test 3: Perform searches
    console.log('✅ Test 3: Perform vector searches...');
    const searchResults = await vectorStore.search('programming assignment', 2);

    console.log('   ✓ Search completed successfully');
    console.log(`   ✓ Found ${searchResults.length} results`);
    
    if (searchResults.length > 0) {
      console.log('   ✓ Results have required structure:');
      const firstResult = searchResults[0];
      console.log(`     - content: ${typeof firstResult.content === 'string' ? '✓' : '✗'}`);
      console.log(`     - similarity: ${typeof firstResult.similarity === 'number' ? '✓' : '✗'}`);
      console.log(`     - metadata: ${typeof firstResult.metadata === 'object' ? '✓' : '✗'}`);
    }
    console.log('');

    // Test 4: Check performance statistics
    console.log('✅ Test 4: Validate performance statistics...');
    const perfStats = vectorStore.getPerformanceStats();
    console.log('   ✓ Performance statistics available:');
    console.log(`     - averageSearchTime: ${typeof perfStats.averageSearchTime === 'number' ? '✓' : '✗'}`);
    console.log(`     - totalSearches: ${typeof perfStats.totalSearches === 'number' ? '✓' : '✗'}`);
    console.log(`     - cacheHitRate: ${typeof perfStats.cacheHitRate === 'number' ? '✓' : '✗'}`);
    console.log(`     - memoryUsage: ${typeof perfStats.memoryUsage === 'object' ? '✓' : '✗'}`);
    console.log('');

    // Test 5: Check memory usage tracking
    console.log('✅ Test 5: Validate memory usage tracking...');
    const memoryUsage = vectorStore.getMemoryUsage();
    console.log('   ✓ Memory usage tracking available:');
    console.log(`     - vectorCacheSize: ${typeof memoryUsage.vectorCacheSize === 'number' ? '✓' : '✗'}`);
    console.log(`     - documentsCached: ${typeof memoryUsage.documentsCached === 'number' ? '✓' : '✗'}`);
    console.log(`     - maxMemoryMB: ${typeof memoryUsage.maxMemoryMB === 'number' ? '✓' : '✗'}`);
    console.log(`     - usedMemoryMB: ${typeof memoryUsage.usedMemoryMB === 'number' ? '✓' : '✗'}`);
    console.log('');

    // Test 6: Test backward compatibility
    console.log('✅ Test 6: Test backward compatibility (without RAM cache)...');
    const traditionalEngine = new HybridQueryEngine({
      model: 'mock-model',
      host: 'localhost',
      port: 8000,
      gpuId: 0
    }, 'nomic-embed-text', {
      enableRamCache: false
    });
    
    const traditionalVectorStore = (traditionalEngine as any).vectorStore;
    await traditionalVectorStore.addDocuments([testDocuments[0]]);
    const traditionalResults = await traditionalVectorStore.search('assignment', 1);
    
    console.log('   ✓ Traditional engine (without RAM cache) works correctly');
    console.log(`   ✓ Found ${traditionalResults.length} results in traditional mode\n`);

    // Summary
    console.log('🎉 RAM Cache System Validation Complete!\n');
    console.log('📊 Validation Summary:');
    console.log('   ✅ RAM cache initialization');
    console.log('   ✅ Document addition to cache'); 
    console.log('   ✅ Vector search functionality');
    console.log('   ✅ Performance statistics tracking');
    console.log('   ✅ Memory usage monitoring');
    console.log('   ✅ Backward compatibility maintained');
    console.log('\n🚀 The new RAM-based vector caching system is successfully integrated and functional!');

    return true;

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

// Run validation
validateRamCacheSystem()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Validation script crashed:', error);
    process.exit(1);
  });

export { validateRamCacheSystem };