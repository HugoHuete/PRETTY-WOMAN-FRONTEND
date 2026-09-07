import { describe, expect, it } from 'vitest';
import { getVisibleNavigation } from './app-navigation';

describe('getVisibleNavigation', () => {
  it('shows operational links but hides admin-only groups for Employee', () => {
    const labels = getVisibleNavigation(['Employee'])
      .flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toEqual(
      expect.arrayContaining([
        'Resumen',
        'Clientes',
        'Ventas',
        'Envíos',
        'Reservas',
        'Productos',
        'Incidencias',
      ]),
    );
    expect(labels).not.toEqual(
      expect.arrayContaining(['Usuarios', 'Finanzas', 'Compras', 'Campañas']),
    );
  });

  it('shows every group available to Admin', () => {
    expect(getVisibleNavigation(['Admin']).map((group) => group.label)).toEqual([
      'Operación',
      'Inventario',
      'Administración',
    ]);

    const labels = getVisibleNavigation(['Admin'])
      .flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(
      expect.arrayContaining([
        'Envíos',
        'Reservas',
        'Compras',
        'Campañas',
        'Finanzas',
        'Usuarios',
      ]),
    );

    const campaign = getVisibleNavigation(['Admin'])
      .flatMap((group) => group.items)
      .find((item) => item.label === 'Campañas');
    expect(campaign?.to).toBe('/discounts/campaigns');
  });
});
