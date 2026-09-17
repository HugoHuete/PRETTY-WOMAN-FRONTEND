import { render, screen, waitFor, within } from '@testing-library/react';
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
    request: vi.fn(),
  },
}));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({
    ...auth.state,
    signIn: vi.fn(),
    signOut: vi.fn(),
    request: auth.state.request,
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
  auth.state.request.mockReset();
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

  it('shows the explicit heading for the purchase order creation placeholder', () => {
    renderAppAt('/purchases/orders/new', 'authenticated', ['Admin']);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Nueva orden de compra',
      }),
    ).toBeVisible();
  });

  it('renders the inventory issues list at the documented route', async () => {
    auth.state.request.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderAppAt('/inventory/issues', 'authenticated', ['Employee']);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Incidencias' }),
    ).toBeVisible();
    expect(screen.getByText('Aún no hay incidencias')).toBeVisible();
  });

  it('renders the inventory issue detail route', async () => {
    auth.state.request.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1042,
          productId: 7,
          productVariantId: 2,
          productName: 'Vestido satinado',
          productCode: 'VST-042',
          sizeId: 3,
          sizeName: 'M',
          variant: 'Negro',
          productInventoryIssueTypeId: 1,
          productInventoryIssueTypeName: 'Damaged',
          productInventoryIssueStatusId: 1,
          productInventoryIssueStatusName: 'Open',
          quantity: 1,
          issueDate: '2026-09-14T15:30:00Z',
          resolvedAt: null,
          comments: 'Costura lateral descosida.',
          createdAt: '2026-09-14T15:30:00Z',
          updatedAt: '2026-09-14T15:30:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderAppAt('/inventory/issues/1042', 'authenticated', ['Employee']);

    expect(await screen.findByText('Vestido satinado')).toBeVisible();
    expect(screen.getByText('Costura lateral descosida.')).toBeVisible();
    await waitFor(() => expect(auth.state.request).toHaveBeenCalledWith('/api/v1/product-inventory-issues/1042'));
  });
});
