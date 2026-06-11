import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, getToken, setToken } from './client';

function mockFetch(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  const res = {
    ok: rest.ok ?? true,
    status: rest.status ?? 200,
    headers: new Headers(
      rest.headers ?? { 'content-type': 'application/json' },
    ),
    json: async () => jsonBody,
    ...rest,
  } as unknown as Response;
  const fn = vi.fn<typeof fetch>(() => Promise.resolve(res));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('token storage', () => {
  afterEach(() => localStorage.clear());

  it('stores and reads the token', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
  });

  it('clears the token when set to null', () => {
    setToken('abc');
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('apiRequest', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('prefixes the base URL and returns parsed JSON', async () => {
    const fetchFn = mockFetch({ jsonBody: { hello: 'world' } });
    const result = await apiRequest<{ hello: string }>('/things');
    expect(result).toEqual({ hello: 'world' });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/things'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('attaches the Authorization header when a token exists', async () => {
    setToken('jwt-123');
    const fetchFn = mockFetch({ jsonBody: {} });
    await apiRequest('/secure');
    const headers = fetchFn.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-123');
  });

  it('omits the Authorization header when there is no token', async () => {
    const fetchFn = mockFetch({ jsonBody: {} });
    await apiRequest('/public');
    const headers = fetchFn.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('serializes the body and sets the content-type for writes', async () => {
    const fetchFn = mockFetch({ jsonBody: {} });
    await apiRequest('/things', { method: 'POST', body: { a: 1 } });
    const init = fetchFn.mock.calls[0][1]!;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('sends FormData as-is without a JSON content-type', async () => {
    const fetchFn = mockFetch({ jsonBody: {} });
    const form = new FormData();
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }));
    await apiRequest('/documents', { method: 'POST', body: form });
    const init = fetchFn.mock.calls[0][1]!;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204 responses', async () => {
    mockFetch({ status: 204, headers: new Headers() });
    const result = await apiRequest('/things/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws an ApiError with the server message on failure', async () => {
    mockFetch({
      ok: false,
      status: 409,
      jsonBody: { message: 'Email already exists' },
    });
    await expect(apiRequest('/auth/register', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 409, message: 'Email already exists' });
  });

  it('falls back to a generic message when the error body has none', async () => {
    mockFetch({ ok: false, status: 500, jsonBody: {} });
    await expect(apiRequest('/boom')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('500'),
    });
  });

  it('wraps network failures in an ApiError with status 0', async () => {
    const fn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fn);
    await expect(apiRequest('/things')).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest('/things')).rejects.toMatchObject({ status: 0 });
  });
});
