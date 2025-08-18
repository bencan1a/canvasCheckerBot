import { Ollama } from 'ollama';

async function testOllama() {
  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
  });
  
  console.log('Testing Ollama connection...');
  console.log('Host:', process.env.OLLAMA_BASE_URL || 'http://ollama:11434');
  
  try {
    const response = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: 'test'
    });
    console.log('Success! Embedding length:', response.embedding.length);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testOllama();