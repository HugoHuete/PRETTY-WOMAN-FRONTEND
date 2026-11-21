import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionManager, type AuthMessage, type AuthSession } from './auth-session';

class FakeChannel {
  private static channels = new Set<FakeChannel>();
  private listeners = new Set<(event: MessageEvent<AuthMessage>) => void>();

  constructor(_name: string) {
    FakeChannel.channels.add(this);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<AuthMessage>) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<AuthMessage>) => void) {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown) {
    for (const channel of FakeChannel.channels) {
      if (channel === this) continue;
      for (const listener of channel.listeners) listener({ data } as MessageEvent<AuthMessage>);
    }
  }

  close() {
    FakeChannel.channels.delete(this);
    this.listeners.clear();
  }

  static reset() {
    FakeChannel.channels.clear();
  }
}

const session: AuthSession = {
  accessToken: 'access-token',
  expiresAtUtc: '2099-08-24T18:00:00Z',
  csrfToken: 'csrf-token',
  user: {
    id: 'user-1',
    username: 'maria.vendedora',
    email: 'maria@prettywoman.com',
    name: 'María',
    lastname: 'Pérez',
    enabled: true,
    roles: ['Employee'],
  },
};

afterEach(() => {
  FakeChannel.reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AuthSessionManager', () => {
  it('comparte los catálogos concurrentes y los conserva hasta que vencen en 24 horas', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    let now = Date.parse('2026-11-20T12:00:00Z');
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/login')) return Response.json(session);
      return Response.json([{ id: 1, name: 'Municipio' }]);
    });
    const options = {
      apiBaseUrl: 'https://api.example.com',
      channelFactory: () => null,
      fetchFn,
      now: () => now,
    };
    const first = new AuthSessionManager(options);
    await first.signIn('maria.vendedora', 'contraseña');

    const path = '/api/v1/municipalities';
    const responses = await Promise.all([first.request(path), first.request(path)]);
    for (const response of responses) {
      expect(await response.json()).toEqual([{ id: 1, name: 'Municipio' }]);
    }
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await first.request(path);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const reopened = new AuthSessionManager(options);
    await reopened.signIn('maria.vendedora', 'contraseña');
    now += 24 * 60 * 60 * 1000 - 1;
    expect(await (await reopened.request(path)).json()).toEqual([{ id: 1, name: 'Municipio' }]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    now += 1;
    await reopened.request(path);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    await first.request(path);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    first.dispose();
    reopened.dispose();
  });

  it.each([
    { change: 'la cuenta', user: { ...session.user, id: 'user-2' }, shouldCache: false },
    { change: 'los roles', user: { ...session.user, roles: ['Admin'] }, shouldCache: false },
    { change: 'solo el token', user: session.user, shouldCache: true },
  ])('protege el catálogo compartido cuando cambia $change durante un reintento', async ({ user, shouldCache }) => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem });
    const refreshed = { ...session, user, accessToken: 'retry-token' };
    const items = [{ id: 1, name: 'Agencia' }];
    let rejectOriginal!: (response: Response) => void;
    const originalRequest = new Promise<Response>((resolve) => {
      rejectOriginal = resolve;
    });
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return Response.json(session);
      if (url.endsWith('/auth/refresh')) return Response.json(refreshed);
      const token = new Headers(init?.headers).get('Authorization');
      return token === 'Bearer retry-token' ? Response.json(items) : originalRequest;
    });
    const manager = new AuthSessionManager({
      apiBaseUrl: 'https://api.example.com',
      channelFactory: (name) => new FakeChannel(name),
      fetchFn,
    });
    const peer = new FakeChannel('auth-session');
    await manager.signIn('maria.vendedora', 'contraseña');

    const path = '/api/v1/deliveryagencies';
    const requests = [manager.request(path), manager.request(path)];
    const results = Promise.allSettled(requests);
    peer.postMessage({ type: 'session-updated', session: refreshed });
    rejectOriginal(new Response(null, { status: 401 }));

    for (const result of await results) {
      if (shouldCache) {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') expect(await result.value.json()).toEqual(items);
      } else {
        expect(result).toEqual({
          status: 'rejected',
          reason: new Error('La sesión cambió durante la consulta del catálogo. Vuelve a intentarlo.'),
        });
      }
    }
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(setItem).toHaveBeenCalledTimes(shouldCache ? 1 : 0);

    expect(await (await manager.request(path)).json()).toEqual(items);
    expect(fetchFn).toHaveBeenCalledTimes(shouldCache ? 4 : 5);
    manager.dispose();
    peer.close();
  });

  it('invoca el fetch nativo con el contexto global', async () => {
    const nativeFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(JSON.stringify(session), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', nativeFetch);
    const manager = new AuthSessionManager({
      apiBaseUrl: 'https://api.example.com',
      channelFactory: () => null,
    });

    await expect(manager.signIn('maria.vendedora', 'contraseña')).resolves.toEqual(session);

    manager.dispose();
  });

  it('invalida un refresh en curso cuando otra pestaña publica una sesión nueva', async () => {
    let loginCalls = 0;
    let refreshCalls = 0;
    let protectedCalls = 0;
    let resolveRefresh!: (response: Response) => void;
    const refreshedSession = { ...session, accessToken: 'new-peer-token' };
    const refreshRequest = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        loginCalls += 1;
        const loginSession = loginCalls === 1 ? session : refreshedSession;
        return Promise.resolve(new Response(JSON.stringify(loginSession), { status: 200 }));
      }
      if (url.endsWith('/api/v1/protected')) {
        protectedCalls += 1;
        if (protectedCalls === 1) return Promise.resolve(new Response(null, { status: 401 }));
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return refreshRequest;
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });
    const options = {
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: (name: string) => new FakeChannel(name),
      peerWaitMs: 5,
    };
    const firstTab = new AuthSessionManager(options);
    const secondTab = new AuthSessionManager(options);

    await firstTab.signIn('maria.vendedora', 'contraseña');

    const request = firstTab.request('/api/v1/protected');
    await vi.waitFor(() => expect(refreshCalls).toBe(1));

    await secondTab.signIn('maria.vendedora', 'contraseña');
    resolveRefresh(new Response(null, { status: 401 }));

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(firstTab.getState()).toEqual({
      status: 'authenticated',
      session: refreshedSession,
    });
    expect(secondTab.getState()).toEqual({
      status: 'authenticated',
      session: refreshedSession,
    });

    firstTab.dispose();
    secondTab.dispose();
  });


  it('fuerza el refresh cuando el servidor rechaza el accessToken actual', async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    const refreshedSession = { ...session, accessToken: 'refreshed-access-token' };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return Promise.resolve(new Response(JSON.stringify(session), { status: 200 }));
      }
      if (url.endsWith('/api/v1/protected')) {
        protectedCalls += 1;
        if (refreshCalls === 0) return Promise.resolve(new Response(null, { status: 401 }));
        return Promise.resolve(new Response('{}', { status: 200 }));
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(new Response(JSON.stringify(refreshedSession), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });
    const options = {
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: (name: string) => new FakeChannel(name),
      peerWaitMs: 5,
    };
    const firstTab = new AuthSessionManager(options);
    const secondTab = new AuthSessionManager(options);

    await firstTab.signIn('maria.vendedora', 'contraseña');
    await secondTab.signIn('maria.vendedora', 'contraseña');

    const response = await firstTab.request('/api/v1/protected');

    expect(response.status).toBe(200);
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);

    firstTab.dispose();
    secondTab.dispose();
  });

  it('invalida restauraciones en curso cuando otra pestaña cierra sesión', async () => {
    let resolveCsrf!: (response: Response) => void;
    let refreshCalls = 0;
    const csrfRequest = new Promise<Response>((resolve) => {
      resolveCsrf = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/csrf')) return csrfRequest;
      if (url.endsWith('/api/v1/auth/login')) {
        return Promise.resolve(new Response(JSON.stringify(session), { status: 200 }));
      }
      if (url.endsWith('/api/v1/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(new Response(JSON.stringify(session), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });
    const options = {
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: (name: string) => new FakeChannel(name),
      peerWaitMs: 1,
    };
    const firstTab = new AuthSessionManager(options);
    const secondTab = new AuthSessionManager(options);

    const initialization = firstTab.initialize();
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/auth/csrf',
        expect.anything(),
      ),
    );

    await secondTab.signIn('maria.vendedora', 'contraseña');
    await secondTab.signOut();
    resolveCsrf(new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 }));

    await expect(initialization).resolves.toBeNull();
    expect(firstTab.getState()).toEqual({
      status: 'anonymous',
      session: null,
    });
    expect(refreshCalls).toBe(0);

    firstTab.dispose();
    secondTab.dispose();
  });


  it('puede inicializarse de nuevo después de ser limpiado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    const manager = new AuthSessionManager({
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: (name: string) => new FakeChannel(name),
      peerWaitMs: 1,
    });

    manager.dispose();

    await expect(manager.initialize()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/csrf',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('no permite que una restauración anterior borre un login nuevo', async () => {
    let resolveCsrf!: (response: Response) => void;
    const csrfRequest = new Promise<Response>((resolve) => {
      resolveCsrf = resolve;
    });
    const loggedInSession = { ...session, accessToken: 'new-login-token' };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/csrf')) return csrfRequest;
      if (url.endsWith('/api/v1/auth/login')) {
        return Promise.resolve(new Response(JSON.stringify(loggedInSession), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });
    const manager = new AuthSessionManager({
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: () => null,
    });

    const initialization = manager.initialize();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await manager.signIn('maria.vendedora', 'contraseña');
    resolveCsrf(new Response(null, { status: 401 }));
    await initialization;

    expect(manager.getState()).toEqual({
      status: 'authenticated',
      session: loggedInSession,
    });
  });
  it('coordina dos pestañas para renovar una sola vez', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/csrf')) {
        return Promise.resolve(new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 }));
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(new Response(JSON.stringify(session), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });

    let lockTail = Promise.resolve();
    const lockRequest = async <T>(_name: string, callback: () => Promise<T>) => {
      const previous = lockTail;
      let release!: () => void;
      lockTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback();
      } finally {
        release();
      }
    };

    const options = {
      apiBaseUrl: 'https://api.example.com',
      fetchFn: fetchMock,
      channelFactory: (name: string) => new FakeChannel(name),
      lockRequest,
      peerWaitMs: 5,
    };
    const firstTab = new AuthSessionManager(options);
    const secondTab = new AuthSessionManager(options);

    const [firstSession, secondSession] = await Promise.all([
      firstTab.initialize(),
      secondTab.initialize(),
    ]);

    expect(firstSession?.accessToken).toBe(session.accessToken);
    expect(secondSession?.accessToken).toBe(session.accessToken);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': 'csrf-token' },
      }),
    );

    firstTab.dispose();
    secondTab.dispose();
  });
});
