import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '../../shared/layout/app-shell';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type {
  OrderDTO,
  OrderProductDTO,
  OrderProductVariantDTO,
  OrderTrackingNumberDTO,
  PaginatedResult,
  PurchaseShortageDTO,
  SupplierDTO,
  SupplierRefundDTO,
} from './purchase-order-types';
import {
  buildOrdersPath,
  formatCordobas,
  orderStatusLabel,
  orderStatusTone,
} from './purchase-order-types';
import { PurchaseOrdersPage } from './purchase-orders-page';

const auth = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ request: auth.request }),
}));

const supplierFixture = {
  id: 7,
  name: 'SOHO',
  enabled: true,
  url: null,
  isNational: true,
} satisfies SupplierDTO;

const disabledSupplierFixture = {
  id: 8,
  name: 'CERRADO',
  enabled: false,
  url: null,
  isNational: false,
} satisfies SupplierDTO;

const trackingFixture = {
  id: 22,
  orderId: 48,
  shippingCompanyId: 2,
  trackingNumber: 'SOHO-782190',
  supplierShipmentDate: null,
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 1.25,
  shippingCost: 350,
  shippingCompanyName: 'Cargo Express',
} satisfies OrderTrackingNumberDTO;

const variantFixture = {
  id: 301,
  sizeId: 12,
  sizeName: null,
  variant: 'Azul',
  quantity: 3,
  receivedQuantity: 1,
  availableQuantity: 1,
  reservedQuantity: 1,
  unitCostUsd: 8.5,
  merchandiseTotalCostNio: 935.05,
  allocatedShippingCostNio: 75,
  totalCostNio: 1010.05,
  unitCostNio: 310.02,
  salePrice: 1250,
} satisfies OrderProductVariantDTO;

const productFixture = {
  id: 1001,
  supplierProductCode: 'SOHO25120',
  code: 25120,
  name: 'Vestido satinado',
  subcategoryId: 4,
  subcategoryName: null,
  variants: [variantFixture],
} satisfies OrderProductDTO;

const shortageFixture = {
  id: 1,
  productId: 1001,
  quantity: 2,
  lossAmountNio: 250,
  shortageDate: '2026-07-15',
  refundStatus: 1,
} satisfies PurchaseShortageDTO;

const refundFixture = {
  id: 9,
  financialMovementId: 77,
  amountNio: 250,
  refundedAt: '2026-07-20',
  reference: null,
  comments: null,
} satisfies SupplierRefundDTO;

const orderFixture = {
  id: 48,
  createdAt: '2026-07-15T14:20:00Z',
  purchaseDate: '2026-07-12',
  orderStatusId: 2,
  orderStatusName: null,
  supplierId: 7,
  supplierName: null,
  purchaseCurrencyId: 2,
  purchaseCurrencyName: null,
  amountUsd: 153,
  receivedAmountNio: 5600,
  comments: 'Separar las blusas blancas y negras en bolsas individuales antes de enviarlas a bodega.',
  merchandiseTotalNio: 5600,
  supplierShippingCostUsd: 15,
  warehouseShippingCostUsd: 0,
  totalCostNio: 6150,
  exchangeRate: 36.62,
  products: [productFixture],
  purchaseShortages: [shortageFixture],
  supplierRefund: refundFixture,
  totalShortageLossNio: 250,
  totalSupplierRefundNio: 250,
  netShortageLossNio: 0,
  supplierRefundDeclinedAt: null,
  supplierRefundDeclineComments: null,
} satisfies OrderDTO;

