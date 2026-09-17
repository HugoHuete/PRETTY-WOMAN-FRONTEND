import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectControl } from './select-control';

describe('SelectControl', () => {
  it('renders the selected value with normal font weight', () => {
    const { container } = render(
      <SelectControl
        id="role"
        value="admin"
        options={[
          { value: 'admin', label: 'Admin' },
          { value: 'sales', label: 'Ventas' },
        ]}
        onChange={vi.fn()}
        aria-label="Seleccionar rol"
      />,
    );

    expect(container.querySelector('.pw-select-value')).toHaveClass('font-normal');
  });

  it('matches accented options when the search omits accents', async () => {
    const user = userEvent.setup();
    render(
      <SelectControl
        id="subcategory"
        value=""
        options={[
          { value: '', label: 'Selecciona una opción' },
          { value: 'pants', label: 'Pantalón' },
          { value: 'unique', label: 'Única' },
        ]}
        onChange={vi.fn()}
        aria-label="Subcategoría"
        searchable
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Subcategoría' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar subcategoría' }), 'pantalon');

    expect(within(screen.getByRole('listbox', { name: 'Subcategoría' })).getByRole('option', { name: 'Pantalón' })).toBeVisible();
  });

  it('notifies changes when selecting an option from the custom dropdown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectControl
        id="role"
        value=""
        options={[
          { value: "", label: "Selecciona un rol" },
          { value: "sales", label: "Ventas" },
        ]}
        onChange={onChange}
        aria-label="Rol"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Rol" }));
    await user.click(within(screen.getByRole("listbox", { name: "Rol" })).getByRole("option", { name: "Ventas" }));

    expect(onChange).toHaveBeenCalled();
  });
  it('can render its dropdown outside an overflow container', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="overflow-auto">
        <SelectControl
          id="issue-type"
          value=""
          options={[{ value: '', label: 'Selecciona un tipo' }, { value: 'damaged', label: 'Dañada' }]}
          onChange={vi.fn()}
          aria-label="Tipo de incidencia"
          portal
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Tipo de incidencia' }));

    expect(screen.getByRole('listbox', { name: 'Tipo de incidencia' })).toBeVisible();
    expect(screen.getByRole('listbox', { name: 'Tipo de incidencia' }).closest('.pw-select-control')).toBeNull();
    expect(container.querySelector('.pw-select-control')).toBeTruthy();
  });

  it('clears the search when focus leaves the control', async () => {
    const user = userEvent.setup();
    render(
      <SelectControl
        id="subcategory"
        value=""
        options={[
          { value: '', label: 'Selecciona una opción' },
          { value: 'pants', label: 'Pantalón' },
        ]}
        onChange={vi.fn()}
        aria-label="Subcategoría"
        searchable
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Subcategoría' });
    await user.click(trigger);
    await user.type(screen.getByRole('searchbox', { name: 'Buscar subcategoría' }), 'pantalon');
    fireEvent.blur(trigger, { relatedTarget: null });
    await user.click(trigger);

    expect(screen.getByRole('searchbox', { name: 'Buscar subcategoría' })).toHaveValue('');
  });

  it('focuses the search when opened with Enter', async () => {
    const user = userEvent.setup();
    render(
      <SelectControl
        id="subcategory"
        value=""
        options={[
          { value: '', label: 'Selecciona una opción' },
          { value: 'pants', label: 'Pantalón' },
        ]}
        onChange={vi.fn()}
        aria-label="Subcategoría"
        searchable
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Subcategoría' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('searchbox', { name: 'Buscar subcategoría' })).toHaveFocus();
  });

  it('focuses the search when opened with Space', async () => {
    render(
      <SelectControl
        id="subcategory"
        value=""
        options={[
          { value: '', label: 'Selecciona una opción' },
          { value: 'pants', label: 'Pantalón' },
        ]}
        onChange={vi.fn()}
        aria-label="Subcategoría"
        searchable
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Subcategoría' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: ' ', code: 'Space' });

    expect(await screen.findByRole('searchbox', { name: 'Buscar subcategoría' })).toHaveFocus();
  });
}); 
