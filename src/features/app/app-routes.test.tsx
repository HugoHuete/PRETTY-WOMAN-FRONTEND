import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';

const auth = vi.hoisted(() => ({
  state: {
    status: 'anonymous' as 'anonymous' | 'authenticated' | 'loading',
    session: null as null | {
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
    },
  },
}));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({
    ...auth.state,
    signIn: vi.fn(),
    signOut: vi.fn(),
    request: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function employeeSession() {
  return {
    accessToken: 'token',
    expiresAtUtc: '2099-01-01T00:00:00Z',
    csrfToken: null,
    user: {
      id: 'user-1',
      username: 'maria',
      email: 'maria@example.com',
      name: 'María',
      lastname: 'Pérez',
      enabled: true,
      roles: ['Employee'],
    },
  };
}

function renderAppAt(path: string, status: 'anonymous' | 'authenticated', roles: string[] = []) {
  window.history.replaceState({}, '', path);
  auth.state.status = status;
  auth.state.session = status === 'authenticated' ? { ...employeeSession(), user: { ...employeeSession().user, roles } } : null;
  return render(<App />);
}

afterEach(() => {
  auth.state.status = 'anonymous';
  auth.state.session = null;
  window.history.replaceState({}, '', '/');
});

describe('protected application routes', () => {
  it('keeps login outside the application shell', () => {
    renderAppAt('/login', 'anonymous');

    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: 'Navegación principal' }),
    ).not.toBeInTheDocument();
  });

  it('renders dashboard content inside protected shell', () => {
    renderAppAt('/', 'authenticated', ['Admin']);

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeVisible();
    expect(within(screen.getByRole('main')).queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument();
  });

  it('renders the permission state for an unauthorized route', () => {
    renderAppAt('/users', 'authenticated', ['Employee']);

    expect(
      screen.getByText('No tienes permiso para ver esta sección.'),
    ).toBeVisible();
  });

  it('renders campaigns at the documented route for Admin', () => {
    renderAppAt('/discounts/campaigns', 'authenticated', ['Admin']);

    expect(
      screen.getByText('Esta sección estará disponible pronto'),
    ).toBeVisible();
  });

  it('redirects the legacy campaigns route to the documented route', () => {
    renderAppAt('/campaigns', 'authenticated', ['Admin']);

    expect(window.location.pathname).toBe('/discounts/campaigns');
    expect(
      screen.getByText('Esta sección estará disponible pronto'),
    ).toBeVisible();
  });
});
