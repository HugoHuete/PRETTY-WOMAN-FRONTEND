import { describe, expect, it } from 'vitest';
import { saleDateForApi, todayInManagua } from './sale-date';

describe('fecha de venta', () => {
  it('usa el día de Nicaragua y conserva la hora actual al vender hoy', () => {
    const now = new Date('2026-11-14T03:00:00Z');
    expect(todayInManagua(now)).toBe('2026-11-13');
    expect(saleDateForApi('2026-11-13', now)).toBe('2026-11-14T03:00:00.000Z');
  });
  it('sitúa las fechas históricas al mediodía de Nicaragua', () => {
    expect(saleDateForApi('2026-07-04', new Date('2026-11-14T03:00:00Z'))).toBe('2026-07-04T18:00:00.000Z');
    expect(saleDateForApi('', new Date())).toBeNull();
    expect(saleDateForApi('2026-02-30', new Date())).toBeNull();
  });
});
