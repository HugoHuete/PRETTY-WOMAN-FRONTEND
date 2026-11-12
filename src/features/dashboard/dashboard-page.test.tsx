import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './dashboard-page';

const auth = vi.hoisted(() => ({ request: vi.fn(), roles: ['Admin'] as string[] }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request: auth.request, session: { user: { roles: auth.roles } } }) }));

afterEach(() => { auth.request.mockReset(); auth.roles = ['Admin']; });

describe('Resumen financiero', () => {
  it('muestra el balance y los datos mensuales recibidos', async () => {
    auth.request.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path.endsWith('current-balance')
      ? { balanceNio: 1234.5 }
      : { years: [{ year: 2026, months: [{ month: 2, incomeNio: 1000, grossProfitNio: 600, expensesNio: 200, utilityNio: 400 }] }] }), { status: 200 })));
    render(<DashboardPage />);
    expect(await screen.findByText('C$ 1,234.50')).toBeVisible();
    expect(screen.getByText('febrero')).toBeVisible();
    expect(screen.getByText('2026')).toBeVisible();
    expect(screen.getByText('C$ 400.00')).toBeVisible();
  });

  it('filtra por año y exporta el rango aplicado', async () => {
    const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Managua' }).format(new Date());
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    auth.request.mockImplementation((path: string) => Promise.resolve(new Response(path.includes('/export') ? 'excel' : JSON.stringify(path.endsWith('current-balance') ? { balanceNio: 0 } : { years: [] }), { status: 200 })));
    render(<DashboardPage />);
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith(`/api/v1/finances/monthly-summary?fromYear=${year}&toYear=${year}`));
    fireEvent.change(screen.getByLabelText('Año de inicio'), { target: { value: '2023' } });
    fireEvent.change(screen.getByLabelText('Año de fin'), { target: { value: '2024' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/finances/monthly-summary?fromYear=2023&toYear=2024'));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/finances/monthly-summary/export?fromYear=2023&toYear=2024'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore();
  });

  it('aplica y exporta los años visibles sin pulsar Aplicar', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    auth.request.mockImplementation((path: string) => Promise.resolve(new Response(path.includes('/export') ? 'excel' : JSON.stringify(path.endsWith('current-balance') ? { balanceNio: 0 } : { years: [] }), { status: 200 })));
    try {
      render(<DashboardPage />);
      fireEvent.change(screen.getByLabelText('Año de inicio'), { target: { value: '2022' } });
      fireEvent.change(screen.getByLabelText('Año de fin'), { target: { value: '2023' } });
      fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
      await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/finances/monthly-summary/export?fromYear=2022&toYear=2023'));
      await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/finances/monthly-summary?fromYear=2022&toYear=2023'));
      await waitFor(() => expect(click).toHaveBeenCalled());
    } finally {
      createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore();
    }
  });

  it('no descarga si los años visibles son inválidos', async () => {
    auth.request.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path.endsWith('current-balance') ? { balanceNio: 0 } : { years: [] }), { status: 200 })));
    render(<DashboardPage />);
    fireEvent.change(screen.getByLabelText('Año de inicio'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Año de fin'), { target: { value: '2024' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    expect(await screen.findByText('El año de inicio debe ser anterior o igual al año de fin.')).toBeVisible();
    expect(auth.request.mock.calls.some((call) => String(call[0]).includes('/export'))).toBe(false);
  });

  it('rechaza un rango de años invertido', async () => {
    auth.request.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path.endsWith('current-balance') ? { balanceNio: 0 } : { years: [] }), { status: 200 })));
    render(<DashboardPage />);
    fireEvent.change(screen.getByLabelText('Año de inicio'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Año de fin'), { target: { value: '2024' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('El año de inicio debe ser anterior o igual al año de fin.')).toBeVisible();
    expect(auth.request).not.toHaveBeenCalledWith('/api/v1/finances/monthly-summary?fromYear=2025&toYear=2024');
  });

  it('no consulta información financiera para empleados', async () => {
    auth.roles = ['Employee'];
    render(<DashboardPage />);
    await waitFor(() => expect(auth.request).not.toHaveBeenCalled());
    expect(screen.queryByText('Balance actual')).not.toBeInTheDocument();
  });

  it('permite reintentar una consulta fallida', async () => {
    auth.request.mockResolvedValue(new Response('', { status: 500 }));
    render(<DashboardPage />);
    expect(await screen.findAllByRole('button', { name: 'Reintentar' })).toHaveLength(2);
  });
});
