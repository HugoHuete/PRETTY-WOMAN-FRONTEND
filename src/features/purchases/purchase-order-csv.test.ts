import { describe, expect, it } from 'vitest';
import { parsePurchaseOrderCsv } from './purchase-order-csv';

const catalog = {
  subcategories: [{ id: 4, name: 'Vestidos' }],
  sizes: [{ id: 12, name: 'M' }],
};

describe('parsePurchaseOrderCsv', () => {
  it('rejects rows that reuse a supplier code with different product data', () => {
    const result = parsePurchaseOrderCsv(
      'codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-1;Vestido;Vestidos;Azul;M;1;8.50\nSOHO-1;Blusa;Vestidos;Azul;M;1;8.50',
      catalog,
      ';',
    );

    expect(result.errors).toContain('Fila 3: El código del proveedor "SOHO-1" no puede tener nombres o subcategorías diferentes en el mismo archivo.');
    expect(result.products).toHaveLength(1);
  });

  it('rejects an unterminated quoted CSV field', () => {
    const result = parsePurchaseOrderCsv(
      'codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-1;"Vestido;Vestidos;Azul;M;1;8.50',
      catalog,
      ';',
    );

    expect(result.errors).toContain('El archivo CSV contiene un campo entre comillas sin cerrar.');
    expect(result.products).toHaveLength(0);
  });

  it('rejects a CSV that only contains the header row', () => {
    const result = parsePurchaseOrderCsv(
      'codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario',
      catalog,
      ';',
    );

    expect(result.errors).toContain('El archivo CSV no contiene filas de productos.');
    expect(result.rowCount).toBe(0);
    expect(result.products).toHaveLength(0);
  });

  it('rejects presentation names longer than the backend limit', () => {
    const longPresentationName = 'A'.repeat(51);
    const result = parsePurchaseOrderCsv(
      'codigoProveedor;nombre;subcategoria;presentacion;talla;cantidad;costoUnitario\nSOHO-1;Vestido;Vestidos;' + longPresentationName + ';M;1;8.50',
      catalog,
      ';',
    );

    expect(result.errors).toContain('Fila 2: El nombre de la presentación no puede tener más de 50 caracteres.');
    expect(result.products).toHaveLength(0);
  });
}); 
