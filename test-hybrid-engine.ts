const { HybridQueryEngine } = require('./dist/rag/hybrid-query-engine.js');
const { CanvasService } = require('./dist/canvas-service.js');
const dotenv = require('dotenv');

dotenv.config();

async function testHybridEngine() {
  console.log('🚀 Testing Hybrid Query Engine with vLLM + Enhanced Temporal Context');
  
  // Initialize Canvas service
  const config: CanvasConfig = {
    baseUrl: process.env.CANVAS_BASE_URL || '',
    accessToken: process.env.CANVAS_ACCESS_TOKEN || '',
    studentId: process.env.STUDENT_ID,
  };

  if (!config.baseUrl || !config.accessToken) {
    console.error('❌ Missing Canvas configuration in .env file');
    process.exit(1);
  }

  const canvasService = new CanvasService(config);
  
  // Initialize hybrid query engine with vLLM
  const queryEngine = new HybridQueryEngine({
    model: 'Qwen/Qwen2.5-7B-Instruct',
    port: 8001,
    gpuId: 0
  });

  try {
    console.log('🔧 Starting vLLM server...');
    await queryEngine.startVLLM();
    
    console.log('📚 Loading Canvas data...');
    await canvasService.refreshIfStale();
    const studentData = await canvasService.getAllData();
    
    console.log('🧠 Initializing query engine...');
    await queryEngine.initialize(studentData);
    
    // Test temporal reasoning queries
    const testQueries = [
      "What year is it currently?",
      "How many courses did I have last year?",
      "What assignments do I have from last academic year?",
      "If I'm starting Fall 2025 semester, what was the previous academic year?",
      "How many assignments were due in Spring 2025?",
      "Show me my course load from the 2024-2025 academic year"
    ];

    console.log('\n🔍 Testing temporal reasoning queries:');
    console.log('═'.repeat(80));

    for (const query of testQueries) {
      console.log(`\n❓ Query: ${query}`);
      console.log('-'.repeat(60));
      
      try {
        const result = await queryEngine.query(query);
        console.log(`✅ Answer: ${result.answer}`);
        console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`📝 Sources: ${result.sources.length} relevant documents`);
      } catch (error) {
        console.error(`❌ Error: ${error}`);
      }
    }

  } catch (error) {
    console.error('💥 Error during testing:', error);
  } finally {
    console.log('\n🛑 Stopping vLLM server...');
    await queryEngine.stopVLLM();
    console.log('✅ Test completed');
  }
}

// Run the test
testHybridEngine().catch(console.error);