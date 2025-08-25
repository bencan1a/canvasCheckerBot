import { QueryEngine } from '../../src/rag/query-engine.js';
import { StudentData } from '../../src/types.js';

// Mock external dependencies
jest.mock('ollama');
jest.mock('../../src/rag/persistent-vector-store.js');

describe('Minimal Query Flow Smoke Tests', () => {
  let queryEngine: QueryEngine;

  // Minimal test data inline (since fixtures are restricted)
  const mockStudentData: StudentData = {
    courses: [
      {
        id: 101,
        name: 'Introduction to Computer Science',
        course_code: 'CS101',
        enrollment_term_id: 1,
        start_at: '2024-01-15T00:00:00Z',
        end_at: '2024-05-15T00:00:00Z',
        workflow_state: 'available'
      }
    ],
    assignments: [
      {
        id: 201,
        course_id: 101,
        name: 'Homework 1',
        description: 'Basic programming assignment',
        due_at: '2024-02-15T23:59:00Z',
        points_possible: 100,
        submission_types: ['online_upload'],
        workflow_state: 'published'
      }
    ],
    submissions: [
      {
        id: 301,
        assignment_id: 201,
        user_id: 12345,
        submission_type: 'online_upload',
        workflow_state: 'submitted',
        grade: '85',
        graded_at: '2024-02-16T10:00:00Z',
        submitted_at: '2024-02-15T22:00:00Z'
      }
    ],
    quizzes: [],
    discussions: [],
    lastUpdated: '2024-01-01T12:00:00Z'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock the Ollama class
    const MockOllama = jest.fn().mockImplementation(() => ({
      generate: jest.fn().mockResolvedValue({
        response: 'This is a mock response from the LLM.'
      }),
      list: jest.fn().mockResolvedValue({
        models: [
          { name: 'llama3.2:latest', size: 1000000 },
          { name: 'nomic-embed-text:latest', size: 500000 }
        ]
      })
    }));

    // Mock the PersistentVectorStore class
    const MockVectorStore = jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([
        {
          document: 'Introduction to Computer Science course information',
          metadata: { type: 'course' },
          score: 0.8
        },
        {
          document: 'Homework 1 assignment details',
          metadata: { type: 'assignment' },
          score: 0.7
        }
      ]),
      searchWithFilters: jest.fn().mockResolvedValue([]),
      addDocuments: jest.fn().mockResolvedValue(undefined)
    }));

    // Apply mocks
    (require('ollama') as any).Ollama = MockOllama;
    (require('../../src/rag/persistent-vector-store.js') as any).PersistentVectorStore = MockVectorStore;

    // Create fresh QueryEngine instance
    queryEngine = new QueryEngine('llama3.2:latest', 'nomic-embed-text:latest');
  });

  afterEach(() => {
    // Clean up
    jest.restoreAllMocks();
  });

  test('query engine initializes successfully', async () => {
    expect(queryEngine).toBeDefined();
    expect(queryEngine).toBeInstanceOf(QueryEngine);
  });

  test('query engine can be initialized with student data', async () => {
    await expect(queryEngine.initialize(mockStudentData)).resolves.toBeUndefined();
  });

  test('query engine returns valid response structure', async () => {
    // Initialize the engine first
    await queryEngine.initialize(mockStudentData);

    // Perform a query
    const result = await queryEngine.query('What assignments do I have?');

    // Verify response structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('sources');
    expect(result).toHaveProperty('confidence');

    expect(typeof result.answer).toBe('string');
    expect(result.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(result.sources)).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('query engine handles different query types', async () => {
    await queryEngine.initialize(mockStudentData);

    const queries = [
      'What assignments do I have?',
      'What courses am I taking?',
      'How am I doing in my classes?'
    ];

    for (const query of queries) {
      const result = await queryEngine.query(query);

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  test('query engine returns sources with expected structure', async () => {
    await queryEngine.initialize(mockStudentData);

    const result = await queryEngine.query('Tell me about my assignments');

    expect(result.sources).toBeDefined();
    expect(result.sources.length).toBeGreaterThan(0);

    // Check structure of first source
    const firstSource = result.sources[0];
    expect(firstSource).toHaveProperty('document');
    expect(firstSource).toHaveProperty('metadata');
    expect(firstSource).toHaveProperty('score');

    expect(typeof firstSource.document).toBe('string');
    expect(typeof firstSource.score).toBe('number');
    expect(firstSource.score).toBeGreaterThanOrEqual(0);
    expect(firstSource.score).toBeLessThanOrEqual(1);
  });

  test('query engine handles empty or minimal data', async () => {
    const minimalData: StudentData = {
      courses: [],
      assignments: [],
      submissions: [],
      quizzes: [],
      discussions: [],
      lastUpdated: '2024-01-01T12:00:00Z'
    };

    await queryEngine.initialize(minimalData);

    const result = await queryEngine.query('What do I have to do?');

    expect(result).toBeDefined();
    expect(result.answer).toBeDefined();
    expect(Array.isArray(result.sources)).toBe(true);
    expect(typeof result.confidence).toBe('number');
  });

  test('getModels method works correctly', async () => {
    const models = await queryEngine.getModels();

    expect(models).toBeDefined();
    expect(models).toHaveProperty('llm');
    expect(models).toHaveProperty('embedding');

    expect(Array.isArray(models.llm)).toBe(true);
    expect(Array.isArray(models.embedding)).toBe(true);
  });
});