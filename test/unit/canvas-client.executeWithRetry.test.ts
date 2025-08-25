import { CanvasClient } from '../../src/canvas-client';
import { CanvasConfig, AuthenticationError, PermissionError, ValidationError, NotFoundError, ServerError } from '../../src/types';
import axios, { AxiosResponse } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

// Mock console methods to reduce noise
const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('CanvasClient.executeWithRetry', () => {
  let client: CanvasClient;
  let mockConfig: CanvasConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      baseUrl: 'https://canvas.test.edu/api/v1',
      accessToken: 'test-token',
    };

    client = new CanvasClient(mockConfig);

    // Mock axios.create to return a mock client
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.skip('should retry up to configured retries on 5xx and eventually succeed', async () => {
    const mockRequestFn = jest.fn();

    // First two calls fail with 500 error, third succeeds
    mockRequestFn
      .mockRejectedValueOnce({ response: { status: 500, data: { errors: [{ message: 'Server error' }] }, headers: {} } })
      .mockRejectedValueOnce({ response: { status: 502, data: { errors: [{ message: 'Server error' }] }, headers: {} } })
      .mockResolvedValueOnce({ data: 'success' } as AxiosResponse);

    const result = await (client as any).executeWithRetry(mockRequestFn);

    expect(result).toBe('success');
    expect(mockRequestFn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 4xx errors', async () => {
    const mockRequestFn = jest.fn();

    // Mock a 400 error (ValidationError)
    mockRequestFn.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { errors: [{ message: 'Bad request' }] },
        headers: {}
      }
    });

    await expect((client as any).executeWithRetry(mockRequestFn)).rejects.toThrow(ValidationError);

    expect(mockRequestFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on authentication errors', async () => {
    const mockRequestFn = jest.fn();

    // Mock a 401 error (AuthenticationError)
    mockRequestFn.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { errors: [{ message: 'Unauthorized' }] },
        headers: {}
      }
    });

    await expect((client as any).executeWithRetry(mockRequestFn)).rejects.toThrow(AuthenticationError);

    expect(mockRequestFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on permission errors', async () => {
    const mockRequestFn = jest.fn();

    // Mock a 403 error (PermissionError)
    mockRequestFn.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { errors: [{ message: 'Forbidden' }] },
        headers: {}
      }
    });

    await expect((client as any).executeWithRetry(mockRequestFn)).rejects.toThrow(PermissionError);

    expect(mockRequestFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on not found errors', async () => {
    const mockRequestFn = jest.fn();

    // Mock a 404 error (NotFoundError)
    mockRequestFn.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { errors: [{ message: 'Not found' }] },
        headers: {}
      }
    });

    await expect((client as any).executeWithRetry(mockRequestFn)).rejects.toThrow(NotFoundError);

    expect(mockRequestFn).toHaveBeenCalledTimes(1);
  });

  it.skip('should surface the original error after exhausting retries', async () => {
    const mockRequestFn = jest.fn();

    // Mock consistent 500 errors that exceed retry limit
    const serverError = { response: { status: 500, data: { errors: [{ message: 'Persistent server error' }] }, headers: {} } };
    mockRequestFn
      .mockRejectedValue(serverError)
      .mockRejectedValue(serverError)
      .mockRejectedValue(serverError); // 3 attempts (default maxRetries)

    await expect((client as any).executeWithRetry(mockRequestFn)).rejects.toThrow(ServerError);

    expect(mockRequestFn).toHaveBeenCalledTimes(3);
  });

  it.skip('should use exponential backoff delay between retries', async () => {
    const mockRequestFn = jest.fn();

    // First call fails with 500, second succeeds
    mockRequestFn
      .mockRejectedValueOnce({ response: { status: 500, data: { errors: [{ message: 'Server error' }] }, headers: {} } })
      .mockResolvedValueOnce({ data: 'success' } as AxiosResponse);

    const retryPromise = (client as any).executeWithRetry(mockRequestFn);

    // Fast-forward past the delay (baseDelay * 2^1 = 2000ms for second attempt)
    jest.advanceTimersByTime(2000);

    const result = await retryPromise;

    expect(result).toBe('success');
    expect(mockRequestFn).toHaveBeenCalledTimes(2);
  });

  it.skip('should call retry callback if provided', async () => {
    const mockRequestFn = jest.fn();
    const onRetry = jest.fn();

    // First call fails with 500, second succeeds
    mockRequestFn
      .mockRejectedValueOnce({ response: { status: 500, data: { errors: [{ message: 'Server error' }] }, headers: {} } })
      .mockResolvedValueOnce({ data: 'success' } as AxiosResponse);

    const options = { errorRecovery: { onRetry } };

    const retryPromise = (client as any).executeWithRetry(mockRequestFn, options);

    // Fast-forward past the delay
    jest.advanceTimersByTime(2000);

    await retryPromise;

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(ServerError), 2000);
  });
});