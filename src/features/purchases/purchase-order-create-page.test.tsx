import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../shared/layout/app-shell';
import { ExchangeRateProvider } from '../../shared/finance/exchange-rate-provider';
import { PurchaseOrderCreatePage } from './purchase-order-create-page';

const auth = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../auth/auth-provider', () => ({
  useAuth: () => ({ request: auth.request, status: 'authenticated' }),
}));

const suppliers = [{ id: 7, name: 'SOHO', enabled: true }];
const searchableSuppliers = [
  ...suppliers,
  { id: 8, name: 'Shein', enabled: true },
  { id: 9, name: 'Mercado', enabled: true },
];
const subcategories = [
  { id: 4, name: 'Vestidos' },
  { id: 5, name: 'Blusas' },
];
const sizes = [
  { id: 12, name: 'M' },
  { id: 13, name: 'XL' },
];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function renderCreateOrder() {
  return render(
    <MemoryRouter initialEntries={['/purchases/orders/new']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/purchases/orders/new" element={<ExchangeRateProvider><PurchaseOrderCreatePage /></ExchangeRateProvider>} />
          <Route path="/purchases/orders/:id" element={<p>Detalle de orden</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => auth.request.mockReset());

describe('PurchaseOrderCreatePage', () => {
  it('opens the CSV importer in a modal with delimiter choices and a drop zone', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));

    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    expect(within(dialog).getByRole('radio', { name: 'Punto y coma (;)' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Coma (,)' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Zona para soltar el archivo CSV' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Descargar plantilla' })).toBeVisible();
  });

  it('closes the CSV importer with Escape and traps focus inside the dialog', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    const importButton = screen.getByRole('button', { name: 'Importar CSV' });
    await user.click(importButton);

    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    const closeButton = within(dialog).getByRole('button', { name: 'Cerrar importación CSV' });
    within(dialog).getByRole('button', { name: 'Cancelar' }).focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Importar productos desde CSV' })).not.toBeInTheDocument();
    expect(importButton).toHaveFocus();
  });

  it('shows the exchange-rate error and allows retrying before submission', async () => {
    const user = userEvent.setup();
    let exchangeRateRequests = 0;
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') {
        exchangeRateRequests += 1;
        return exchangeRateRequests === 1
          ? jsonResponse({ detail: 'La tasa bancaria no está disponible.' }, 503)
          : jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' });
      }
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    expect(screen.getByRole('alert')).toHaveTextContent('La tasa bancaria no está disponible.');
    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    await user.click(retryButton);

    expect(await screen.findByLabelText('Tasa de cambio')).toHaveValue('C$ 36.62 por $1');
    expect(exchangeRateRequests).toBe(2);
  });

  it('validates presentation names when a product has multiple presentations', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.click(screen.getByRole('button', { name: '+ Agregar presentación' }));
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));

    expect(screen.getByLabelText('Presentación 1 del producto 1').parentElement).toHaveTextContent('Ingresa el nombre de la presentación.');
    expect(screen.getByLabelText('Presentación 2 del producto 1').parentElement).toHaveTextContent('Ingresa el nombre de la presentación.');
    expect(auth.request.mock.calls.filter(([url, init]) => url === '/api/v1/orders' && init?.method === 'POST')).toHaveLength(0);
  });

  it('rejects duplicate presentation names before submitting', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Presentación 1 del producto 1'), 'Azul');
    await user.click(screen.getByRole('button', { name: '+ Agregar presentación' }));
    await user.type(screen.getByLabelText('Presentación 2 del producto 1'), 'Azul');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));

    expect(screen.getByLabelText('Presentación 1 del producto 1').parentElement).toHaveTextContent('El nombre de la presentación debe ser único dentro del producto.');
    expect(screen.getByLabelText('Presentación 2 del producto 1').parentElement).toHaveTextContent('El nombre de la presentación debe ser único dentro del producto.');
    expect(screen.getByLabelText('Presentación 1 del producto 1')).toHaveAttribute('maxlength', '50');
    expect(screen.getByLabelText('Presentación 2 del producto 1')).toHaveAttribute('maxlength', '50');
  });

  it('rejects oversized CSV files before reading or parsing them', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    const file = new File(['contenido'], 'archivo-grande.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    await user.upload(within(dialog).getByLabelText('Archivo CSV de productos'), file);

    expect(await within(dialog).findByText('El archivo CSV no puede superar los 5 MB.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Aplicar importación' })).toBeDisabled();
  });

  it('previews and applies products imported from a CSV file', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    await user.click(within(dialog).getByRole('radio', { name: 'Coma (,)' }));
    await user.upload(
      within(dialog).getByLabelText('Archivo CSV de productos'),
      new File(
        ['codigoProveedor,nombre,subcategoria,presentacion,talla,cantidad,costoUnitario\nSOHO-25120,Vestido satinado,Vestidos,Azul,M,3,8.50'],
        'productos.csv',
        { type: 'text/csv' },
      ),
    );

    expect(await within(dialog).findByText('1 producto listo para importar')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar importación' }));

    expect(screen.getByLabelText('Código proveedor del producto 1')).toHaveValue('SOHO-25120');
    expect(screen.getByLabelText('Nombre del producto 1')).toHaveValue('Vestido satinado');
    expect(screen.getByRole('button', { name: 'Subcategoría del producto 1' })).toHaveTextContent('Vestidos');
    expect(screen.getByLabelText('Presentación 1 del producto 1')).toHaveValue('Azul');
    expect(screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' })).toHaveTextContent('M');
    expect(screen.getByLabelText('Cantidad 1 de la presentación 1 del producto 1')).toHaveValue(3);
    expect(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1')).toHaveValue('8.50');
  });

  it('reports invalid catalog values from a CSV without changing the order', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    await user.click(within(dialog).getByRole('radio', { name: 'Coma (,)' }));
    await user.upload(
      within(dialog).getByLabelText('Archivo CSV de productos'),
      new File(
        ['codigoProveedor,nombre,subcategoria,presentacion,talla,cantidad,costoUnitario\nSOHO-25120,Vestido satinado,Vestidos,Azul,XXL,3,8.50'],
        'productos-invalidos.csv',
        { type: 'text/csv' },
      ),
    );

    expect(await within(dialog).findByText('Fila 2: La talla "XXL" no existe en el catálogo.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Aplicar importación' })).toBeDisabled();
    expect(screen.queryByLabelText('Código proveedor del producto 1')).not.toBeInTheDocument();
  });

  it('accepts a dropped CSV using the selected semicolon delimiter', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    await user.click(within(dialog).getByRole('radio', { name: 'Punto y coma (;)' }));
    const file = new File(
      ['codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-25120;Vestido satinado;Vestidos;Azul;M;3;8.50'],
      'productos-separados.csv',
      { type: 'text/csv' },
    );
    fireEvent.drop(within(dialog).getByRole('button', { name: 'Zona para soltar el archivo CSV' }), {
      dataTransfer: { files: [file] },
    });

    expect(await within(dialog).findByText('1 producto listo para importar')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar importación' }));
    expect(screen.getByLabelText('Código proveedor del producto 1')).toHaveValue('SOHO-25120');
  });

  it('imports accented catalog values from a Windows-1252 CSV', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse([{ id: 6, name: 'Pantalón casual' }, ...subcategories]);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    const csv = 'codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-25120;Vestido satinado;Pantalón casual;Azul;M;3;8.50';
    const windows1252Bytes = Uint8Array.from([...csv].map((character) => character.charCodeAt(0)));
    await user.upload(
      within(dialog).getByLabelText('Archivo CSV de productos'),
      new File([windows1252Bytes], 'productos-con-acentos.csv', { type: 'text/csv' }),
    );

    expect(await within(dialog).findByText('1 producto listo para importar')).toBeVisible();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('loads catalog options and starts with an empty product state', async () => {
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') return jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' });
      return jsonResponse({});
    });

    renderCreateOrder();

    expect(await screen.findByRole('heading', { name: 'Nueva orden de compra' })).toBeVisible();
    expect(await screen.findByText('Agrega el primer producto')).toBeVisible();
    expect(screen.queryByText('Registra cada producto y sus tallas antes de confirmar la compra.')).not.toBeInTheDocument();
    expect(screen.queryByText('La tasa de cambio y los totales definitivos los calcula el backend con la tasa bancaria vigente.')).not.toBeInTheDocument();
    expect(auth.request).toHaveBeenCalledWith('/api/v1/suppliers');
    expect(auth.request).toHaveBeenCalledWith('/api/v1/subcategories');
    expect(auth.request).toHaveBeenCalledWith('/api/v1/sizes');
  });

  it('uses the reusable dropdown for the purchase currency', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');

    const currencyTrigger = screen.getByRole('button', { name: 'Moneda de compra' });
    expect(currencyTrigger).toHaveTextContent('USD');
    await user.click(currencyTrigger);
    const listbox = screen.getByRole('listbox', { name: 'Moneda de compra' });
    await user.click(within(listbox).getByRole('option', { name: 'C$ — compra local' }));

    expect(currencyTrigger).toHaveTextContent('C$ — compra local');
  });

  it('builds the backend payload and navigates to the created order', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/orders' && init?.method === 'POST') return jsonResponse(73, 201);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');

    await user.selectOptions(screen.getByRole('combobox', { name: /Proveedor/ }), '7');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Código proveedor del producto 1'), 'SOHO-25120');
    await user.type(screen.getByLabelText('Nombre del producto 1'), 'Vestido satinado');
    await user.click(screen.getByRole('button', { name: 'Subcategoría del producto 1' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Subcategoría del producto 1' })).getByRole('option', { name: 'Vestidos' }));
    await user.type(screen.getByLabelText('Presentación 1 del producto 1'), 'Azul');
    await user.click(screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Talla 1 de la presentación 1 del producto 1' })).getByRole('option', { name: 'M' }));
    await user.clear(screen.getByLabelText('Cantidad 1 de la presentación 1 del producto 1'));
    await user.type(screen.getByLabelText('Cantidad 1 de la presentación 1 del producto 1'), '3');
    await user.clear(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1'));
    await user.type(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1'), '8.50');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));

    await waitFor(() => expect(auth.request).toHaveBeenCalledWith('/api/v1/orders', expect.objectContaining({ method: 'POST' })));
    const createCall = auth.request.mock.calls.find(([url, requestInit]) => url === '/api/v1/orders' && requestInit?.method === 'POST');
    expect(createCall).toBeDefined();
    const init = createCall?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      supplierId: 7,
      purchaseCurrencyId: 1,
      products: [
        {
          supplierProductCode: 'SOHO-25120',
          name: 'Vestido satinado',
          subcategoryId: 4,
          presentations: [
            {
              name: 'Azul',
              sortOrder: 0,
              sizes: [{ sizeId: 12, quantity: 3, unitCost: 8.5 }],
            },
          ],
        },
      ],
    });
    expect(JSON.parse(String(init.body)).products[0].presentations[0].sizes[0]).not.toHaveProperty('salePrice');
    expect(await screen.findByText('Detalle de orden')).toBeVisible();
  });

  it('does not ask for sale price or margin when creating an order', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(screen.queryByLabelText('Precio de venta 1 de la presentación 1 del producto 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Margen 1 de la presentación 1 del producto 1')).not.toBeInTheDocument();
  });

  it('searches suppliers from the reusable dropdown', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(searchableSuppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Proveedor' }));
    const search = await screen.findByRole('searchbox', { name: 'Buscar proveedor' });
    await user.type(search, 'shein');

    const listbox = screen.getByRole('listbox', { name: 'Proveedor' });
    expect(within(listbox).getByRole('option', { name: 'Shein' })).toBeVisible();
    expect(within(listbox).queryByRole('option', { name: 'SOHO' })).not.toBeInTheDocument();
  });

  it('uses the reusable dropdown for subcategories without a placeholder product title', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(screen.queryByRole('heading', { name: 'Producto nuevo' })).not.toBeInTheDocument();
    const subcategoryTrigger = screen.getByRole('button', { name: 'Subcategoría del producto 1' });
    await user.click(subcategoryTrigger);
    const subcategorySearch = screen.getByRole('searchbox', { name: 'Buscar subcategoría del producto 1' });
    await user.type(subcategorySearch, 'vest');
    const listbox = screen.getByRole('listbox', { name: 'Subcategoría del producto 1' });
    await user.click(within(listbox).getByRole('option', { name: 'Vestidos' }));

    expect(subcategoryTrigger).toHaveTextContent('Vestidos');
  });

  it('places the add-size action beside the presentation name', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const presentationName = screen.getByLabelText('Presentación 1 del producto 1');
    const presentationSection = presentationName.closest('section');
    expect(presentationSection).not.toBeNull();
    const addSizeButton = within(presentationSection as HTMLElement).getByRole('button', { name: '+ Agregar talla' });
    expect(addSizeButton).toBeVisible();
    expect(screen.getAllByRole('button', { name: '+ Agregar talla' })).toHaveLength(1);
    const firstSizeTrigger = screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' });
    expect(addSizeButton.compareDocumentPosition(firstSizeTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(addSizeButton);
    expect(screen.getByRole('button', { name: 'Talla 2 de la presentación 1 del producto 1' })).toBeVisible();
  });

  it('allows each presentation to be duplicated or removed with compact actions', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(screen.getByRole('button', { name: 'Duplicar presentación 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Eliminar presentación 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Duplicar presentación 1' }));

    expect(screen.getByLabelText('Presentación 2 del producto 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Eliminar presentación 2' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Eliminar presentación 2' }));
    expect(screen.queryByLabelText('Presentación 2 del producto 1')).not.toBeInTheDocument();
  });

  it('keeps the presentation actions at the same fixed height', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const presentationSection = screen.getByLabelText('Presentación 1 del producto 1').closest('section');
    expect(presentationSection).not.toBeNull();
    const actions = [
      within(presentationSection as HTMLElement).getByRole('button', { name: '+ Agregar talla' }),
      within(presentationSection as HTMLElement).getByRole('button', { name: 'Duplicar presentación 1' }),
      within(presentationSection as HTMLElement).getByRole('button', { name: 'Eliminar presentación 1' }),
    ];

    actions.forEach((action) => expect(action).toHaveClass('h-11'));
  });

  it('places the add-presentation action in the product header', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const productHeader = screen.getByRole('button', { name: 'Contraer producto 1' }).closest('header');
    expect(productHeader).not.toBeNull();
    const addPresentationButton = screen.getByRole('button', { name: '+ Agregar presentación' });
    expect(within(productHeader as HTMLElement).getByRole('button', { name: '+ Agregar presentación' })).toBeVisible();
    expect(addPresentationButton.compareDocumentPosition(screen.getByLabelText('Presentación 1 del producto 1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(addPresentationButton);
    expect(screen.getByLabelText('Presentación 2 del producto 1')).toBeVisible();
  });

  it('shows the supplier shipping amount with a dollar prefix', async () => {
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');

    const shippingField = screen.getByLabelText('Envío proveedor a bodega');
    expect(shippingField.parentElement).toHaveTextContent('$');
  });

  it('formats editable monetary amounts with thousands separators after editing', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') return jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' });
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.type(screen.getByLabelText('Envío proveedor a bodega'), '1234.5');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1'), '5678.9');
    await user.click(screen.getByRole('heading', { name: 'Productos de la orden' }));

    expect(screen.getByLabelText('Envío proveedor a bodega')).toHaveValue('1,234.50');
    expect(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1')).toHaveValue('5,678.90');
    const equivalentInput = screen.getByLabelText('Monto en C$ 1 de la presentación 1 del producto 1') as HTMLInputElement;
    expect(equivalentInput.value).toMatch(/^\d{1,3}(,\d{3})+\.\d{2}$/);
  });

  it('only separates the total row in the estimated summary', async () => {
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');

    const summary = screen.getByRole('heading', { name: 'Resumen estimado' }).parentElement;
    const summaryList = summary?.querySelector('dl');
    expect(summaryList).not.toHaveClass('divide-y');
    expect(summaryList?.querySelectorAll(':scope > div')).toHaveLength(6);
    expect(summaryList?.querySelectorAll(':scope > div.border-t')).toHaveLength(1);
  });

  it('shows merchandise in the purchase currency and both purchase totals', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') return jsonResponse({ bankRate: 37, storeRate: 37.1, startDate: '2026-09-12' });
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Moneda de compra' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Moneda de compra' })).getByRole('option', { name: 'C$ — compra local' }));
    await user.type(screen.getByLabelText('Envío proveedor a bodega'), '10');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1'), '1000');
    await user.click(screen.getByRole('heading', { name: 'Productos de la orden' }));

    const summary = screen.getByRole('heading', { name: 'Resumen estimado' }).parentElement as HTMLElement;
    expect(within(summary).getByText('Mercadería').parentElement).toHaveTextContent('C$ 1,000.00');
    expect(within(summary).getByText('Envío proveedor').parentElement).toHaveTextContent('$ 10.00');
    expect(within(summary).getByText('Total compra').parentElement).toHaveTextContent('$ 37.03');
    expect(within(summary).getByText('Total compra').parentElement).toHaveTextContent('C$ 1,370.00');
  });

  it('collapses and expands presentation sizes independently', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const collapseButton = screen.getByRole('button', { name: 'Contraer presentación 1 del producto 1' });
    expect(screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' })).toBeVisible();
    await user.click(collapseButton);

    expect(screen.getByRole('button', { name: 'Expandir presentación 1 del producto 1' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expandir presentación 1 del producto 1' }));
    expect(screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' })).toBeVisible();
  });

  it('uses the searchable reusable dropdown for sizes', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const sizeTrigger = screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' });
    await user.click(sizeTrigger);
    const sizeSearch = screen.getByRole('searchbox', { name: 'Buscar talla 1 de la presentación 1 del producto 1' });
    await user.type(sizeSearch, 'xl');
    const listbox = screen.getByRole('listbox', { name: 'Talla 1 de la presentación 1 del producto 1' });
    expect(within(listbox).getByRole('option', { name: 'XL' })).toBeVisible();
    expect(within(listbox).queryByRole('option', { name: 'M' })).not.toBeInTheDocument();
  });

  it('shows the unit cost equivalent in córdobas using the bank rate', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') return jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' });
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    const exchangeRateInput = await screen.findByLabelText('Tasa de cambio');
    expect(exchangeRateInput).toHaveValue('C$ 36.62 por $1');
    expect(exchangeRateInput).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    const costInput = screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1');
    await user.clear(costInput);
    await user.type(costInput, '8.50');
    expect(costInput.parentElement).toHaveTextContent('$');

    const equivalentInput = await screen.findByLabelText('Monto en C$ 1 de la presentación 1 del producto 1');
    expect(equivalentInput).toHaveValue('311.27');
    expect(equivalentInput).toHaveAttribute('readonly');
    expect(equivalentInput.parentElement).toHaveTextContent('C$');

    await user.click(screen.getByRole('button', { name: 'Moneda de compra' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Moneda de compra' })).getByRole('option', { name: 'C$ — compra local' }));
    expect(costInput.parentElement).toHaveTextContent('C$');
    expect(equivalentInput).toHaveValue('8.50');
  });

  it('shows local-currency equivalents while the exchange rate is unavailable', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      if (url === '/api/v1/exchange-rates/current') return jsonResponse({ detail: 'Tasa no disponible.' }, 503);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Moneda de compra' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Moneda de compra' })).getByRole('option', { name: 'C$ — compra local' }));
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    const costInput = screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1');
    await user.type(costInput, '125.50');

    expect(screen.getByLabelText('Monto en C$ 1 de la presentación 1 del producto 1')).toHaveValue('125.50');
  });

  it('blocks CSV products that conflict with products already in the order', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));
    await user.type(screen.getByLabelText('Código proveedor del producto 1'), 'SOHO-EXISTING');
    await user.type(screen.getByLabelText('Nombre del producto 1'), 'Vestido existente');
    await user.click(screen.getByRole('button', { name: 'Subcategoría del producto 1' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Subcategoría del producto 1' })).getByRole('option', { name: 'Vestidos' }));
    await user.click(screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Talla 1 de la presentación 1 del producto 1' })).getByRole('option', { name: 'M' }));
    await user.type(screen.getByLabelText('Costo unitario 1 de la presentación 1 del producto 1'), '8.50');
    await user.click(screen.getByRole('button', { name: 'Importar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Importar productos desde CSV' });
    await user.upload(
      within(dialog).getByLabelText('Archivo CSV de productos'),
      new File(
        ['codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-EXISTING;Vestido existente;Vestidos;Azul;M;1;8.50'],
        'productos-duplicados.csv',
        { type: 'text/csv' },
      ),
    );

    expect(await within(dialog).findByText('El código del proveedor "SOHO-EXISTING" ya existe en la orden.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Aplicar importación' })).toBeDisabled();
  });

  it('duplicates and removes size rows with compact actions', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const sizeTrigger = screen.getByRole('button', { name: 'Talla 1 de la presentación 1 del producto 1' });
    await user.click(sizeTrigger);
    await user.click(within(screen.getByRole('listbox', { name: 'Talla 1 de la presentación 1 del producto 1' })).getByRole('option', { name: 'M' }));
    await user.clear(screen.getByLabelText('Cantidad 1 de la presentación 1 del producto 1'));
    await user.type(screen.getByLabelText('Cantidad 1 de la presentación 1 del producto 1'), '4');

    expect(screen.getByRole('button', { name: 'Eliminar talla 1 de la presentación 1 del producto 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Duplicar talla 1 de la presentación 1 del producto 1' }));

    expect(screen.getByRole('button', { name: 'Talla 2 de la presentación 1 del producto 1' })).toHaveTextContent('M');
    expect(screen.getByLabelText('Cantidad 2 de la presentación 1 del producto 1')).toHaveValue(4);
    await user.click(screen.getByRole('button', { name: 'Eliminar talla 2 de la presentación 1 del producto 1' }));
    expect(screen.queryByRole('button', { name: 'Talla 2 de la presentación 1 del producto 1' })).not.toBeInTheDocument();
  });

  it('shows validation feedback without calling the API when required data is missing', async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation((url: string) => {
      if (url === '/api/v1/suppliers') return jsonResponse(suppliers);
      if (url === '/api/v1/subcategories') return jsonResponse(subcategories);
      if (url === '/api/v1/sizes') return jsonResponse(sizes);
      return jsonResponse({});
    });

    renderCreateOrder();
    await screen.findByText('Agrega el primer producto');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));

    expect(await screen.findByText('Revisa los datos de la compra')).toHaveTextContent('Revisa los datos de la compra');
    expect(within(screen.getByRole('alert', { name: 'Revisa los datos de la compra' })).getByText('Selecciona un proveedor.')).toBeVisible();
    expect(auth.request.mock.calls.filter(([url, init]) => url === '/api/v1/orders' && init?.method === 'POST')).toHaveLength(0);
  });
});
