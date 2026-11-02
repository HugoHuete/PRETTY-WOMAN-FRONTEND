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

  it('renders campaigns at the documented route for Admin', async () => {
    auth.state.request.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAppAt('/discounts/campaigns', 'authenticated', ['Admin']);

    expect(await screen.findByRole('heading', { name: 'Campañas' })).toBeVisible();
  });

  it('renders campaign details at the protected detail route', async () => {
    auth.state.request.mockImplementation((path: string) => {
      if (path === '/api/v1/discountcampaigns/12') {
        return Promise.resolve(new Response(JSON.stringify({
          id: 12,
          name: 'Verano rosa',
          startDate: '2026-09-20T00:00:00Z',
          endDate: '2026-09-30T23:59:59Z',
          statusId: 2,
          statusName: 'Activa',
          targets: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    renderAppAt('/discounts/campaigns/12', 'authenticated', ['Admin']);

    expect(await screen.findByRole('heading', { name: 'Verano rosa' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Editar campaña' })).toHaveAttribute('href', '/discounts/campaigns/12/edit');
  });

  it('redirects the legacy campaigns route to the documented route', async () => {
    auth.state.request.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAppAt('/campaigns', 'authenticated', ['Admin']);

    expect(window.location.pathname).toBe('/discounts/campaigns');
    expect(await screen.findByRole('heading', { name: 'Campañas' })).toBeVisible();
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

  it('renders financial movements for Admin', async () => {
    auth.state.request.mockImplementation((path: string) => {
      if (path === '/api/v1/finances/movement-types') {
        return Promise.resolve(new Response(JSON.stringify([{ id: 2, name: 'SupplierPayment' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    renderAppAt('/finances', 'authenticated', ['Admin']);

    expect(await screen.findByRole('heading', { name: 'Movimientos financieros' })).toBeVisible();
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/finances/movement-types');
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/finances/movements?page=1&pageSize=20');
  });

  it('renders shipment reconciliation for Admin and loads its agency list', async () => {
    auth.state.request.mockImplementation((path: string) => {
      const body = path === '/api/v1/exchange-rates/current'
        ? { bankRate: 36.5, storeRate: 36.5, startDate: '2026-11-01' }
        : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    renderAppAt('/shipments/reconciliation', 'authenticated', ['Admin']);

    expect(await screen.findByText('Mostraremos los envíos y las devoluciones que aún puedes incluir en su liquidación.')).toBeVisible();
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/deliveryagencies');
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/exchange-rates/current');
  });

  it('denies shipment reconciliation to employees without requesting reconciliation data', () => {
    renderAppAt('/shipments/reconciliation', 'authenticated', ['Employee']);

    expect(screen.getByText('No tienes permiso para ver esta sección.')).toBeVisible();
    expect(auth.state.request).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/deliveryagencyreconciliations'));
  });

  it('denies Finance access to non-Admins without requesting Finance data', () => {
    renderAppAt('/finances', 'authenticated', ['Employee']);

    expect(screen.getByText('No tienes permiso para ver esta sección.')).toBeVisible();
    expect(auth.state.request).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/finances/'));
  });

  it('renders the received loans list for Admin', async () => {
    auth.state.request.mockImplementation((path: string) => {
      const body = path === '/api/v1/loanowners' ? [] : { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    renderAppAt('/finances/loans', 'authenticated', ['Admin']);

    expect(await screen.findByRole('heading', { name: 'Préstamos recibidos' })).toBeVisible();
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/loans?page=1&pageSize=20&isActive=true');
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/loanowners');
  });

  it('renders a loan detail at the protected loan route', async () => {
    auth.state.request.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 12,
      loanDate: '2026-10-10T15:30:00Z',
      createdAt: '2026-10-10T15:30:00Z',
      loanOwnerId: 1,
      loanOwnerName: 'María López',
      initialAmount: 5000,
      initialAmountUsd: 125,
      balance: 5000,
      interestPaidAmount: 0,
      closedAt: null,
      comments: 'Capital de trabajo',
      exchangeRate: 40,
      isActive: true,
      payments: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderAppAt('/finances/loans/12', 'authenticated', ['Admin']);

    expect(await screen.findByText('Capital de trabajo')).toBeVisible();
    expect(auth.state.request).toHaveBeenCalledWith('/api/v1/loans/12');
  });

  it('denies loan access to non-Admins without requesting loan data', () => {
    renderAppAt('/finances/loans', 'authenticated', ['Employee']);

    expect(screen.getByText('No tienes permiso para ver esta sección.')).toBeVisible();
    expect(auth.state.request).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/loans'));
  });
});
