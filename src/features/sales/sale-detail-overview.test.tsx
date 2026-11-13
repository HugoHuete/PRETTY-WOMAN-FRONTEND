import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleDetailOverview } from './sale-detail-overview';
import type { SaleDetail } from './sales-types';

const sale = { id: 1, saleDate: '2026-07-04T15:23:45.123Z', saleChannelId: 1, saleStatusId: 1, salePaymentStatusId: 1, deliveries: [], comments: null } as unknown as SaleDetail;

describe('editar información de venta', () => {
  it('no modifica la fecha ni la hora al editar solo las observaciones', () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<SaleDetailOverview sale={sale} isAdmin busy={false} onSave={onSave} onCancelSale={vi.fn()} cancelError={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar información' }));
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'Nota' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ saleDate: expect.anything() }));
  });
  it('conserva la hora al cambiar el día', () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<SaleDetailOverview sale={sale} isAdmin busy={false} onSave={onSave} onCancelSale={vi.fn()} cancelError={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar información' }));
    fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const updated = new Date(onSave.mock.calls[0][0].saleDate);
    const original = new Date(sale.saleDate);
    expect(updated.getHours()).toBe(original.getHours());
    expect(updated.getMinutes()).toBe(original.getMinutes());
    expect(updated.getSeconds()).toBe(original.getSeconds());
    expect(updated.getMilliseconds()).toBe(original.getMilliseconds());
    expect(updated.getDate()).toBe(5);
  });
});