describe('purchase order helpers', () => {
  it('mirrors the backend-shaped purchases contracts', () => {
    expectTypeOf(supplierFixture).toMatchTypeOf<SupplierDTO>();
    expectTypeOf(trackingFixture).toMatchTypeOf<OrderTrackingNumberDTO>();
    expectTypeOf(variantFixture).toMatchTypeOf<OrderProductVariantDTO>();
    expectTypeOf(productFixture).toMatchTypeOf<OrderProductDTO>();
    expectTypeOf(shortageFixture).toMatchTypeOf<PurchaseShortageDTO>();
    expectTypeOf(refundFixture).toMatchTypeOf<SupplierRefundDTO>();
    expectTypeOf(orderFixture).toMatchTypeOf<OrderDTO>();
    expect(orderFixture.products[0].variants[0].salePrice).toBe(1250);
  });

  it('serializes only active order filters', () => {
    expect(
      buildOrdersPath({
        page: 2,
        pageSize: 20,
        purchaseDateFrom: '2026-07-01',
        purchaseDateTo: '',
        orderStatusId: '2',
        supplierId: '',
      }),
    ).toBe(
      '/api/v1/orders?page=2&pageSize=20&purchaseDateFrom=2026-07-01&orderStatusId=2',
    );
  });

  it('uses a neutral tone for a status code introduced by the API', () => {
    expect(orderStatusTone(99)).toBe('neutral');
  });

  it('translates known order statuses for display while preserving unknown names', () => {
    expect(orderStatusLabel(1, 'Pending')).toBe('Pendiente');
    expect(orderStatusLabel(2, 'PartiallyReceived')).toBe('Recepción parcial');
    expect(orderStatusLabel(3, 'Received')).toBe('Recibida');
    expect(orderStatusLabel(4, 'Cancelled')).toBe('Cancelada');
    expect(orderStatusLabel(5, 'PendingRefund')).toBe('Reembolso pendiente');
    expect(orderStatusLabel(99, 'New status')).toBe('New status');
  });

  it('formats córdobas with the backend locale and currency', () => {
    expect(formatCordobas(4123.45)).toBe('C$4,123.45');
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function orderPage(overrides: Partial<PaginatedResult<OrderDTO>> = {}) {
  return {
    items: [orderFixture],
    page: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides,
  } satisfies PaginatedResult<OrderDTO>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderOrders(path = '/purchases/orders') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/purchases/orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchases/orders/new" element={<p>Próxima etapa</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  auth.request.mockReset();
});

describe('PurchaseOrdersPage', () => {
  describe.each([
    { path: '/api/v1/suppliers', otherPath: '/api/v1/orders/statuses', section: 'Opciones de proveedores', control: 'Proveedor', option: 'SOHO', data: [supplierFixture], filter: 'supplierId=7' },
    { path: '/api/v1/orders/statuses', otherPath: '/api/v1/suppliers', section: 'Opciones de estados', control: 'Estado', option: 'Recepción parcial', data: [{ id: 2, name: 'Recepción parcial' }], filter: 'orderStatusId=2' },
  ])('$control options', ({ path, otherPath, section, control, option, data, filter }) => {
    it.each(['http', 'json', 'network'])('keeps rows visible and retries only failed options after a %s error', async (failure) => {
      const user = userEvent.setup();
      const recoveredOptions = deferred<Response>();
      let firstAttempt = true;
      auth.request.mockImplementation((url: string) => {
        if (url.includes('?')) return jsonResponse(orderPage());
        if (url !== path) return jsonResponse(url.endsWith('suppliers') ? [supplierFixture] : [{ id: 2, name: 'Recepción parcial' }]);
        if (!firstAttempt) return recoveredOptions.promise;
        firstAttempt = false;
        if (failure === 'network') return Promise.reject(new Error('Network unavailable'));
        return failure === 'http' ? jsonResponse({ detail: 'Opciones no disponibles.' }, 503) : Promise.resolve(new Response('invalid JSON'));
      });
      renderOrders();
      await screen.findByText('OC-48');
      const scopedOptions = within(await screen.findByRole('region', { name: section }));
      await user.click(await scopedOptions.findByRole('button', { name: /reintentar/i }));
      expect(screen.getByText('OC-48')).toBeVisible();
      expect(scopedOptions.getByRole('status')).toHaveTextContent(/cargando/i);
      expect(screen.getByRole('button', { name: control })).toBeDisabled();
      expect(auth.request.mock.calls.filter(([url]) => url === otherPath)).toHaveLength(1);
      expect(auth.request.mock.calls.filter(([url]) => url.includes('?'))).toHaveLength(1);
      recoveredOptions.resolve(await jsonResponse(data));
      await waitFor(() => expect(screen.getByRole('button', { name: control })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: control }));
      await user.click(within(screen.getByRole('listbox', { name: control })).getByRole('option', { name: option }));
      await waitFor(() => expect(auth.request).toHaveBeenCalledWith(`/api/v1/orders?page=1&pageSize=20&${filter}`));
      expect(screen.queryByRole('region', { name: section })).not.toBeInTheDocument();
      expect(await screen.findByText('OC-48')).toBeVisible();
    });
  });

  it('places the single list title, breadcrumb and create action in the shell header', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => jsonResponse(path.includes('?') ? orderPage() : []));
    renderOrders();
    await screen.findByText('OC-48');
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('heading', { level: 1, name: 'Órdenes de compra' })).toBeInTheDocument();
    expect(header.getByText('Inventario')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await user.click(header.getByRole('link', { name: 'Nueva orden' }));
    expect(await screen.findByText('Próxima etapa')).toBeInTheDocument();
    expect(header.queryByRole('link', { name: 'Nueva orden' })).not.toBeInTheDocument();
    expect(header.queryByRole('heading', { name: 'Órdenes de compra' })).not.toBeInTheDocument();
  });

  it('recovers from an order error by retrying the same filtered URL', async () => {
    const user = userEvent.setup();
    let failed = true;
    const path = '/api/v1/orders?page=1&pageSize=20&supplierId=7';
    auth.request.mockImplementation((url: string) => {
      if (url !== path) return jsonResponse([]);
      return failed ? jsonResponse({ detail: 'Compras no disponibles.' }, 500) : jsonResponse(orderPage());
    });
    renderOrders('/purchases/orders?page=1&pageSize=20&supplierId=7');
    await screen.findByText('Compras no disponibles.');
    failed = false;
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText('OC-48')).toBeInTheDocument();
    expect(auth.request.mock.calls.filter(([url]) => url === path)).toHaveLength(2);
  });

  it('formats a backend ISO purchase timestamp as its calendar date', async () => {
    auth.request.mockImplementation((path: string) => path.includes('?')
      ? jsonResponse(orderPage({ items: [{ ...orderFixture, purchaseDate: '2026-07-12T00:00:00Z' }] }))
      : jsonResponse([]));
    renderOrders();
    const row = (await screen.findByText('OC-48')).closest('tr')!;
    expect(within(row).getByRole('cell', { name: '12 jul 2026' })).toBeInTheDocument();
  });

  it('requests orders, suppliers, and statuses using URL filters', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return jsonResponse([supplierFixture]);
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'Recepción parcial' }]);
      return jsonResponse(orderPage());
    });

    renderOrders('/purchases/orders?supplierId=7');

    await waitFor(() =>
      expect(auth.request).toHaveBeenCalledWith('/api/v1/orders?page=1&pageSize=20&supplierId=7'),
    );
    expect(auth.request).toHaveBeenCalledWith('/api/v1/suppliers');
    expect(auth.request).toHaveBeenCalledWith('/api/v1/orders/statuses');
  });

  it('caps pageSize from the URL at the backend maximum when requesting orders', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return jsonResponse([supplierFixture]);
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'Recepción parcial' }]);
      return jsonResponse(orderPage());
    });

    renderOrders('/purchases/orders?pageSize=999');

    await waitFor(() =>
      expect(auth.request).toHaveBeenCalledWith('/api/v1/orders?page=1&pageSize=100'),
    );
  });

  it('shows backend totals and status labels without recomputing them', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return jsonResponse([supplierFixture]);
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'PartiallyReceived' }]);
      return jsonResponse(orderPage({ items: [{ ...orderFixture, totalCostNio: 4123.45 }] }));
    });

    renderOrders();

    expect(await screen.findByText(/C\$\s*4,123\.45/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Envío proveedor (USD)' })).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getAllByText('Recepción parcial')).toHaveLength(2);
    expect(screen.queryByText('PartiallyReceived')).not.toBeInTheDocument();
  });

  it('shows only enabled suppliers while keeping API supplier names intact', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return jsonResponse([supplierFixture, disabledSupplierFixture]);
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'Recepción parcial' }]);
      return jsonResponse(orderPage());
    });

    renderOrders();
    await screen.findByText('OC-48');

    await user.click(screen.getByRole('button', { name: 'Proveedor' }));
    const supplierListbox = screen.getByRole('listbox', { name: 'Proveedor' });

    expect(within(supplierListbox).getByRole('option', { name: 'SOHO' })).toBeInTheDocument();
    expect(within(supplierListbox).queryByRole('option', { name: 'CERRADO' })).not.toBeInTheDocument();
  });

  it('returns to page one when a filter changes and exposes no-results state', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/suppliers') return jsonResponse([supplierFixture]);
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'Recepción parcial' }]);
      if (path.includes('page=1') && path.includes('orderStatusId=2')) {
        return jsonResponse(orderPage({ items: [], totalCount: 0, totalPages: 0 }));
      }
      return jsonResponse(orderPage({ page: 3, totalPages: 3, hasPreviousPage: true }));
    });

    renderOrders('/purchases/orders?page=3');
    await screen.findByText('SOHO');
    await user.click(screen.getByRole('button', { name: 'Estado' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Estado' })).getByRole('option', { name: 'Recepción parcial' }));

    expect(await screen.findByText('No hay órdenes que coincidan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument();
    expect(auth.request).toHaveBeenCalledWith('/api/v1/orders?page=1&pageSize=20&orderStatusId=2');
  });

  it('shows loading state while orders are pending', async () => {
    const pendingOrders = deferred<Response>();
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') return pendingOrders.promise;
      return jsonResponse([]);
    });

    renderOrders();

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/orders?page=1&pageSize=20'));
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows PermissionDeniedState for a 403', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') return jsonResponse({ detail: 'Sin permiso' }, 403);
      return jsonResponse([]);
    });

    renderOrders();

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  });

  it('shows ErrorState with ProblemDetails.detail for a 500', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') {
        return jsonResponse({ detail: 'La consulta de compras no está disponible.' }, 500);
      }
      return jsonResponse([]);
    });

    renderOrders();

    expect(await screen.findByText('La consulta de compras no está disponible.')).toBeInTheDocument();
  });

  it('shows the create-first empty state when totalCount is zero without active filters', async () => {
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') {
        return jsonResponse(orderPage({ items: [], totalCount: 0, totalPages: 0 }));
      }
      return jsonResponse([]);
    });

    renderOrders();

    expect(await screen.findByText('Aún no hay órdenes de compra')).toBeInTheDocument();
    const emptyState = screen.getByText('Aún no hay órdenes de compra').closest('section');
    expect(within(emptyState as HTMLElement).getByRole('link', { name: /nueva orden/i })).toHaveAttribute('href', '/purchases/orders/new');
  });

  it('requests page 2 after clicking the next-page control', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') {
        return jsonResponse(orderPage({ totalPages: 2, hasNextPage: true }));
      }
      if (path === '/api/v1/orders?page=2&pageSize=20') {
        return jsonResponse(orderPage({ page: 2, hasPreviousPage: true }));
      }
      return jsonResponse([]);
    });

    renderOrders();
    await screen.findByText('OC-48');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/orders?page=2&pageSize=20'));
  });

  it('keeps the newer filtered rows when an older request resolves last', async () => {
    const user = userEvent.setup();
    const initialOrders = deferred<Response>();
    const filteredOrders = deferred<Response>();
    auth.request.mockImplementation((path: string) => {
      if (path === '/api/v1/orders?page=1&pageSize=20') return initialOrders.promise;
      if (path === '/api/v1/orders?page=1&pageSize=20&orderStatusId=2') return filteredOrders.promise;
      if (path === '/api/v1/orders/statuses') return jsonResponse([{ id: 2, name: 'Recepción parcial' }]);
      return jsonResponse([supplierFixture]);
    });

    renderOrders();
    await user.click(screen.getByRole('button', { name: 'Estado' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Estado' })).getByRole('option', { name: 'Recepción parcial' }));
    filteredOrders.resolve(await jsonResponse(orderPage({ items: [{ ...orderFixture, id: 99, supplierName: 'Fila nueva' }] })));
    expect(await screen.findByText('Fila nueva')).toBeInTheDocument();
    initialOrders.resolve(await jsonResponse(orderPage({ items: [{ ...orderFixture, supplierName: 'Fila anterior' }] })));

    await waitFor(() => expect(screen.queryByText('Fila anterior')).not.toBeInTheDocument());
    expect(screen.getByText('Fila nueva')).toBeInTheDocument();
  });
});
