import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';
import { AuthProvider, useAuth } from './auth-provider';

const apiUrl = 'https://pretty-woman-backend-production.up.railway.app';
const session = {
  accessToken: 'access-token',
  expiresAtUtc: '2026-08-24T18:00:00Z',
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function renderLogin() {
  return render(
    <AuthProvider autoInitialize={false}>
      <LoginPage />
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  function AuthStateProbe() {
    const { status } = useAuth();
    return <span>{status}</span>;
  }

  it('no intenta restaurar la sesión si falta la URL de la API', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('anonymous')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('explica los campos obligatorios sin enviar una solicitud vacía', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByText('Ingresa tu usuario.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('permite mostrar y ocultar la contraseña', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Contraseña');
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });

    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAccessibleName('Ocultar contraseña');

    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'password');
  });

  it('envía usuario y contraseña al endpoint de Railway y mantiene la sesión fuera del almacenamiento local', async () => {
    vi.stubEnv('VITE_API_BASE_URL', apiUrl);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    window.localStorage.clear();
    window.sessionStorage.clear();

    renderLogin();
    await user.type(screen.getByLabelText('Usuario'), 'maria.vendedora');
    await user.type(screen.getByLabelText('Contraseña'), 'contraseña');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByText('Acceso correcto. Estamos preparando tu espacio de trabajo.')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: 'maria.vendedora', password: 'contraseña' }),
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('muestra el detalle de credenciales inválidas entregado por la API', async () => {
    vi.stubEnv('VITE_API_BASE_URL', apiUrl);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: 'No autorizado', detail: 'Usuario o contraseña incorrectos.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByLabelText('Usuario'), 'maria.vendedora');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
  });
});
