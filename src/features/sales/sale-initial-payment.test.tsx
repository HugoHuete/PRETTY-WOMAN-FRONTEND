import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleInitialPayment } from './sale-initial-payment';

vi.mock('../../shared/finance/exchange-rate-provider', () => ({ useExchangeRate: () => ({ storeRate: null, status: 'ready' }) }));

describe('pago inicial con envío', () => {
  it('rellena el saldo completo y lo recalcula al elegir dólares con un clic', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onChange = vi.fn();
    render(<SaleInitialPayment estimatedBalance={100} shippingBalance={50.15} exchangeRate={36} terminals={[]} terminalLoading={false} terminalError={null} onRetryTerminals={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Agregar pago' }));
    expect(dialog.getByLabelText('Monto recibido')).toHaveValue(150.15);
    expect(dialog.getByText('Pago completo')).toBeVisible();
    expect(dialog.queryByText('Equivalente recibido')).not.toBeInTheDocument();
    const dollars = dialog.getByRole('button', { name: 'Dólares (US$)' });
    fireEvent.click(dollars);
    expect(dollars).toHaveAttribute('aria-pressed', 'true');
    expect(dialog.getByLabelText('Monto recibido')).toHaveValue(4.18);
    expect(dialog.getByText('Equivalente recibido')).toBeVisible();
    expect(dialog.getByText('Cambio a entregar')).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: 'Agregar pago' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({
      productAmount: 100, shippingAmount: 50.15, amountReceivedUsd: 4.18, changeGivenNio: 0.33,
    })]));
  });

  it('redondea hacia arriba el saldo convertido a dólares antes de reconvertirlo', () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleInitialPayment estimatedBalance={36.13} exchangeRate={36.126} terminals={[]} terminalLoading={false} terminalError={null} onRetryTerminals={() => {}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Agregar pago' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Dólares (US$)' }));
    expect(dialog.getByLabelText('Monto recibido')).toHaveValue(1.01);
  });

  it('bloquea la edición si deja un pago posterior con tarjeta por encima del saldo', () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleInitialPayment estimatedBalance={150} exchangeRate={36} terminals={[{ id: 1, name: 'POS Bac' }]} terminalLoading={false} terminalError={null} onRetryTerminals={() => {}} onChange={vi.fn()} />);
    const openPayment = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
      return within(screen.getByRole('dialog', { name: 'Agregar pago' }));
    };
    let dialog = openPayment();
    fireEvent.change(dialog.getByLabelText('Monto recibido'), { target: { value: '100' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Agregar pago' }));
    dialog = openPayment();
    fireEvent.click(dialog.getByRole('button', { name: 'Método de pago' }));
    fireEvent.click(within(dialog.getByRole('listbox')).getByRole('option', { name: 'POS Bac' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Agregar pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar pago 1' }));
    dialog = within(screen.getByRole('dialog', { name: 'Editar pago' }));
    expect(dialog.getByText('Pago completo')).toBeVisible();

    fireEvent.change(dialog.getByLabelText('Monto recibido'), { target: { value: '110' } });
    expect(dialog.queryByText('Pago completo')).not.toBeInTheDocument();
    expect(dialog.getByRole('alert')).toHaveTextContent('otro pago con tarjeta');
    expect(dialog.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    fireEvent.change(dialog.getByLabelText('Monto recibido'), { target: { value: '100' } });
    expect(dialog.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('aplica primero a prendas y luego al envío sin devolver cambio de más', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const onChange = vi.fn();
    render(<SaleInitialPayment estimatedBalance={100} shippingBalance={50} exchangeRate={36} terminals={[]} terminalLoading={false} terminalError={null} onRetryTerminals={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar pago' });
    expect(within(dialog).getByLabelText('Monto recibido')).toHaveValue(150);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Limpiar monto' }));
    expect(within(dialog).getByLabelText('Monto recibido')).toHaveValue(null);
    expect(within(dialog).getByRole('button', { name: 'Agregar pago' })).toBeDisabled();
    const amount = within(dialog).getByLabelText('Monto recibido');
    fireEvent.change(amount, { target: { value: '36' } });
    fireEvent.blur(amount);
    expect(amount).toHaveDisplayValue('36.00');
    expect(within(dialog).getByText('US$3.17')).toBeVisible();
    fireEvent.change(within(dialog).getByLabelText('Monto recibido'), { target: { value: '150' } });
    expect(within(dialog).queryByText('US$3.17')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar pago' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ productAmount: 100, shippingAmount: 50, changeGivenNio: 0 })]));

    fireEvent.click(screen.getByRole('button', { name: 'Editar pago 1' }));
    const editDialog = within(screen.getByRole('dialog', { name: 'Editar pago' }));
    const pendingBalance = editDialog.getByText('Saldo pendiente').nextElementSibling;
    expect(pendingBalance).toHaveTextContent('C$0.00');
    expect(pendingBalance).toHaveTextContent('US$0.00');
    expect(editDialog.getByLabelText('Monto recibido')).toHaveValue(150);
  });
});
