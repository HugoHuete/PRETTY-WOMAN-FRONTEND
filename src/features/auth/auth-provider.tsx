import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AuthSessionManager,
  type AuthSession,
  type AuthState,
} from './auth-session';

type AuthContextValue = AuthState & {
  signIn(username: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  request(path: string, init?: RequestInit): Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  autoInitialize?: boolean;
}>;

/**
 * Expone la sesión al resto de la SPA. El manager se crea una vez por pestaña
 * y conserva los tokens únicamente en memoria.
 * autoInitialize controla si el AuthProvider intenta recuperar la sesión automáticamente al montarse.
 */
export function AuthProvider({
  autoInitialize = true,
  children,
}: AuthProviderProps) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const shouldInitialize = autoInitialize && apiBaseUrl.length > 0;
  const manager = useMemo(
    () =>
      /**
       * Cada pestaña tiene su propio accessToken. En navegadores modernos,
       * el manager coordina los refresh con BroadcastChannel y Web Locks.
       */
      new AuthSessionManager({
        apiBaseUrl,
        onSessionEnded: () => {
          if (window.location.pathname !== '/login') {
            window.location.assign('/login');
          }
        },
      }),
    [apiBaseUrl],
  );
  const [state, setState] = useState<AuthState>(() =>
    shouldInitialize ? { status: 'loading', session: null } : manager.getState(),
  );

  useEffect(() => {
    let mounted = true;
    const unsubscribe = manager.subscribe(setState);
    if (shouldInitialize) {
      void manager.initialize().catch(() => {
        if (mounted) setState(manager.getState());
      });
    }

    return () => {
      unsubscribe();
      mounted = false;
      manager.dispose();
    };
  }, [manager, shouldInitialize]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: (username, password) => manager.signIn(username, password),
      signOut: () => manager.signOut(),
      request: (path, init) => manager.request(path, init),
    }),
    [manager, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return context;
}
