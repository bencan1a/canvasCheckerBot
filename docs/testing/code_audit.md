Code Audit: RAG & Canvas critical paths

Summary
- Focus: RAG components under [`src/rag/`](src/rag/:1), Canvas API wrapper [`src/canvas-client.ts`](src/canvas-client.ts:46), server orchestration [`src/server.ts`](src/server.ts:60), and CLI entry [`src/index.ts`](src/index.ts:7).
- Goal: produce prioritized test targets, mocks, and blockers so test engineers can implement tests immediately.

Entry points and public interfaces
- CLI: [`src/index.ts`](src/index.ts:7) — commands: test, sync, status, query, etc. (lines 23-104).
- HTTP / WebSocket server: class [`CanvasRAGServer`](src/server.ts:60) — routes (GET /api/health, /api/models, POST /api/initialize, /api/sync) and socket handlers (lines 127-241, 244-329).
- RAG Query Engine: class [`QueryEngine`](src/rag/query-engine.ts:15) — core method `query(userQuery: string, studentId?: string): Promise<QueryResult>` (lines 152-249) and `initialize()` (lines 34-52).
- Hybrid/vLLM engines: class [`HybridQueryEngine`](src/rag/hybrid-query-engine.ts:40) — methods `initialize()` (78-96) and `query()` (98-136).
- Vector stores: [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:20), [`src/rag/vector-store.ts`](src/rag/vector-store.ts:11), [`src/rag/ram-vector-cache.ts`](src/rag/ram-vector-cache.ts:42).

Important types to cite
- [`src/types.ts`](src/types.ts:411) `StudentData` (lines 411-421).
- [`src/types.ts`](src/types.ts:423) `DocumentChunk` (lines 423-438).
- [`src/rag/vector-store.ts`](src/rag/vector-store.ts:5) `SearchResult` (lines 5-9).

External dependencies and services to mock
- Ollama HTTP endpoints: used in [`src/rag/query-engine.ts`](src/rag/query-engine.ts:26) and [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:45) for LLM and embeddings.
- ChromaDB / ChromaClient: [`src/rag/vector-store.ts`](src/rag/vector-store.ts:1, 17-24) — vector DB queries and where-filtering.
- vLLM or simulated VLLM: [`src/rag/hybrid-query-engine.ts`](src/rag/hybrid-query-engine.ts:229) — `callVLLM` placeholder; integration point.
- Canvas API (axios): [`src/canvas-client.ts`](src/canvas-client.ts:1, 50-60) — networked endpoints and retry logic.
- File I/O / Local storage: referenced from server (`storage.loadStudentData`) — mockable boundary.
- Socket.IO: [`src/server.ts`](src/server.ts:72) — socket events.

Long-running / flaky operations to avoid in quick test suites
- Warmup and background tasks in [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:252-296) and background addToFallbackInBackground (lines 237-249).
- Large-memory allocation in [`src/rag/ram-vector-cache.ts`](src/rag/ram-vector-cache.ts:79-105) — avoid real allocations in unit tests.
- Network calls to Canvas and remote model servers: [`src/canvas-client.ts`](src/canvas-client.ts:138-188), [`src/rag/query-engine.ts`](src/rag/query-engine.ts:230-238).

Prioritized concrete test targets (8–15)
Each entry: file, symbol (with lines), one-line justification, suggested test type, mocking recommendation.

1) [`src/rag/query-engine.ts`](src/rag/query-engine.ts:152) — QueryEngine.query(userQuery: string, studentId?: string) (lines 152-249)
   - Why: central orchestration from user query -> search -> prompt -> Ollama generate.
   - Type: integration (fast path) / unit (with mocks).
   - Mock: vector store search methods, `studentProfileManager`, and `Ollama.generate()` to assert prompt composition, temporal parsing, and response mapping.

2) [`src/rag/data-preprocessor.ts`](src/rag/data-preprocessor.ts:16) — DataPreprocessor.processStudentData(data: StudentData) (lines 16-90)
   - Why: converts Canvas JSON to DocumentChunk objects used by vector stores.
   - Type: unit.
   - Mock: provide small StudentData fixtures; no external mocks required.

3) [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:72) — CachedVectorStore.addDocuments(chunks: DocumentChunk[]) (lines 72-109)
   - Why: embedding generation batching, caching, and fallback behavior (including error path).
   - Type: unit.
   - Mock: `Ollama.embeddings()`, `RamVectorCache.addDocuments()`, `PersistentVectorStore.addDocuments()`; simulate failures to verify fallback.

4) [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:114) — CachedVectorStore.search(query: string, k?: number) (lines 114-139)
   - Why: primary read path; tests for cache fallback to simple store.
   - Type: unit.
   - Mock: `RamVectorCache.search()` to throw and `PersistentVectorStore.search()` to return deterministic results.

5) [`src/rag/ram-vector-cache.ts`](src/rag/ram-vector-cache.ts:164) — RamVectorCache.search(queryEmbedding: Float32Array, k?: number) (lines 164-194)
   - Why: core similarity computation; validate top-k selection and SIMD dot-product logic paths.
   - Type: unit.
   - Mock: avoid allocating ArrayBuffer; instantiate RamVectorCache with small embeddingDimensions and maxMemoryGB=0.001 in test or stub internal memory structures; inject small documents and embeddings.

