import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleInitialPayment } from './sale-initial-payment';

vi.mock('../../shared/finance/exchange-rate-provider', () => ({ useExchangeRate: () => ({ storeRate: 36, status: 'ready' }) }));

describe('pago inicial con envío', () => {
  it('aplica primero a prendas y luego al envío sin devolver cambio de más', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onChange = vi.fn();
    render(<SaleInitialPayment estimatedBalance={100} shippingBalance={50} exchangeRate={36} terminals={[]} terminalLoading={false} terminalError={null} onRetryTerminals={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar pago' });
    fireEvent.change(within(dialog).getByLabelText('Monto recibido'), { target: { value: '150' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar pago' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ productAmount: 100, shippingAmount: 50, changeGivenNio: 0 })]));
  });
});
