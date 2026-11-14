import { describe, expect, it } from 'vitest';
import { dateWithCurrentManaguaTime } from './current-time';

describe('fecha con hora actual', () => {
  it('combina el día elegido con la hora actual de Nicaragua', () => {
    expect(dateWithCurrentManaguaTime('2026-10-11', new Date('2026-11-14T03:23:45.000Z'))).toBe('2026-10-12T03:23:45.000Z');
  });
});
