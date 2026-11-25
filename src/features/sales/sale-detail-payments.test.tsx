import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SaleDetailPayments } from './sale-detail-payments';
import type { SaleDetail } from './sales-types';

vi.mock('../../shared/finance/exchange-rate-provider', () => ({
  useExchangeRate: () => ({ storeRate: 36, status: 'ready' }),
}));

it('prefills the sale balance and retains allocation to the associated delivery', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const sale = {
    saleStatusId: 1,
    total: 150,
    deliveries: [
      { id: 7, deliveryStatusId: 1, createdAt: '2026-11-25T10:00:00Z', shippingChargedToClient: 25 },
      { id: 8, deliveryStatusId: 3, createdAt: '2026-11-25T11:00:00Z', shippingChargedToClient: 50 },
    ],
    paymentMovements: [{
      id: 1, movementDirectionId: 1, movementDate: '2026-11-25T10:00:00Z',
      paymentMethodId: 1, paymentMethodName: 'Efectivo', productAmount: 67, shippingAmount: 0,
    }],
  } as SaleDetail;
  const onAdd = vi.fn().mockResolvedValue(true);
  const onUpdate = vi.fn().mockResolvedValue(true);
  render(<SaleDetailPayments sale={sale} isAdmin busy={false} terminals={[]} onAdd={onAdd} onUpdate={onUpdate} onRefund={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Registrar pago' }));
  expect(dialog.getByLabelText('Monto recibido')).toHaveDisplayValue('108.00');
  fireEvent.click(dialog.getByRole('button', { name: 'Dólares (US$)' }));
  expect(dialog.getByLabelText('Monto recibido')).toHaveDisplayValue('3.00');
  expect(dialog.getByText('Pago completo')).toBeVisible();
  fireEvent.click(dialog.getByRole('button', { name: 'Agregar pago' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar pago' })).not.toBeInTheDocument());
  expect(onAdd).toHaveBeenCalledWith({
    paymentMethodId: 1, productAmount: 83, shippingAmount: 25, saleDeliveryId: 7,
    amountReceivedNio: 0, amountReceivedUsd: 3, changeGivenNio: 0, exchangeRate: 36,
  });

  fireEvent.click(screen.getByRole('button', { name: 'Corregir' }));
  const correction = within(screen.getByRole('dialog', { name: 'Corregir pago' }));
  const products = correction.getByLabelText('Aplicado a productos');
  const shipping = correction.getByLabelText('Aplicado al envío');
  expect(products).toHaveDisplayValue('67.00');
  expect(shipping).toHaveDisplayValue('0.00');
  fireEvent.change(products, { target: { value: '60' } });
  fireEvent.change(shipping, { target: { value: '7' } });
  fireEvent.blur(shipping);
  expect(shipping).toHaveDisplayValue('7.00');
  fireEvent.click(correction.getByRole('button', { name: 'Guardar corrección' }));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(1, {
    paymentMethodId: 1, paymentTerminalId: null, productAmount: 60, shippingAmount: 7,
  }));
});

it('does not offer to collect a canceled and refunded delivery on a paid sale', () => {
  const sale = {
    saleStatusId: 5,
    total: 150,
    deliveries: [
      { id: 7, deliveryStatusId: 2, createdAt: '2026-11-25T10:00:00Z', shippingChargedToClient: 25 },
      { id: 8, deliveryStatusId: 3, createdAt: '2026-11-25T11:00:00Z', shippingChargedToClient: 50 },
    ],
    paymentMovements: [
      { id: 1, movementDirectionId: 1, movementDate: '2026-11-25T10:00:00Z', productAmount: 150, shippingAmount: 25, saleDeliveryId: 7 },
      { id: 2, movementDirectionId: 1, movementDate: '2026-11-25T11:00:00Z', productAmount: 0, shippingAmount: 50, saleDeliveryId: 8 },
      { id: 3, movementDirectionId: 2, movementDate: '2026-11-25T12:00:00Z', productAmount: 0, shippingAmount: 50, saleDeliveryId: 8, reversedSalePaymentMovementId: 2 },
    ],
  } as SaleDetail;
  render(<SaleDetailPayments sale={sale} isAdmin={false} busy={false} terminals={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onRefund={vi.fn()} />);
  expect(screen.getByText('Saldo pendiente').nextElementSibling).toHaveTextContent('C$0.00');
  expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
});
