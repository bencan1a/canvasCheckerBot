import fs from 'fs';
import path from 'path';
import { CanvasService } from '../../src/canvas-service.js';

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'sample-student-data.json');

class MockCanvasClientSuccess {
  constructor(private fixture: any) {}

  async getCourses() {
    // Ensure returned courses include a workflow_state of 'available' so service treats them as active.
    return this.fixture.courses.map((c: any) => ({ ...c, workflow_state: c.workflow_state ?? 'available' }));
  }

  async getAllAssignments(courseIds: number[]) {
    // Return all assignments (fixture is small), ensure published flag present so QueryEngine treats them as visible
    return this.fixture.assignments.map((a: any) => ({ ...a, published: a.published ?? true }));
  }

  async getAllSubmissions(assignments: any[]) {
    return this.fixture.submissions;
  }

  async getEnrollments() {
    return [];
  }

  async getAllQuizzes(courseIds: number[]) {
    return [];
  }

  async getAllDiscussions(courseIds: number[]) {
    return [];
  }

  async getAnnouncements(courseIds: number[]) {
    return [];
  }

  async getAllGradebook(courseIds: number[]) {
    return [];
  }

  async getCurrentUser() {
    return { id: 1, name: 'Test User', login_id: 'test@example.com' };
  }
}

class MockCanvasClientAuthError {
  async getCourses() {
    const err: any = new Error('Authentication failed');
    err.response = { status: 401, data: { errors: [{ message: 'Unauthorized' }] }, headers: {} };
    throw err;
  }
}

describe('Canvas integration (mocked CanvasClient)', () => {
  const cacheDir = path.join(__dirname, '..', 'tmp-canvas-cache');

  beforeAll(() => {
    // Ensure clean cache dir
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  afterAll(() => {
    // Cleanup cache dir after tests
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  test('syncAllData with mocked successful CanvasClient returns expected student data and allows queries', async () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
    const mockClient = new MockCanvasClientSuccess(fixture);

    const config = {
      baseUrl: 'http://mock.canvas',
      accessToken: 'MOCK_TOKEN',
      studentId: 'student-1'
    };

    const service = new CanvasService(config, cacheDir, mockClient as any);

    const data = await service.syncAllData(true);

    expect(data).toBeDefined();
    expect(Array.isArray(data.courses)).toBe(true);
    expect(data.courses.length).toBe(fixture.courses.length);
    expect(Array.isArray(data.assignments)).toBe(true);
    expect(data.assignments.length).toBe(fixture.assignments.length);
    expect(Array.isArray(data.submissions)).toBe(true);
    expect(data.submissions.length).toBe(fixture.submissions.length);

    // Query via CanvasService.queryData (uses internal CanvasQueryEngine)
    const result = await service.queryData('When is my HTTP lab assignment due?');
    expect(typeof result).toBe('string');
    // The fixture contains "HTTP Lab" assignment name; ensure it's present in the query result
    expect(result.toLowerCase()).toContain('http lab');
  });

  test('syncAllData surfaces authentication errors from Canvas client', async () => {
    const mockClient = new MockCanvasClientAuthError();

    const config = {
      baseUrl: 'http://mock.canvas',
      accessToken: 'INVALID',
      studentId: 'student-1'
    };

    const service = new CanvasService(config, cacheDir, mockClient as any);

    await expect(service.syncAllData(true)).rejects.toThrow(/Authentication|Unauthorized|401/);
  });
});