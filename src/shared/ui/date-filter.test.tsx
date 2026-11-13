import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateFilter } from './date-filter';

describe('filtro de fecha', () => {
  it('muestra día/mes/año y envía la fecha ISO al confirmar', () => {
    const onChange = vi.fn();
    render(<DateFilter id="fecha" value="2026-11-13" onChange={onChange} />);
    const input = screen.getByPlaceholderText('dd/mm/aaaa');
    expect(input).toHaveValue('13/11/2026');
    fireEvent.change(input, { target: { value: '05/07/2025' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2025-07-05');
    fireEvent.change(input, { target: { value: '31/02/2026' } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha no se aplicó');
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('');
  });
  it('permite seleccionar una fecha y cerrar el calendario con Escape', () => {
    const onChange = vi.fn();
    render(<DateFilter id="fecha" value="2026-11-13" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    expect(screen.getByRole('dialog', { name: 'Calendario' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /14 de noviembre de 2026/ }));
    expect(onChange).toHaveBeenCalledWith('2026-11-14');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Calendario' })).not.toBeInTheDocument();
  });
  it('permite reemplazar el año completo y enfoca el calendario al abrir', () => {
    const onChange = vi.fn();
    render(<DateFilter id="fecha" value="2026-11-13" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Abrir calendario' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: /13 de noviembre de 2026/ })).toHaveFocus();
    const year = screen.getByRole('spinbutton', { name: 'Año' });
    fireEvent.change(year, { target: { value: '' } });
    expect(year).toHaveValue(null);
    fireEvent.change(year, { target: { value: '2030' } });
    fireEvent.blur(year);
    expect(screen.getByRole('button', { name: /13 de noviembre de 2030/ })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
  it('restablece un texto inválido aunque el valor aplicado siga vacío', () => {
    const onChange = vi.fn();
    const view = render(<DateFilter id="fecha" value="" resetKey={0} onChange={onChange} />);
    const input = screen.getByPlaceholderText('dd/mm/aaaa');
    fireEvent.change(input, { target: { value: '31/02/2026' } });
    fireEvent.blur(input);
    view.rerender(<DateFilter id="fecha" value="" resetKey={1} onChange={onChange} />);
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });
  it('limita la altura del calendario y permite desplazarse dentro', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 180, bottom: 220, right: 300 } as DOMRect);
    render(<DateFilter id="fecha" value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    const dialog = screen.getByRole('dialog', { name: 'Calendario' });
    expect(dialog).toHaveStyle({ maxHeight: '164px' });
    fireEvent.scroll(dialog);
    expect(dialog).toBeVisible();
    rect.mockRestore(); vi.restoreAllMocks();
  });
});
