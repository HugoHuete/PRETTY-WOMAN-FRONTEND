/**
 * Estado sensible de la sesión. Se conserva en memoria y nunca se persiste
 * en localStorage o sessionStorage.
 */
export type AuthSession = {
  accessToken: string;
  expiresAtUtc: string;
  csrfToken: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    lastname: string;
    enabled: boolean;
    roles: string[];
  };
};

type CsrfResponse = { csrfToken?: string };
/**
 * Mensajes internos para compartir estado entre pestañas sin persistir tokens.
 */
export type AuthMessage =
  | { type: 'request-session'; requestId: string }
  | { type: 'session-response'; requestId: string; session: AuthSession }
  | { type: 'session-updated'; session: AuthSession }
  | { type: 'session-ended' };

type Channel = {
  postMessage(message: AuthMessage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<AuthMessage>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<AuthMessage>) => void): void;
  close(): void;
};

type FetchFn = typeof fetch;
type LockRequest = <T>(name: string, callback: () => Promise<T>) => Promise<T>;

export type AuthSessionManagerOptions = {
  apiBaseUrl: string;
  fetchFn?: FetchFn;
  channelFactory?: (name: string) => Channel | null;
  lockRequest?: LockRequest;
  peerWaitMs?: number;
  now?: () => number;
  onSessionEnded?: () => void;
};

export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous';
  session: AuthSession | null;
};

export class AuthApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(
    status: number,
    detail = 'No se pudo completar la solicitud.',
  ) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = 'AuthApiError';
  }
}

const channelName = 'auth-session';
const refreshLockName = 'auth-refresh';
const expirySafetyWindowMs = 30_000;

function defaultChannelFactory(name: string): Channel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(name);
}

/**
 * En navegadores compatibles usa Web Locks para que dos pestañas no roten el
 * mismo refreshToken a la vez. En navegadores antiguos no existe un mutex
 * fiable entre pestañas: se permite el refresh normal y el backend responde
 * de forma idempotente a un duplicado inmediato de la misma rotación.
 */
function defaultLockRequest<T>(name: string, callback: () => Promise<T>) {
  const lockManager = (globalThis.navigator as Navigator & {
    locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> };
  }).locks;

  if (lockManager) return lockManager.request(name, callback);

  // No se guardan tokens ni datos de sesión en localStorage para simular un
  // bloqueo. Ese mecanismo sería más complejo y no aporta valor al soporte
  // residual de navegadores sin Web Locks.
  return callback();
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function isFresh(session: AuthSession, now: () => number) {
  const expiresAt = Date.parse(session.expiresAtUtc);
  return Number.isNaN(expiresAt) || expiresAt > now() + expirySafetyWindowMs;
}

/**
 * Coordina la sesión de una pestaña: descubre sesiones vecinas, renueva tokens
 * y agrega el accessToken a las peticiones protegidas.
 */
export class AuthSessionManager {
  private readonly apiBaseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly channelFactory: (name: string) => Channel | null;
  private channel: Channel | null;
  private readonly lockRequest: LockRequest;
  private readonly peerWaitMs: number;
  private readonly now: () => number;
  private readonly onSessionEnded?: () => void;
  private readonly listeners = new Set<(state: AuthState) => void>();
  private readonly pendingPeerRequests = new Map<
    string,
    (session: AuthSession | null) => void
  >();
  private readonly onMessage = (event: MessageEvent<AuthMessage>) => {
    const message = event.data;

    if (message.type === 'request-session') {
      if (this.session && isFresh(this.session, this.now)) {
        this.channel?.postMessage({
          type: 'session-response',
          requestId: message.requestId,
          session: this.session,
        });
      }
      return;
    }

    if (message.type === 'session-response') {
      this.pendingPeerRequests.get(message.requestId)?.(message.session);
      return;
    }

    if (message.type === 'session-updated') {
      // Esta sesión remota reemplaza a la generación anterior. Cualquier
      // refresh pendiente debe ignorar su resultado para no cerrar la sesión
      // nueva si su cookie rotada provoca un 401.
      this.sessionVersion += 1;
      this.adopt(message.session, false);
      for (const resolve of this.pendingPeerRequests.values()) resolve(message.session);
      this.pendingPeerRequests.clear();
      return;
    }

    // Un logout remoto invalida también las operaciones asíncronas que esta
    // pestaña todavía tenga en curso.
    this.sessionVersion += 1;
    this.clear(false);
  };
  private session: AuthSession | null = null;
  private state: AuthState = { status: 'anonymous', session: null };
  private initializePromise: Promise<AuthSession | null> | null = null;
  /**
   * Identifica la generación de autenticación vigente. Si cambia mientras una
   * restauración o refresh espera una respuesta, ese resultado ya no puede
   * modificar la sesión actual.
   */
  private sessionVersion = 0;
  private disposed = false;

