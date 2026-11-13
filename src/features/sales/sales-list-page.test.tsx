import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SalesListPage } from './sales-list-page';

const api = vi.hoisted(() => ({ getSales: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 }), request: vi.fn() }));
vi.mock('./sales-api', () => ({ getSales: api.getSales, ApiRequestError: class extends Error { status = 0; } }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request: api.request }) }));
vi.mock('../../shared/layout/page-actions-context', () => ({ usePageActions: () => ({ setHeading: vi.fn(), setAction: vi.fn() }) }));

describe('filtros de ventas', () => {
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
