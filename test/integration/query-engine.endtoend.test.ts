import { readFileSync } from 'fs';
import { join } from 'path';
import { QueryEngine } from '../../src/rag/query-engine.js';
import InmemoryVectorStore from '../helpers/inmemoryVectorStore';

jest.setTimeout(30000);

describe('QueryEngine — focused end-to-end integration (in-memory vector store + mocked LLM)', () => {
  const fixturePath = join(__dirname, '..', 'fixtures', 'sample-student-data.json');
  const studentData = JSON.parse(readFileSync(fixturePath, 'utf8'));

  let engine: QueryEngine;
  let inmemory: InmemoryVectorStore;
  let ollamaMock: any;

  beforeEach(() => {
    engine = new QueryEngine();

    // Inject the test in-memory vector store
    inmemory = new InmemoryVectorStore(2);
    // @ts-ignore - replace private field for testing
    (engine as any).vectorStore = inmemory;

    // Minimal deterministic Ollama mock used by QueryEngine
    ollamaMock = {
      generate: jest.fn(async ({ prompt }: any) => {
        // Return an object shaped like production usage: { response: string }
        // Include marker so tests can assert mapping from prompt->answer
        return { response: `MOCK_ANSWER: ${prompt.slice(0, 120).replace(/\n/g, ' ')}` };
      }),
      embeddings: jest.fn(async ({ prompt }: any) => {
        // Not used by InmemoryVectorStore but present for completeness
        return { embedding: [0.1, 0.2, 0.3] };
      }),
      list: jest.fn(async () => ({ models: [{ name: 'llama3' }, { name: 'nomic-embed-text' }] }))
    };

    // Inject mocked ollama client
    // @ts-ignore
    (engine as any).ollama = ollamaMock;
  });

  test('end-to-end retrieval -> prompt -> mocked LLM -> shaped response for a single query', async () => {
    await engine.initialize(studentData);

    const res = await engine.query('When is my HTTP lab due?');
    expect(res).toBeDefined();
    expect(typeof res.answer).toBe('string');
    expect(res.answer).toContain('MOCK_ANSWER:');
    expect(Array.isArray(res.sources)).toBe(true);
    expect(typeof res.confidence).toBe('number');
  });

  test('multi-document relevance ordering (in-memory distances)', async () => {
    // Prepare controlled documents
    await inmemory.reset();
    await inmemory.addDocuments([
      { id: 'm1', text: 'Matrix multiplication and inverse matrices', metadata: { courseId: 101 } },
      { id: 'm2', text: 'HTTP servers and REST API design', metadata: { courseId: 102 } },
      { id: 'm3', text: 'Express routing and middleware patterns', metadata: { courseId: 102 } }
    ] as any);

    const results = await inmemory.search('matrix inverse', 3);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Most relevant doc should be about matrices
    expect(results[0].document).toMatch(/Matrix multiplication/i);
    // Ensure ordering by score (ascending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score - 1e-8);
    }
  });

  test('handling empty retrieval: QueryEngine returns graceful shaped response (no crash)', async () => {
    // Ensure vector store empty
    await inmemory.reset();

    // Make LLM respond with an explicit "no relevant info" when prompt has little context
    ollamaMock.generate.mockImplementationOnce(async ({ prompt }: any) => {
      return { response: 'MOCK_ANSWER: No relevant info found in context.' };
    });

    const res = await engine.query('Tell me about quantum entanglement in my courses.');
    expect(res).toBeDefined();
    expect(res.answer).toContain('MOCK_ANSWER:');
    // Sources should be an array (likely empty)
    expect(Array.isArray(res.sources)).toBe(true);
  });
});