  constructor(options: AuthSessionManagerOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.fetchFn =
      options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.channelFactory = options.channelFactory ?? defaultChannelFactory;
    this.channel = this.channelFactory(channelName);
    this.lockRequest = options.lockRequest ?? defaultLockRequest;
    this.peerWaitMs = options.peerWaitMs ?? 250;
    this.now = options.now ?? Date.now;
    this.onSessionEnded = options.onSessionEnded;
    this.channel?.addEventListener('message', this.onMessage);
  }

  getState() {
    return this.state;
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Recupera la sesión desde otra pestaña o desde la cookie de refresh.
   * La cookie HttpOnly nunca se lee desde JavaScript.
   */
  async initialize() {
    this.ensureActive();
    if (this.session && isFresh(this.session, this.now)) return this.session;
    if (this.initializePromise) return this.initializePromise;

    const version = this.sessionVersion;
    this.initializePromise = this.restoreFromCookieOrPeer(version);
    try {
      return await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  async signIn(username: string, password: string) {
    this.ensureActive();
    const version = ++this.sessionVersion;
    const response = await this.fetchJson<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (version !== this.sessionVersion) return response;
    this.adopt(response, true);
    return response;
  }

  async signOut() {
    this.ensureActive();
    const version = ++this.sessionVersion;
    try {
      if (this.session?.csrfToken) {
        await this.fetchJson<void>('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'X-CSRF-Token': this.session.csrfToken },
          credentials: 'include',
        });
      }
    } finally {
      if (version === this.sessionVersion) this.clear(true);
    }
  }

  async request(path: string, init: RequestInit = {}) {
    this.ensureActive();
    let current = this.session ?? (await this.initialize());
    if (!current) throw new AuthApiError(401, 'La sesión ya no es válida.');

    if (!isFresh(current, this.now)) {
      current = await this.refreshWithLock(this.sessionVersion);
      if (!current) throw new AuthApiError(401, 'La sesión ya no es válida.');
    }

    let response = await this.fetchWithSession(path, init, current);
    if (response.status !== 401) return response;

    // Un 401 prueba que el servidor rechazó este token. Otra pestaña podría
    // tener exactamente el mismo token, aunque todavía no haya expirado, por
    // lo que aquí se fuerza el refresh y no se reutiliza una respuesta peer.
    current = await this.refreshWithLock(this.sessionVersion, true);
    if (!current) throw new AuthApiError(401, 'La sesión ya no es válida.');

    response = await this.fetchWithSession(path, init, current);
    return response;
  }

  dispose() {
    if (this.disposed) return;
    this.channel?.removeEventListener('message', this.onMessage);
    this.channel?.close();
    this.channel = null;
    this.disposed = true;
    this.listeners.clear();
    this.pendingPeerRequests.clear();
  }

  private ensureActive() {
    if (!this.disposed) return;
    this.channel = this.channelFactory(channelName);
    this.channel?.addEventListener('message', this.onMessage);
    this.disposed = false;
  }

  /**
   * Flujo de arranque: primero consulta a otras pestañas y solo después pide
   * CSRF y entra al bloqueo para renovar una vez.
   */
  private async restoreFromCookieOrPeer(version: number) {
    const peerSession = await this.requestPeerSession();
    if (version !== this.sessionVersion) return this.session;
    if (peerSession) {
      this.adopt(peerSession, false);
      return peerSession;
    }

    const csrfToken = await this.getCsrfToken();
    if (version !== this.sessionVersion) return this.session;
    if (!csrfToken) {
      this.clear(false);
      return null;
    }

    return this.lockRequest(refreshLockName, async () => {
      if (version !== this.sessionVersion) return this.session;
      const sessionFromPeer = await this.requestPeerSession();
      if (version !== this.sessionVersion) return this.session;
      if (sessionFromPeer) {
        this.adopt(sessionFromPeer, false);
        return sessionFromPeer;
      }

      return this.refreshWithToken(csrfToken, version);
    });
  }

  /**
   * Renueva bajo el bloqueo y vuelve a consultar el canal dentro de este,
   * porque otra pestaña pudo haber renovado mientras esperábamos.
   */
  private async refreshWithLock(version: number, forceRefresh = false) {
    // forceRefresh se usa después de un 401 de autorización. En ese caso no
    // consultamos otra pestaña, porque podría devolver el mismo token que el
    // servidor acaba de rechazar.

    return this.lockRequest(refreshLockName, async () => {
      if (!forceRefresh) {
        if (version !== this.sessionVersion) return this.session;
        const sessionFromPeer = await this.requestPeerSession();
        if (sessionFromPeer) {
          this.adopt(sessionFromPeer, false);
          return sessionFromPeer;
        }
      }

      const csrfToken = this.session?.csrfToken ?? (await this.getCsrfToken());
      if (version !== this.sessionVersion) return this.session;
      if (!csrfToken) {
        this.clear(true);
        return null;
      }

      return this.refreshWithToken(csrfToken, version);
    });
  }

  private async refreshWithToken(csrfToken: string, version: number) {
    try {
      const session = await this.fetchJson<AuthSession>('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'include',
      });
      if (version !== this.sessionVersion) return this.session;
      this.adopt(session, true);
      return session;
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        if (version === this.sessionVersion) this.clear(true);
        return version === this.sessionVersion ? null : this.session;
      }
      throw error;
    }
  }

