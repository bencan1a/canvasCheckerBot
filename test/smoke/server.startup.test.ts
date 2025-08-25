import { CanvasRAGServer } from '../../src/server.js';

describe('Server Startup Smoke Tests', () => {
  let server: CanvasRAGServer;

  beforeEach(() => {
    // Mock environment variables to avoid real service connections
    process.env.CANVAS_BASE_URL = 'http://test-canvas.example.com';
    process.env.CANVAS_ACCESS_TOKEN = 'test-token';
    process.env.STUDENT_ID = '12345';
    process.env.NODE_ENV = 'test';

    // Create server instance without starting it
    server = new CanvasRAGServer();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.CANVAS_BASE_URL;
    delete process.env.CANVAS_ACCESS_TOKEN;
    delete process.env.STUDENT_ID;
    delete process.env.NODE_ENV;
  });

  test('server instantiates successfully', () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(CanvasRAGServer);
  });

  test('server has Express app instance', () => {
    // Access the private app property through type assertion
    const app = (server as any).app;
    expect(app).toBeDefined();
    expect(app.listen).toBeDefined(); // Express app method
  });

  test('server has SocketIO instance', () => {
    // Access the private io property
    const io = (server as any).io;
    expect(io).toBeDefined();
    expect(io.on).toBeDefined(); // SocketIO method
  });

  test('server has required service dependencies', () => {
    // Access private properties to verify they're initialized
    const canvasService = (server as any).canvasService;
    const storage = (server as any).storage;

    expect(canvasService).toBeDefined();
    expect(storage).toBeDefined();
  });

  test('server setup methods exist', () => {
    // Verify that the setup methods exist (they're called in constructor)
    expect((server as any).setupMiddleware).toBeDefined();
    expect((server as any).setupRoutes).toBeDefined();
    expect((server as any).setupSocketHandlers).toBeDefined();
  });

  test('server start method exists', () => {
    expect(server.start).toBeDefined();
    expect(typeof server.start).toBe('function');
  });

  test('server stop method exists', () => {
    expect(server.stop).toBeDefined();
    expect(typeof server.stop).toBe('function');
  });
});