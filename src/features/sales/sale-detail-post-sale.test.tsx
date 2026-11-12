import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleDetailPostSale } from './sale-detail-post-sale';
import type { SaleDetail } from './sales-types';
import type { ProductDTO } from '../products/product-types';

const request = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ getSaleExchanges: vi.fn().mockResolvedValue([]), getSaleReturns: vi.fn().mockResolvedValue([]), getSaleProducts: vi.fn(), createSaleExchange: vi.fn().mockResolvedValue({}) }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request }) }));
vi.mock('./sales-api', () => api);

describe('crear cambio', () => {
  it('permite entregar una prenda buscada aunque la prenda original no tenga existencias', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const product = (code: number, id: number, availableQuantity: number) => ({ code, name: `Prenda ${code}`, presentations: [{ id, name: 'Presentación', sizes: [{ id, sizeName: '9', availableQuantity, salePrice: 1100 }] }] }) as unknown as ProductDTO;
    const original = product(7711, 1, 0);
    const replacement = product(7712, 2, 2);
    api.getSaleProducts.mockResolvedValue({ items: [replacement], hasNextPage: false, hasPreviousPage: false });
    const sale = { id: 13262, saleStatusId: 4, productVariants: [{ id: 11, productId: 1, quantity: 1, finalUnitPrice: 1100 }] } as SaleDetail;
    const onMutation = vi.fn(async (action: () => Promise<unknown>) => { await action(); return true; });
    render(<SaleDetailPostSale sale={sale} products={[original]} catalogLoading={false} agencies={[]} terminals={[]} isAdmin busy={false} onMutation={onMutation} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear cambio' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear cambio' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Seleccionar código 7711/ }));
    fireEvent.change(within(dialog).getByLabelText('Buscar por código de prenda'), { target: { value: '7712' } });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Agregar' }));
    expect(within(dialog).queryByText('No hay prendas disponibles para entregar en este cambio.')).not.toBeInTheDocument();
    const submit = within(dialog).getByRole('button', { name: 'Crear cambio' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(api.createSaleExchange).toHaveBeenCalledWith(expect.anything(), 13262, expect.objectContaining({ outboundItems: [{ productId: 2, quantity: 1, itemTypeId: 1 }] })));
  });
});
