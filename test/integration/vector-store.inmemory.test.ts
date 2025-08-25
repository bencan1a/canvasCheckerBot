import InmemoryVectorStore from '../helpers/inmemoryVectorStore';

describe('InmemoryVectorStore (test helper)', () => {
  let store: InmemoryVectorStore;

  beforeEach(async () => {
    store = new InmemoryVectorStore(2);
    await store.initialize();
    await store.reset();
  });

  test('add & search correctness: add 5 docs and search returns expected top ids', async () => {
    const docs = [
      { id: 'a1', text: 'Linear algebra: matrix inverse and determinants', metadata: { courseId: 101 } },
      { id: 'a2', text: 'HTTP basics: request methods and status codes', metadata: { courseId: 102 } },
      { id: 'a3', text: 'Express: routing and middleware', metadata: { courseId: 102 } },
      { id: 'a4', text: 'Calculus: derivatives and integrals', metadata: { courseId: 101 } },
      { id: 'a5', text: 'Databases: SQL joins and indexing', metadata: { courseId: 104 } }
    ] as any;

    await store.addDocuments(docs);

    const results = await store.search('matrix inverse', 3);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Most relevant should mention matrix/inverse
    expect(results[0].document).toMatch(/matrix inverse|Matrix inverse|matrix/i);
  });

  test('persistence semantics: batching works when batchSize < number of docs', async () => {
    // Construct many docs and use small batch size to force multiple batches
    const manyDocs = [];
    for (let i = 0; i < 7; i++) {
      manyDocs.push({ id: `doc-${i}`, text: `Document number ${i} about topic ${i % 3}`, metadata: { idx: i } } as any);
    }

    // Create store with batchSize 3 to ensure batching code path runs
    store = new InmemoryVectorStore(3);
    await store.initialize();
    await store.addDocuments(manyDocs);

    const ids = store.getDocumentIds();
    expect(ids.length).toBe(7);
    // Ensure a sample search returns something reasonable
    const r = await store.search('topic 1', 5);
    expect(Array.isArray(r)).toBe(true);
  });
});