import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SalesListPage } from './sales-list-page';

const pageActions = vi.hoisted(() => ({ setHeading: vi.fn(), setAction: vi.fn() }));
const api = vi.hoisted(() => ({ getSales: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 }), request: vi.fn(), getSaleClient: vi.fn() }));
vi.mock('./sales-api', () => ({ getSales: api.getSales, getSaleClient: api.getSaleClient, ApiRequestError: class extends Error { status = 0; } }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request: api.request }) }));
vi.mock('../../shared/layout/page-actions-context', () => ({ usePageActions: () => pageActions }));

it('ofrece Cambios y devoluciones junto a Nueva venta', async () => {
  render(<MemoryRouter initialEntries={['/sales']}><SalesListPage /></MemoryRouter>);
  await screen.findByText('No hay ventas en este periodo');
  const actions = pageActions.setAction.mock.lastCall?.[0];
  render(<MemoryRouter>{actions}</MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Cambios y devoluciones' })).toHaveAttribute('href', '/sales/post-sale');
  expect(screen.getByRole('link', { name: 'Nueva venta' })).toHaveAttribute('href', '/sales/new');
});

it('abre la ficha de la clienta desde la lista de ventas', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.getSales.mockResolvedValueOnce({
    items: [{
      id: 42, saleDate: '2026-11-26T18:00:00Z', clientId: 7, clientName: 'Ricky Downs',
      saleStatusId: 2, salePaymentStatusId: 1, saleChannelId: 1, total: 1530,
    }],
    page: 1, totalPages: 1, totalCount: 1,
  });
  api.getSaleClient.mockResolvedValueOnce({ id: 7, name: 'Ricky Downs', phone: '12345678' });

  render(<MemoryRouter initialEntries={['/sales']}><SalesListPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Ricky Downs' }));
  expect(await screen.findByRole('dialog', { name: 'Ricky Downs' })).toBeVisible();
  expect(api.getSaleClient).toHaveBeenCalledWith(api.request, 7);
  expect(screen.getByText('12345678')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

describe('filtros de ventas', () => {
  it('aplica filtros adicionales juntos y los conserva al plegar el panel', async () => {
    render(<MemoryRouter initialEntries={['/sales?page=3']}><SalesListPage /></MemoryRouter>);
    expect(screen.queryByLabelText('Código de producto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    fireEvent.change(screen.getByLabelText('Código de producto'), { target: { value: '7857' } });
    fireEvent.change(screen.getByLabelText('Nombre de clienta'), { target: { value: ' Diana ' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '8786-07' } });
    fireEvent.change(screen.getByLabelText('Usuario de Instagram'), { target: { value: 'diana.morgan' } });
    fireEvent.change(screen.getByLabelText('Usuario de Messenger'), { target: { value: 'Diana Morgan' } });
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).not.toBeInTheDocument();
    expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining({ page: 3, clientName: '' }));

    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining({
      page: 1, productCode: '7857', clientName: 'Diana', clientPhone: '8786-07', clientInstagramUser: 'diana.morgan', clientMessengerUser: 'Diana Morgan',
    })));
    expect(screen.getByLabelText('Nombre de clienta')).toHaveValue(' Diana ');
    fireEvent.click(screen.getByRole('button', { name: 'Menos filtros (5)' }));
    expect(screen.getByRole('button', { name: 'Más filtros (5)' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining({
      page: 1, productCode: '', clientName: '', clientPhone: '', clientInstagramUser: '', clientMessengerUser: '',
    })));
  });

  it.each([-1, 1])('descarta el filtro pendiente al navegar %i en el historial', async (direction) => {
    function NavigateHistory() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => void navigate(direction)}>Navegar historial</button>;
    }

    vi.useFakeTimers();
    try {
      render(<MemoryRouter
        initialEntries={['/sales?page=4&clientName=Ana', '/sales?page=3&clientName=Ricky']}
        initialIndex={direction === -1 ? 1 : 0}
      >
        <SalesListPage />
        <NavigateHistory />
      </MemoryRouter>);
      fireEvent.change(screen.getByLabelText('Nombre de clienta'), { target: { value: 'Borrador' } });
      fireEvent.click(screen.getByRole('button', { name: 'Navegar historial' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

      const restored = direction === -1 ? { page: 4, clientName: 'Ana' } : { page: 3, clientName: 'Ricky' };
      expect(screen.getByLabelText('Nombre de clienta')).toHaveValue(restored.clientName);
      expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining(restored));
    } finally {
      vi.useRealTimers();
    }
  });

  it('limpia todos los filtros y vuelve a la primera página', async () => {
    render(<MemoryRouter initialEntries={['/sales?page=3&pageSize=20&startDate=2026-01-01&endDate=2026-02-01&saleStatusId=2&salePaymentStatusId=1&saleChannelId=2']}><SalesListPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByLabelText('Desde')).toHaveValue('');
    expect(screen.getByLabelText('Hasta')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Estado de venta' })).toHaveTextContent('Todos');
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining({ page: 1, startDate: '', endDate: '', saleStatusId: '', salePaymentStatusId: '', saleChannelId: '' })));
  });
  it('muestra la fecha final aplicada cuando se elige una anterior al inicio', async () => {
    render(<MemoryRouter initialEntries={['/sales?startDate=2026-11-13&endDate=2026-11-13']}><SalesListPage /></MemoryRouter>);
    const end = screen.getByLabelText('Hasta');
    fireEvent.change(end, { target: { value: '12/11/2026' } });
    fireEvent.blur(end);
    await waitFor(() => expect(end).toHaveValue('13/11/2026'));
    expect(api.getSales).toHaveBeenLastCalledWith(api.request, expect.objectContaining({ startDate: '2026-11-13', endDate: '2026-11-13' }));
  });
});
