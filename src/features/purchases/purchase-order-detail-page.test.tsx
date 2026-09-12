import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderDTO, OrderTrackingNumberDTO } from './purchase-order-types';
import { PurchaseOrderDetailPage } from './purchase-order-detail-page';
import { AppShell } from '../../shared/layout/app-shell';

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ request: auth.request }),
}));

const orderFixture = {
  id: 48,
  createdAt: '2026-07-15T14:20:00Z',
  purchaseDate: '2026-07-12',
  orderStatusId: 2,
  orderStatusName: 'Recepción parcial',
  supplierId: 7,
  supplierName: 'SOHO',
  purchaseCurrencyId: 2,
  purchaseCurrencyName: 'Dólar estadounidense',
  amountUsd: 153,
  receivedAmountNio: 5600,
  comments: 'Separar las blusas blancas y negras en bolsas individuales.',
  merchandiseTotalNio: 5600,
  supplierShippingCostUsd: 15,
  warehouseShippingCostUsd: 0,
  totalCostNio: 6150,
  exchangeRate: 36.62,
  products: [{
    id: 1001,
    supplierProductCode: 'SOHO25120',
    code: 25120,
    name: 'Vestido satinado',
    subcategoryId: 4,
    subcategoryName: 'Vestidos',
    variants: [{
      id: 301,
      sizeId: 12,
      sizeName: 'M',
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
    }],
  }],
  purchaseShortages: [{
    id: 1,
    productId: 1001,
    quantity: 2,
    lossAmountNio: 250,
    shortageDate: '2026-07-15',
    refundStatus: 1,
  }],
  supplierRefund: {
    id: 9,
    financialMovementId: 77,
    amountNio: 250,
    refundedAt: '2026-07-20',
    reference: 'CR-001',
    comments: null,
  },
  totalShortageLossNio: 250,
  totalSupplierRefundNio: 250,
  netShortageLossNio: 0,
  supplierRefundDeclinedAt: null,
  supplierRefundDeclineComments: null,
} satisfies OrderDTO;

const trackingFixture = {
  id: 22,
  orderId: 48,
  shippingCompanyId: 2,
  trackingNumber: 'SOHO-782190',
  supplierShipmentDate: '2026-07-13',
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 1.25,
  shippingCost: 350,
  shippingCompanyName: 'Cargo Express',
} satisfies OrderTrackingNumberDTO;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

function renderDetail(path = '/purchases/orders/48') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route element={<AppShell />}><Route path="/purchases/orders/:id" element={<PurchaseOrderDetailPage />} /><Route path="/purchases/orders" element={<p>Listado de compras</p>} /></Route></Routes>
    </MemoryRouter>,
  );
}

function DetailRoute() {
  return (
    <>
      <Link to="/purchases/orders/49">Siguiente orden</Link>
      <PurchaseOrderDetailPage />
    </>
  );
}

afterEach(() => auth.request.mockReset());

