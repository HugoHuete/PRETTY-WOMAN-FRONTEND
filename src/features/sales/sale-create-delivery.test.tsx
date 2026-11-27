import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaleCreatePage } from './sale-create-page';

const api = vi.hoisted(() => ({ getSharedSaleCart: vi.fn(), createSale: vi.fn().mockResolvedValue(1), getSalePaymentTerminals: vi.fn().mockResolvedValue([]), getSaleMunicipalities: vi.fn().mockResolvedValue([{ id: 1, name: 'Managua', departmentName: 'Managua' }]), getSaleDeliveryAgencies: vi.fn().mockResolvedValue([{ id: 2, name: 'Agencia prueba', enabled: true }]), createSaleClient: vi.fn().mockResolvedValue(12), getSaleClient: vi.fn().mockResolvedValue({ id: 12, name: 'Ana', phone: '12345678' }), getSaleClients: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 1, totalCount: 0 }), updateSaleClient: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./sales-api', () => api);
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ request: requestMock }) }));
const requestMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => vi.fn() }));
vi.mock('../../shared/layout/page-actions-context', () => ({ usePageActions: () => ({ setHeading: vi.fn() }) }));
vi.mock('../../shared/ui/toast-context', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../shared/finance/exchange-rate-provider', () => ({ useExchangeRate: () => ({ storeRate: 36 }) }));
vi.mock('./sale-client-picker', () => ({ SaleClientPicker: ({ selectedClient }: { selectedClient: { name: string } | null }) => <div>{selectedClient?.name}</div> }));
vi.mock('./sale-global-discount-dialog', () => ({ SaleGlobalDiscountDialog: () => null }));
vi.mock('./sale-initial-payment', () => ({ SaleInitialPayment: () => null }));
vi.mock('./sale-product-lines', () => ({ SaleProductLines: ({ lines }: { lines: { productVariantId: number; availableQuantity: number }[] }) => lines.map((line) => <output key={line.productVariantId} aria-label={`Stock de variante ${line.productVariantId}`}>{line.availableQuantity}</output>) }));
vi.mock('./sale-product-picker', () => ({ SaleProductPicker: ({ onAdd, onImportCart }: { onAdd: (item: unknown) => void; onImportCart: () => void }) => <><button type="button" onClick={() => onAdd({ product: { name: 'Prenda', code: 10 }, variant: { id: 4, sizeName: 'M', availableQuantity: 2, salePrice: 100, discountedSalePrice: null, discountCampaignId: null }, presentationName: 'Azul', presentationVariants: [] })}>Prenda de prueba</button><button type="button" onClick={onImportCart}>Importar carrito</button></> }));

describe('crear venta con envío', () => {
  beforeEach(() => vi.clearAllMocks());
  it('asocia una clienta a la venta sin crear un envío y la conserva al quitarlo', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar o crear clienta' }));
    const clientDialog = screen.getByRole('dialog', { name: 'Buscar o crear clienta' });
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(clientDialog).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.click(within(clientDialog).getByRole('button', { name: 'Crear clienta' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar o crear clienta' })).not.toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Clienta (opcional)' })).getByText('Ana')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const delivery = screen.getByRole('dialog', { name: 'Crear envío' });
    expect(within(delivery).getByText('Ana')).toBeVisible();
    fireEvent.click(within(delivery).getByRole('button', { name: 'Editar clienta' }));
    const editor = within(screen.getByRole('dialog', { name: 'Editar clienta' }));
    fireEvent.change(await editor.findByLabelText('Nombre'), { target: { value: 'Ana María' } });
    fireEvent.click(editor.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(delivery).findByText('Ana María')).toBeVisible();
    expect(delivery).toBeInTheDocument();
    await waitFor(() => expect(within(delivery).getByRole('button', { name: 'Agencia de envío' })).toBeEnabled());
    fireEvent.change(within(delivery).getByLabelText('Código del envío'), { target: { value: 'ENV-1' } });
    fireEvent.click(within(delivery).getByRole('button', { name: 'Agencia de envío' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Agencia de envío' })).getByRole('option', { name: 'Agencia prueba' }));
    fireEvent.click(within(delivery).getByRole('button', { name: 'Crear envío' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar envío' }));
    expect(within(screen.getByRole('region', { name: 'Clienta (opcional)' })).getByText('Ana María')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    await waitFor(() => expect(api.createSale).toHaveBeenCalledWith(requestMock, expect.objectContaining({ clientId: 12 })));
  });

  it('conserva el formulario de clienta al cerrar las coincidencias con Escape', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar o crear clienta' }));
    const clientDialog = screen.getByRole('dialog', { name: 'Buscar o crear clienta' });
    const name = within(clientDialog).getByLabelText('Nombre *');
    fireEvent.change(name, { target: { value: 'Ana' } });
    fireEvent.click(within(clientDialog).getByRole('button', { name: 'Buscar clienta' }));
    const matches = await screen.findByRole('dialog', { name: 'Coincidencias de clientas' });
    fireEvent(matches, new Event('cancel', { cancelable: true }));
    expect(matches).not.toBeInTheDocument();
    expect(clientDialog).toBeInTheDocument();
    expect(name).toHaveValue('Ana');
  });

  it('asocia de inmediato una coincidencia sin cambios', async () => {
    const existing = { id: 22, name: 'Ana', phone: '12345678' };
    api.getSaleClients.mockResolvedValueOnce({ items: [existing], page: 1, totalPages: 1, totalCount: 1 });
    api.getSaleClient.mockResolvedValueOnce(existing);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar o crear clienta' }));
    const clientDialog = screen.getByRole('dialog', { name: 'Buscar o crear clienta' });
    fireEvent.change(within(clientDialog).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(clientDialog).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.click(within(clientDialog).getByRole('button', { name: 'Buscar clienta' }));
    const matches = await screen.findByRole('dialog', { name: 'Coincidencias de clientas' });
    fireEvent.click(within(matches).getByRole('button', { name: 'Seleccionar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar o crear clienta' })).not.toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Clienta (opcional)' })).getByText('Ana')).toBeVisible();
    expect(api.updateSaleClient).not.toHaveBeenCalled();
  });

  it('descarta la selección de clienta al cancelar el envío', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    expect(screen.queryByRole('button', { name: 'Crear clienta' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    let dialog = screen.getByRole('dialog', { name: 'Crear envío' });
    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(dialog).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear clienta' }));
    await within(dialog).findByText('Ana');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    dialog = screen.getByRole('dialog', { name: 'Crear envío' });
    expect(within(dialog).queryByText('Ana')).not.toBeInTheDocument();
  });

  it('resalta clientas bloqueadas y permite crear si solo coincide el nombre', async () => {
    const blocked = { id: 25, name: 'Ana', phone: '87654321', isBlocked: true, blockedReason: 'Cuenta bloqueada' };
    api.getSaleClients.mockImplementationOnce(async () => ({ items: [blocked], page: 1, totalPages: 1, totalCount: 1 }));
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const delivery = screen.getByRole('dialog', { name: 'Crear envío' });
    fireEvent.change(within(delivery).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(delivery).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.click(within(delivery).getByRole('button', { name: 'Crear clienta' }));
    const matches = await screen.findByRole('dialog', { name: 'Coincidencias de clientas' });
    expect(within(matches).getByText('Bloqueada')).toBeVisible();
    expect(within(matches).getByRole('button', { name: 'Seleccionar' })).toBeDisabled();
    fireEvent.click(within(matches).getByRole('button', { name: 'Crear clienta nueva' }));
    expect(await within(delivery).findByText('Ana')).toBeVisible();
  });

  it('impide crear si coincide un usuario de Instagram', async () => {
    const existing = { id: 26, name: 'Otra clienta', instagram: 'ana' };
    api.getSaleClients.mockImplementation(async (_request, query) => ({ items: query.instagramUser ? [existing] : [], page: 1, totalPages: 1, totalCount: query.instagramUser ? 1 : 0 }));
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const delivery = screen.getByRole('dialog', { name: 'Crear envío' });
    fireEvent.change(within(delivery).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(delivery).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.change(within(delivery).getByLabelText('Usuario de Instagram (opcional)'), { target: { value: 'ana' } });
    fireEvent.click(within(delivery).getByRole('button', { name: 'Crear clienta' }));
    const matches = await screen.findByRole('dialog', { name: 'Coincidencias de clientas' });
    expect(within(matches).queryByRole('button', { name: 'Crear clienta nueva' })).not.toBeInTheDocument();
    api.getSaleClients.mockReset().mockResolvedValue({ items: [], page: 1, totalPages: 1, totalCount: 0 });
  });

  it('busca coincidencias y actualiza solo los campos marcados', async () => {
    const existing = { id: 22, name: 'Ana anterior', phone: '12345678', address: 'Dirección anterior', isFriend: true, comments: 'Conservar nota' };
    api.getSaleClients.mockResolvedValueOnce({ items: [existing], page: 1, totalPages: 1, totalCount: 1 });
    api.getSaleClient.mockResolvedValueOnce(existing);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear envío' });
    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: 'Ana nueva' } });
    fireEvent.change(within(dialog).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.change(within(dialog).getByLabelText('Dirección (opcional)'), { target: { value: 'Dirección nueva' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear clienta' }));
    const matches = await screen.findByRole('dialog', { name: 'Coincidencias de clientas' });
    fireEvent.click(within(matches).getByRole('button', { name: 'Seleccionar' }));
    fireEvent.click(within(matches).getByRole('checkbox', { name: /Dirección/ }));
    fireEvent.click(within(matches).getByRole('button', { name: 'Usar esta clienta' }));
    await waitFor(() => expect(api.updateSaleClient).toHaveBeenCalledWith(requestMock, 22, expect.objectContaining({ name: 'Ana anterior', phoneNumber: '12345678', address: 'Dirección nueva', isFriend: true, comments: 'Conservar nota' })));
    expect(api.getSaleClients).toHaveBeenCalledWith(requestMock, expect.objectContaining({ name: 'Ana nueva', phoneNumber: '12345678' }));
    expect(within(dialog).getByText('Ana anterior')).toBeVisible();
  });

  it('envía los datos del envío y la fecha junto con la venta', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    render(<SaleCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Canal de venta' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Canal de venta' })).getByRole('option', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar envío' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear envío' });
    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(within(dialog).getByLabelText('Teléfono *'), { target: { value: '12345678' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear clienta' }));
    await within(dialog).findByText('Ana');
    expect(within(dialog).getByText('Ana')).toBeVisible();
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
    expect(screen.getByText('Total', { selector: 'dt' }).nextElementSibling).toHaveTextContent('US$4.17');
    expect(screen.getByText('Por pagar', { selector: 'dt' }).nextElementSibling).toHaveTextContent('US$4.17');
    const saleDate = screen.getByLabelText('Fecha de venta');
    fireEvent.change(saleDate, { target: { value: '31/02/2026' } });
    fireEvent.blur(saleDate);
    expect(saleDate).toBeInvalid();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    expect(api.createSale).not.toHaveBeenCalled();
    fireEvent.change(saleDate, { target: { value: '04/07/2026' } });
    fireEvent.blur(saleDate);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    await waitFor(() => expect(api.createSale).toHaveBeenCalledWith(requestMock, expect.objectContaining({ clientId: 12, saleDate: '2026-07-04T18:00:00.000Z', delivery: { code: 'ENV-1', deliveryAgencyId: 2, municipalityId: 1, shippingChargedToClient: 50 } })));
  });
});


it.each(['/compartir/selecciones', '/selecciones'])('importa desde %s, respeta el stock y conserva el borrador', async (route) => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.createSale.mockClear();
  const id = '01234567-89ab-cdef-0123-456789abcdef';
  api.getSharedSaleCart.mockResolvedValueOnce({
    items: [
      { variantId: 4, quantity: 2, name: 'Prenda', presentation: 'Azul', size: 'M' },
      { variantId: 5, quantity: 1, name: 'Falda', presentation: 'Negra', size: 'S' },
    ],
    products: [{
      name: 'Prenda',
      code: 10,
      presentations: [{
        id: 1, name: 'Azul',
        sizes: [{ id: 4, sizeName: 'M', availableQuantity: 2, salePrice: 100, discountedSalePrice: null, discountCampaignId: null }],
      }],
    }],
  });

  render(<SaleCreatePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
  fireEvent.click(screen.getByRole('button', { name: 'Importar carrito' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Importar carrito' }));
  fireEvent.change(dialog.getByLabelText('Enlace o ID del carrito'), {
    target: { value: `https://example.com${route}/${id}` },
  });
  fireEvent.click(dialog.getByRole('button', { name: 'Importar' }));

  expect(await screen.findByText('Se agregó 1 unidad del carrito.')).toBeVisible();
  expect(screen.getByText('Prenda · Azul · M: se agregaron 1 de 2 unidades solicitadas.')).toBeVisible();
  expect(screen.getByText('Falda · Negra · S: agotada o fuera del catálogo.')).toBeVisible();
  expect(screen.getByText('2 artículos')).toBeVisible();
  expect(api.getSharedSaleCart).toHaveBeenCalledWith(requestMock, id, expect.any(AbortSignal));
  expect(api.createSale).not.toHaveBeenCalled();
});

it.each(['Cancelar', 'Escape'])('cancela la importación con %s e ignora la respuesta tardía', async (action) => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  let resolveCart!: (result: { items: []; products: [] }) => void;
  api.getSharedSaleCart.mockReturnValueOnce(new Promise((resolve) => { resolveCart = resolve; }));

  render(<SaleCreatePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
  fireEvent.click(screen.getByRole('button', { name: 'Importar carrito' }));
  const modal = screen.getByRole('dialog', { name: 'Importar carrito' });
  fireEvent.change(within(modal).getByLabelText('Enlace o ID del carrito'), {
    target: { value: '01234567-89ab-cdef-0123-456789abcdef' },
  });
  fireEvent.click(within(modal).getByRole('button', { name: 'Importar' }));

  if (action === 'Escape') fireEvent(modal, new Event('cancel', { cancelable: true }));
  else fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));

  expect(modal).not.toBeInTheDocument();
  expect(api.getSharedSaleCart.mock.lastCall?.[2].aborted).toBe(true);
  await act(async () => resolveCart({ items: [], products: [] }));
  expect(screen.getByText('1 artículo')).toBeVisible();
  expect(screen.queryByText('No se agregaron prendas del carrito.')).not.toBeInTheDocument();
});


it.each([1, 0, null])('actualiza el stock (%s) de una prenda ya agregada aunque no importe unidades', async (stock) => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.getSharedSaleCart.mockResolvedValueOnce({
    items: [{ variantId: 4, quantity: 1, name: 'Prenda', presentation: 'Azul', size: 'M' }],
    products: stock === null ? [] : [{
      presentations: [{ sizes: [{ id: 4, availableQuantity: stock }] }],
    }],
  });

  render(<SaleCreatePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Prenda de prueba' }));
  expect(screen.getByLabelText('Stock de variante 4')).toHaveTextContent('2');

  fireEvent.click(screen.getByRole('button', { name: 'Importar carrito' }));
  const modal = within(screen.getByRole('dialog', { name: 'Importar carrito' }));
  fireEvent.change(modal.getByLabelText('Enlace o ID del carrito'), {
    target: { value: '01234567-89ab-cdef-0123-456789abcdef' },
  });
  fireEvent.click(modal.getByRole('button', { name: 'Importar' }));

  expect(await screen.findByText('No se agregaron prendas del carrito.')).toBeVisible();
  expect(screen.getByLabelText('Stock de variante 4')).toHaveTextContent(String(stock ?? 0));
  expect(screen.getByText('1 artículo')).toBeVisible();
});
