import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaleCreatePage } from './sale-create-page';

const api = vi.hoisted(() => ({ createSale: vi.fn().mockResolvedValue(1), getSalePaymentTerminals: vi.fn().mockResolvedValue([]), getSaleMunicipalities: vi.fn().mockResolvedValue([{ id: 1, name: 'Managua', departmentName: 'Managua' }]), getSaleDeliveryAgencies: vi.fn().mockResolvedValue([{ id: 2, name: 'Agencia prueba', enabled: true }]) }));
vi.mock('./sales-api', () => api);
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request: requestMock }) }));
const requestMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => vi.fn() }));
vi.mock('../../shared/layout/page-actions-context', () => ({ usePageActions: () => ({ setHeading: vi.fn() }) }));
vi.mock('../../shared/ui/toast-context', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../shared/finance/exchange-rate-provider', () => ({ useExchangeRate: () => ({ storeRate: 36 }) }));
vi.mock('./sale-client-create-dialog', () => ({ SaleClientCreateDialog: () => null }));
vi.mock('./sale-client-picker', () => ({ SaleClientPicker: () => null }));
vi.mock('./sale-global-discount-dialog', () => ({ SaleGlobalDiscountDialog: () => null }));
vi.mock('./sale-initial-payment', () => ({ SaleInitialPayment: () => null }));
vi.mock('./sale-product-lines', () => ({ SaleProductLines: () => null }));
vi.mock('./sale-product-picker', () => ({ SaleProductPicker: ({ onAdd }: { onAdd: (item: unknown) => void }) => <button type="button" onClick={() => onAdd({ product: { name: 'Prenda', code: 10 }, variant: { id: 4, sizeName: 'M', availableQuantity: 2, salePrice: 100, discountedSalePrice: null, discountCampaignId: null }, presentationName: 'Azul', presentationVariants: [] })}>Prenda de prueba</button> }));

describe('crear venta con envío', () => {
  it('envía los datos del envío y la fecha junto con la venta', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear envío' });
    await within(dialog).findByRole('button', { name: 'Agencia de envío' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Agencia de envío' })).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText('Código del envío'), { target: { value: 'ENV-1' } });
    fireEvent.change(within(dialog).getByLabelText('Costo de envío (C$)'), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agencia de envío' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Agencia de envío' })).getByRole('option', { name: 'Agencia prueba' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear envío' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Crear envío' })).not.toBeInTheDocument());
    expect(api.createSale).not.toHaveBeenCalled();
    expect(screen.getByText('Envío cobrado')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-04' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    await waitFor(() => expect(api.createSale).toHaveBeenCalledWith(requestMock, expect.objectContaining({ saleDate: '2026-07-04T18:00:00.000Z', delivery: { code: 'ENV-1', deliveryAgencyId: 2, municipalityId: 1, shippingChargedToClient: 50 } })));
  });
});