  private async getCsrfToken() {
    try {
      const response = await this.fetchJson<CsrfResponse>('/api/v1/auth/csrf', {
        method: 'GET',
        credentials: 'include',
      });
      return response.csrfToken ?? null;
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) return null;
      throw error;
    }
  }

  private async requestPeerSession() {
    if (!this.channel) return null;

    const requestId = createId();
    const peerSession = new Promise<AuthSession | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingPeerRequests.delete(requestId);
        resolve(null);
      }, this.peerWaitMs);

      this.pendingPeerRequests.set(requestId, (session) => {
        clearTimeout(timeout);
        this.pendingPeerRequests.delete(requestId);
        resolve(session);
      });
    });

    this.channel.postMessage({ type: 'request-session', requestId });
    return peerSession;
  }

  private async fetchJson<T>(path: string, init: RequestInit) {
    const response = await this.fetchFn(`${this.apiBaseUrl}${path}`, init);
    if (!response.ok) {
      let detail = 'No se pudo completar la solicitud.';
      try {
        const problem = (await response.json()) as { detail?: string; title?: string };
        detail = problem.detail ?? problem.title ?? detail;
      } catch {
        // La respuesta puede no tener un cuerpo JSON.
      }
      throw new AuthApiError(response.status, detail);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /**
   * Envía el bearer token actual sin exponerlo a almacenamiento persistente.
   */
  private fetchWithSession(path: string, init: RequestInit, session: AuthSession) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.accessToken}`);
    return this.fetchFn(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  }

  private adopt(session: AuthSession, broadcast: boolean) {
    this.session = session;
    this.setState({ status: 'authenticated', session });
    if (broadcast) this.channel?.postMessage({ type: 'session-updated', session });
  }

  private clear(broadcast: boolean) {
    const hadSession = this.session !== null;
    this.session = null;
    this.setState({ status: 'anonymous', session: null });
    if (broadcast) this.channel?.postMessage({ type: 'session-ended' });
    if (hadSession) this.onSessionEnded?.();
  }

  private setState(state: AuthState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