describe('PurchaseOrderDetailPage', () => {
  it('places the single detail title and working back link in the shell header', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : orderFixture));
    renderDetail();
    await screen.findByText('Vestido satinado');
    const header = within(screen.getByRole('banner'));
    expect(await header.findByRole('heading', { level: 1, name: 'Orden #48' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await user.click(header.getByRole('link', { name: /regresar a compras/i }));
    expect(await screen.findByText('Listado de compras')).toBeInTheDocument();
    expect(header.queryByRole('heading', { name: 'Orden #48' })).not.toBeInTheDocument();
    expect(header.queryByRole('link', { name: /regresar a compras/i })).not.toBeInTheDocument();
  });

  it.each([{ products: undefined }, { products: null }, { products: [] }])('shows a contextual empty state for products: $products', async ({ products }) => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : { ...orderFixture, products }));
    renderDetail();
    expect(await screen.findByText('No hay productos registrados para esta orden.')).toBeInTheDocument();
    expect(screen.getByText('C$6,150.00')).toBeInTheDocument();
  });

  it.each([{ variants: undefined }, { variants: null }, { variants: [] }])('shows a contextual empty state for variants: $variants', async ({ variants }) => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : {
      ...orderFixture, products: [{ ...orderFixture.products[0], variants }],
    }));
    renderDetail();
    expect(await screen.findByText('No hay variantes registradas para este producto.')).toBeInTheDocument();
    expect(screen.getByText('Vestido satinado')).toBeInTheDocument();
  });

  it.each([undefined, null])('shows a contextual empty state when shortages are %s', async (purchaseShortages) => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : { ...orderFixture, purchaseShortages }));
    renderDetail();
    expect(await screen.findByText('No hay faltantes registrados para esta orden.')).toBeInTheDocument();
    expect(screen.getByText('Vestido satinado')).toBeInTheDocument();
  });

  it('loads the order and tracking collection for the route id', async () => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [trackingFixture] : orderFixture));
    renderDetail();
    expect(await screen.findByRole('heading', { name: /orden #?48/i })).toBeInTheDocument();
    expect(auth.request).toHaveBeenCalledWith('/api/v1/orders/48');
    expect(auth.request).toHaveBeenCalledWith('/api/v1/orders/48/tracking-numbers');
  });

  it('shows a not-found state for a missing order', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse([]) : jsonResponse({ title: 'No existe' }, 404));
    renderDetail();
    expect(await screen.findByText('No encontramos esta orden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a órdenes/i })).toHaveAttribute('href', '/purchases/orders');
  });

  it('shows loading state while detail is pending', async () => {
    const pendingOrder = deferred<Response>();
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse([]) : pendingOrder.promise);
    renderDetail();
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/orders/48'));
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows ErrorState for a failed detail request', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse([]) : jsonResponse({ detail: 'La orden no está disponible.' }, 500));
    renderDetail();
    expect(await screen.findByText('La orden no está disponible.')).toBeInTheDocument();
  });

  it('shows PermissionDeniedState for a 403', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse([]) : jsonResponse({ detail: 'Sin permiso' }, 403));
    renderDetail();
    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  });

  it('renders each product variant with received and pending quantities', async () => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : orderFixture));
    renderDetail();
    expect(await screen.findByText('Vestido satinado')).toBeInTheDocument();
    expect(screen.getByText('Recibidas: 1')).toBeInTheDocument();
    expect(screen.getByText('Pendientes: 2')).toBeInTheDocument();
  });

  it('renders totalShortageLossNio, totalSupplierRefundNio, and netShortageLossNio from the API', async () => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : orderFixture));
    renderDetail();
    expect(await screen.findByText('Pérdida total')).toBeInTheDocument();
    expect(screen.getAllByText('C$250.00')).toHaveLength(2);
    expect(screen.getByText('C$0.00')).toBeInTheDocument();
  });

  it('keeps the detail sections in the documented reading order', async () => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : orderFixture));
    renderDetail();
    await screen.findByRole('heading', { name: /orden #?48/i });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Datos de la orden',
      'Resumen de compra',
      'Productos de la orden',
      'Faltantes',
      'Números de seguimiento',
      'Comentario interno',
    ]);
  });

  it('shows a tracking pending state while the tracking request is unresolved', async () => {
    const pendingTracking = deferred<Response>();
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? pendingTracking.promise : jsonResponse(orderFixture));
    renderDetail();
    expect(await screen.findByRole('status', { name: /cargando números de seguimiento/i })).toBeInTheDocument();
  });

  it('shows a scoped permission state for a 403 tracking request', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse({ detail: 'Sin permiso para tracking.' }, 403) : jsonResponse(orderFixture));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
  });

  it('shows a scoped not-found state for a 404 tracking request', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse({ title: 'No existe tracking.' }, 404) : jsonResponse(orderFixture));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'No encontramos los números de seguimiento' })).toBeInTheDocument();
  });

  it('shows ErrorState for another failed tracking request', async () => {
    auth.request.mockImplementation((path: string) => path.endsWith('tracking-numbers') ? jsonResponse({ detail: 'El historial de paquetes no está disponible.' }, 500) : jsonResponse(orderFixture));
    renderDetail();
    expect(await screen.findByText('El historial de paquetes no está disponible.')).toBeInTheDocument();
  });

  it('shows the contextual empty state when tracking is empty', async () => {
    auth.request.mockImplementation((path: string) => jsonResponse(path.endsWith('tracking-numbers') ? [] : orderFixture));
    renderDetail();
    expect(await screen.findByText(/aún no hay números de seguimiento/i)).toBeInTheDocument();
  });

  it('ignores the first id response after navigation to a second order', async () => {
    const user = userEvent.setup();
    const firstOrder = deferred<Response>();
    const secondOrder = deferred<Response>();
    auth.request.mockImplementation((path: string) => {
      if (path.endsWith('tracking-numbers')) return jsonResponse([]);
      return path.endsWith('/48') ? firstOrder.promise : secondOrder.promise;
    });
    render(
      <MemoryRouter initialEntries={['/purchases/orders/48']}>
        <Routes><Route element={<AppShell />}><Route path="/purchases/orders/:id" element={<DetailRoute />} /></Route></Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('link', { name: 'Siguiente orden' }));
    secondOrder.resolve(await jsonResponse({ ...orderFixture, id: 49, supplierName: 'Proveedor actual' }));
    expect(await screen.findByRole('heading', { name: /orden #?49/i })).toBeInTheDocument();
    firstOrder.resolve(await jsonResponse({ ...orderFixture, supplierName: 'Proveedor anterior' }));
    await waitFor(() => expect(screen.queryByText('Proveedor anterior')).not.toBeInTheDocument());
    expect(screen.getByText('Proveedor actual')).toBeInTheDocument();
  });
});