6) [`src/rag/vector-store.ts`](src/rag/vector-store.ts:27) — VectorStore.initialize() (lines 27-57)
   - Why: builds collection and embedding function; critical integration with Chroma and Ollama embeddings.
   - Type: integration (contract) with mocks.
   - Mock: ChromaClient.createCollection / deleteCollection and `Ollama.embeddings()`; assert embeddingFunction.generate called.

7) [`src/canvas-client.ts`](src/canvas-client.ts:138) — CanvasClient.executeWithRetry<T>(requestFn, options) (lines 138-188)
   - Why: central error handling and retry/backoff logic for Canvas API calls.
   - Type: unit.
   - Mock: `requestFn` to throw axios-like errors with response/request properties; assert parseCanvasError mapping to proper error types and retry behavior (use fake timers for backoff).

8) [`src/canvas-client.ts`](src/canvas-client.ts:65) — CanvasClient.parseCanvasError(error) (lines 65-125)
   - Why: converts axios errors into rich domain errors used across codebase.
   - Type: unit.
   - Mock: craft error shapes (error.response with status 401/403/404/429/500, error.request, plain Error) and assert returned class instanceof expected error classes.

9) [`src/server.ts`](src/server.ts:381) — CanvasRAGServer.initializeRAGSystem(llmModel, embeddingModel) (lines 381-398)
   - Why: bootstraps QueryEngine and wires storage data; important startup flow.
   - Type: integration.
   - Mock: `LocalStorage.loadStudentData()` to return fixture StudentData; mock `QueryEngine.initialize()` to avoid heavy vector ops.

10) [`src/server.ts`](src/server.ts:244) — socket 'chat-message' handler (lines 254-284)
    - Why: real-time path from socket message to QueryEngine.query and socket emits.
    - Type: integration (socket-level) or unit (handler).
    - Mock: `QueryEngine.query()` to return predictable QueryResult; test emits and error path.

11) [`src/rag/hybrid-query-engine.ts`](src/rag/hybrid-query-engine.ts:98) — HybridQueryEngine.query(userQuery) (lines 98-136)
    - Why: alternate RAG engine using VLLM; validate prompt generation and confidence calc.
    - Type: unit.
    - Mock: vectorStore.search and `callVLLM()` to assert confidence calculation and return shape.

12) [`src/rag/cached-vector-store.ts`](src/rag/cached-vector-store.ts:254) — performWarmup() (lines 274-296)
    - Why: background warmup causes long-running network calls — test to ensure failures are handled without crashing.
    - Type: unit.
    - Mock: `getQueryEmbedding()` to succeed/fail; ensure exceptions are caught and logged.

Test data and fixtures
- Use small StudentData fixtures stored under `test/fixtures/` (create if missing). Reuse existing user-story queries at [`test/conport_user_story_queries.json`](test/conport_user_story_queries.json:1) and [`docs/testing/user_story_queries.md`](docs/testing/user_story_queries.md:1) for integration scenarios.

Suggested mocking guidance
- Mock network and external model endpoints at a single boundary:
  - Replace `Ollama` instance methods (`generate`, `embeddings`, `list`) with test doubles.
  - Stub `ChromaClient` methods (`createCollection`, `query`, `deleteCollection`, `add`) so tests don't require a running Chroma server.
  - Use fake timers (Jest) for backoff/delay tests in `CanvasClient.executeWithRetry`.
  - For RAM cache, inject smaller configurations or stub heavy allocation functions (`initializeMemory`) to avoid large ArrayBuffer allocations.

Observed anti-patterns & refactor suggestions to improve testability
- Heavy use of console.log for control flow and debugging scattered across modules — consider using a centralized logger (winston already present) and inject a test logger.
- Direct construction of network clients inside classes (e.g., `new Ollama(...)`, `new ChromaClient(...)`, `axios.create(...)`) reduces ability to inject mocks. Suggest constructor injection of dependencies or factory functions.
- Large-memory allocation in constructor (`RamVectorCache.initializeMemory`) runs on object creation — move heavy allocation to explicit `initialize()` so unit tests can construct object without allocating.
- Background tasks started in constructor/initialize (warmup, addToFallbackInBackground) complicate deterministic tests — expose a flag to disable background tasks or make warmup explicit.

Blockers for integration tests
- Real Canvas credentials: environment variables `CANVAS_BASE_URL` and `CANVAS_ACCESS_TOKEN` required — if integration tests should run against a live Canvas instance, provide these credentials securely.
- Local Ollama and Chroma services: tests that exercise embeddings/LLM require reachable endpoints at `http://localhost:11434` and `http://localhost:8000` or mocked equivalents.

Actionable next steps for test implementation
- Implement fixture data under `test/fixtures/studentData.sample.json`.
- Add Jest setup to replace `Ollama` and `ChromaClient` with Jest mocks in `test/setupTests.ts`.
- Implement the prioritized tests T1-T12 as unit tests first; add small integration tests that mock only model endpoints for fast CI.

Audit complete.