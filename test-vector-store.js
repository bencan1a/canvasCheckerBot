import { Ollama } from 'ollama';

async function testVectorStore() {
  console.log('Testing vector store...');
  
  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
  });
  
  const embeddingModel = 'nomic-embed-text';
  
  try {
    console.log(`Testing single embedding with model: ${embeddingModel}`);
    console.log(`Host: ${process.env.OLLAMA_BASE_URL || 'http://ollama:11434'}`);
    
    const testChunk = {
      id: 'test-1',
      text: 'This is a test document chunk.',
      metadata: { type: 'test' }
    };
    
    console.log('Making embedding request...');
    const response = await ollama.embeddings({
      model: embeddingModel,
      prompt: testChunk.text
    });
    
    console.log('Success! Embedding length:', response.embedding.length);
    
    // Test multiple embeddings in sequence like the real code
    console.log('Testing multiple embeddings...');
    for (let i = 0; i < 5; i++) {
      const resp = await ollama.embeddings({
        model: embeddingModel,
        prompt: `Test chunk ${i}: This is chunk number ${i} with some sample text.`
      });
      console.log(`Chunk ${i}: embedding length ${resp.embedding.length}`);
    }
    
    console.log('All tests passed!');
    
  } catch (error) {
    console.error('Error during test:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testVectorStore();