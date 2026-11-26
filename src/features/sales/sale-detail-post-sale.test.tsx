import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleDetailPostSale } from './sale-detail-post-sale';
import type { SaleDeliveryAgency, SaleDetail } from './sales-types';
import type { ProductDTO } from '../products/product-types';

const request = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ getSaleExchanges: vi.fn().mockResolvedValue([]), getSaleReturns: vi.fn().mockResolvedValue([]), getSaleProducts: vi.fn(), getSaleProductCatalog: vi.fn().mockResolvedValue([]), createSaleExchange: vi.fn().mockResolvedValue({}), correctSaleExchangeOutboundItem: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request }) }));
vi.mock('./sales-api', () => api);

it('enfoca la solicitud enlazada cuando un reintento logra cargarla', async () => {
  api.getSaleReturns
    .mockRejectedValueOnce(new Error('Error de red'))
    .mockResolvedValueOnce([{ id: 3, statusId: 1, reasonId: 1, methodId: 1, refundTotal: 100, items: [] }]);
  const sale = { id: 13262, saleStatusId: 4, productVariants: [{ id: 11, productId: 1, quantity: 1, finalUnitPrice: 100 }] } as SaleDetail;

  render(<SaleDetailPostSale hash="#post-sale-return-3" sale={sale} products={[]} catalogLoading={false}
    agencies={[]} terminals={[]} isAdmin busy={false} onMutation={vi.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  const heading = await screen.findByRole('heading', { name: 'Devolución #3' });
  expect(heading.closest('article')).toHaveFocus();
});

it('identifica la talla entregada y conserva los datos de la corrección si falla el guardado', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.getSaleExchanges.mockResolvedValueOnce([{
    id: 4, statusId: 4, balanceToCollect: 300, returnItems: [],
    outboundItems: [
      { id: 7, productId: 13, productCode: 7711, quantity: 1, itemTypeId: 1, unitPrice: 1300, unitCost: 700, delivered: true },
      { id: 8, productId: 15, productCode: 7711, quantity: 1, itemTypeId: 1, unitPrice: 1300, unitCost: 700, delivered: true },
    ],
  }]);
  api.getSaleProductCatalog.mockResolvedValueOnce([{
    code: 7711, name: 'Prenda 7711', presentations: [{
      name: 'Azul', sizes: [{ id: 13, sizeName: 'M' }, { id: 15, sizeName: 'L' }],
    }],
  }]);
  api.correctSaleExchangeOutboundItem.mockRejectedValueOnce(new Error('El inventario cambió durante la operación.'));
  api.getSaleProducts.mockResolvedValueOnce({
    items: [{
      code: 7712, name: 'Prenda 7712', presentations: [{
        id: 2, name: 'Coral', sizes: [{ id: 14, sizeName: 'S', availableQuantity: 1, salePrice: 1300, unitCostNio: 750 }],
      }],
    }],
  });
  const sale = { id: 13262, saleStatusId: 4, productVariants: [{ id: 11, productId: 1, quantity: 1, finalUnitPrice: 1000 }] } as SaleDetail;
  const onMutation = vi.fn(async (action: () => Promise<unknown>) => {
    try { await action(); return true; }
    catch { return false; }
  });
  render(<SaleDetailPostSale sale={sale} products={[]} catalogLoading={false} agencies={[]} terminals={[]} isAdmin busy={false} onMutation={onMutation} />);
  const recorded = await screen.findByText(/Prenda 7711 · Azul · M · Código 7711/);
  expect(screen.getByText(/Prenda 7711 · Azul · L · Código 7711/)).toBeVisible();
  expect(api.getSaleProductCatalog).toHaveBeenCalledWith(request, [13, 15]);
  fireEvent.click(within(recorded).getByRole('button', { name: 'Corregir prenda entregada' }));
  const dialog = screen.getByRole('dialog', { name: 'Corregir prenda entregada' });
  expect(within(dialog).getByText(/Prenda 7711 · Azul · M · Código 7711/)).toBeVisible();
  expect(within(dialog).queryByText(/Prenda 7711 · Azul · L · Código 7711/)).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Código de la prenda correcta'), { target: { value: '7712' } });
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Presentación y talla' }));
  fireEvent.click(within(screen.getByRole('listbox', { name: 'Presentación y talla' })).getByRole('option', { name: 'Prenda 7712 · Coral · S' }));
  const price = within(dialog).getByLabelText('Precio unitario original de la prenda correcta');
  const save = within(dialog).getByRole('button', { name: 'Guardar corrección' });
  fireEvent.change(price, { target: { value: '1200' } });
  fireEvent.change(within(dialog).getByLabelText('Referencia del comprobante o registro del precio original'), { target: { value: 'Comprobante 21' } });
  fireEvent.change(within(dialog).getByLabelText('Motivo de la corrección'), { target: { value: 'Código ingresado por error' } });
  expect(save).toBeDisabled();
  fireEvent.change(price, { target: { value: '1300' } });
  expect(save).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Costo unitario original de la prenda correcta (C$)'), { target: { value: '725.123456' } });
  fireEvent.change(within(dialog).getByLabelText('Referencia del registro del costo original'), { target: { value: 'Recepción 4' } });
  fireEvent.click(save);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('El inventario cambió durante la operación.');
  expect(within(dialog).getByLabelText('Motivo de la corrección')).toHaveValue('Código ingresado por error');
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  await waitFor(() => expect(api.correctSaleExchangeOutboundItem).toHaveBeenCalledWith(request, 13262, 4, 7, {
    expectedProductId: 13, replacementProductId: 14, originalEffectiveUnitPrice: 1300, priceReference: 'Comprobante 21', originalUnitCost: 725.123456, costReference: 'Recepción 4', reason: 'Código ingresado por error',
  }));
});

describe('crear cambio', () => {
  it('permite entregar una prenda buscada con descuento aunque la prenda original no tenga existencias', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const product = (code: number, id: number, availableQuantity: number) => ({ code, name: `Prenda ${code}`, presentations: [{ id, name: 'Presentación', sizes: [{ id, sizeName: '9', availableQuantity, salePrice: 1100, discountedSalePrice: code === 7712 ? 1000 : null }] }] }) as unknown as ProductDTO;
    const original = product(7711, 1, 0);
    const replacement = product(7712, 2, 2);
    api.getSaleProducts.mockResolvedValue({ items: [replacement], hasNextPage: false, hasPreviousPage: false });
    const sale = { id: 13262, saleStatusId: 4, productVariants: [{ id: 11, productId: 1, quantity: 1, finalUnitPrice: 1100 }] } as SaleDetail;
    api.createSaleExchange.mockRejectedValueOnce(new Error('Los cambios por agencia no admiten saldo a favor de la clienta.'));
    const onMutation = vi.fn(async (action: () => Promise<unknown>) => {
      try { await action(); return true; }
      catch { return false; }
    });
    const agencies = [{ id: 1, name: 'Agencia' }] as SaleDeliveryAgency[];
    render(<SaleDetailPostSale sale={sale} products={[original]} catalogLoading={false} agencies={agencies} terminals={[]} isAdmin busy={false} onMutation={onMutation} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear cambio' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear cambio' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Seleccionar código 7711/ }));
    fireEvent.change(within(dialog).getByLabelText('Buscar por código de prenda'), { target: { value: '7712' } });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Agregar' }));
    expect(within(dialog).queryByText('No hay prendas disponibles para entregar en este cambio.')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Saldo a favor de la clienta').parentElement).toHaveTextContent(/100[.,]00/);
    const submit = within(dialog).getByRole('button', { name: 'Crear cambio' });
    const delivery = within(dialog).getByLabelText('Forma de entrega del cambio');
    fireEvent.change(delivery, { target: { value: '1' } });
    expect(submit).toBeEnabled();
    expect(within(dialog).getByRole('status')).toHaveTextContent('El saldo estimado queda a favor');
    fireEvent.click(submit);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Los cambios por agencia no admiten saldo a favor');
    expect(delivery).toHaveValue('1');
    fireEvent.click(submit);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(api.createSaleExchange).toHaveBeenCalledWith(expect.anything(), 13262, expect.objectContaining({ deliveryAgencyId: 1, outboundItems: [{ productId: 2, quantity: 1, itemTypeId: 1 }] })));
  });
});
