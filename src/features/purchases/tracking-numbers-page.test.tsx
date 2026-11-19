import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageActionsProvider } from '../../shared/layout/page-actions-context';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type {
  OrderStatusDTO,
  OrderTrackingNumberDTO,
  PaginatedResult,
  ShippingCompanyDTO,
} from './purchase-order-types';
import { buildTrackingNumbersPath } from './purchase-order-types';
import { TrackingNumbersPage } from './tracking-numbers-page';

const auth = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ request: auth.request }),
}));

const shippingCompanyFixture = {
  id: 2,
  name: 'Cargo Express',
  url: 'https://carrier.example/track?number=',
} satisfies ShippingCompanyDTO;

const statusFixture = {
  id: 2,
  name: 'Recepción parcial',
} satisfies OrderStatusDTO;

const trackingFixture = {
  id: 22,
  orderId: 48,
  purchaseDate: '2026-07-12T00:00:00Z',
  supplierName: 'SOHO',
  shippingCompanyId: 2,
  trackingNumber: 'SOHO-782190',
  supplierShipmentDate: '2026-07-15T00:00:00Z',
  warehouseDeliveryDate: null,
  productReceiptId: null,
  weight: 1.25,
  shippingCost: 350,
  shippingCompanyName: 'Cargo Express',
} satisfies OrderTrackingNumberDTO;

const pageFixture = {
  items: [trackingFixture],
  page: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
} satisfies PaginatedResult<OrderTrackingNumberDTO>;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function renderPage(path = '/purchases/tracking-numbers') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageActionsProvider>
      <Routes>
        <Route path="/purchases/tracking-numbers" element={<TrackingNumbersPage />} />
        <Route path="/purchases/orders/48" element={<p>Detalle de orden</p>} />
      </Routes>
      </PageActionsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  auth.request.mockReset();
});

describe('tracking number helpers', () => {
  it('serializes only active tracking filters', () => {
    expect(
      buildTrackingNumbersPath({
        page: 2,
        pageSize: 20,
        trackingNumber: ' SOHO-78 ',
        isReceived: 'false',
        shippingCompanyId: '2',
        orderStatusId: '',
        purchaseDateFrom: '2026-07-01',
        purchaseDateTo: '',
      }),
    ).toBe(
      '/api/v1/tracking-numbers?page=2&pageSize=20&isReceived=false&trackingNumber=SOHO-78&shippingCompanyId=2&purchaseDateFrom=2026-07-01',
    );
  });

  it('keeps backend tracking contracts typed', () => {
    expectTypeOf(trackingFixture).toMatchTypeOf<OrderTrackingNumberDTO>();
    expectTypeOf(shippingCompanyFixture).toMatchTypeOf<ShippingCompanyDTO>();
    expectTypeOf(statusFixture).toMatchTypeOf<OrderStatusDTO>();
    expectTypeOf(pageFixture).toMatchTypeOf<PaginatedResult<OrderTrackingNumberDTO>>();
  });
});

describe('TrackingNumbersPage', () => {
  it.each([
    { warehouseDeliveryDate: null, warehouseLabel: 'Sin registrar', estimate: '' },
    { warehouseDeliveryDate: '2026-10-29T00:00:00Z', warehouseLabel: '29/10/2026', estimate: '19/11/2026' },
  ])('renders and copies tracking with warehouse date $warehouseDeliveryDate', async ({ warehouseDeliveryDate, warehouseLabel, estimate }) => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url.startsWith('/api/v1/tracking-numbers')) {
        return jsonResponse({ ...pageFixture, items: [{ ...trackingFixture, warehouseDeliveryDate }] });
      }
      if (url === '/api/v1/shipping-companies') return jsonResponse([shippingCompanyFixture]);
      if (url === '/api/v1/orders/statuses') return jsonResponse([statusFixture]);
      return jsonResponse([]);
    });

    renderPage();

    const trackingLink = await screen.findByRole('link', { name: 'SOHO-782190' });
    expect(trackingLink).toHaveAttribute('href', 'https://carrier.example/track?number=SOHO-782190');
    expect(trackingLink).toHaveAttribute('target', '_blank');
    await user.click(screen.getByRole('button', { name: 'Copiar tracking SOHO-782190' }));
    expect(await navigator.clipboard.readText()).toBe('SOHO-782190');
    expect(screen.getByText('Número de tracking copiado.')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').slice(0, 3).map((header) => header.textContent))
      .toEqual(['Fecha de compra', 'Empresa de envío', 'Tracking']);
    const purchaseCell = screen.getAllByRole('cell')[0];
    expect(Array.from(purchaseCell.children, (item) => item.textContent))
      .toEqual(['12/07/2026', '48 - SOHO']);
    expect(screen.getAllByText('Cargo Express')).toHaveLength(2);
    expect(screen.getByText('Pendiente')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Orden' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').slice(-4).map((header) => header.textContent))
      .toEqual(['Fecha de envío', 'Fecha de bodega', 'Fecha entrega estimada', 'Acciones']);
    expect(screen.getAllByRole('cell').slice(-4, -1).map((cell) => cell.textContent))
      .toEqual(['15/07/2026', warehouseLabel, estimate]);
    expect(screen.getByRole('link', { name: '48 - SOHO' })).toHaveAttribute(
      'href',
      '/purchases/orders/48',
    );
    expect(screen.getByRole('button', { name: 'Estado de recepción' })).toBeEnabled();
  });

  it('edits a tracking inline using the scoped update endpoint', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') return jsonResponse(trackingFixture);
      if (url.startsWith('/api/v1/tracking-numbers')) return jsonResponse(pageFixture);
      if (url === '/api/v1/shipping-companies') return jsonResponse([shippingCompanyFixture]);
      if (url === '/api/v1/orders/statuses') return jsonResponse([statusFixture]);
      return jsonResponse([]);
    });

    renderPage();
    await screen.findByText('SOHO-782190');
    await user.click(screen.getByRole('button', { name: 'Editar tracking SOHO-782190' }));

    const editor = screen.getByRole('form', { name: 'Editar tracking SOHO-782190' });
    const trackingInput = within(editor).getByRole('textbox', { name: 'Número de tracking' });
    await user.clear(trackingInput);
    await user.type(trackingInput, 'SOHO-782191');
    await user.click(within(editor).getByRole('button', { name: 'Guardar tracking' }));

    await waitFor(() =>
      expect(auth.request).toHaveBeenCalledWith(
        '/api/v1/orders/48/tracking-numbers/22',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('SOHO-782191'),
        }),
      ),
    );
  });

  it('confirms and deletes a tracking from the list', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') return jsonResponse(null, 204);
      if (url.startsWith('/api/v1/tracking-numbers')) return jsonResponse(pageFixture);
      if (url === '/api/v1/shipping-companies') return jsonResponse([shippingCompanyFixture]);
      if (url === '/api/v1/orders/statuses') return jsonResponse([statusFixture]);
      return jsonResponse([]);
    });

    renderPage();
    await screen.findByText('SOHO-782190');
    await user.click(screen.getByRole('button', { name: 'Eliminar tracking SOHO-782190' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() =>
      expect(auth.request).toHaveBeenCalledWith(
        '/api/v1/orders/48/tracking-numbers/22',
        { method: 'DELETE' },
      ),
    );
  });
});
