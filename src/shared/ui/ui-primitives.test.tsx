import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EmptyState,
  ErrorState,
  PermissionDeniedState,
} from './screen-state';
import { LoadingButton } from './loading-button';
import { StatusBadge } from './status-badge';
import { ConfirmDialog } from './confirm-dialog';
import { useToast } from './toast-context';
import { ToastProvider } from './toast-provider';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Eliminar venta
      </button>
      <ConfirmDialog
        open={open}
        title="Eliminar venta"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function PendingDialogHarness() {
  return (
    <ConfirmDialog
      open
      isPending
      title="Deshabilitar usuario"
      description="Actualizando el estado de la cuenta."
      confirmLabel="Deshabilitar"
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  );
}

function ToastHarness({ detail }: { detail: string }) {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() => showToast({ tone: 'error', title: 'Error', detail })}
    >
      Mostrar error
    </button>
  );
}

describe('shared UI primitives', () => {
  it('pairs status text with supplied icon content', () => {
    render(
      <StatusBadge tone="success" icon={<span aria-hidden="true">✓</span>}>
        Disponible
      </StatusBadge>,
    );

    expect(screen.getByText('Disponible')).toBeVisible();
    expect(screen.getByText('✓')).toBeVisible();
  });

  it('announces an error state and exposes retry action', () => {
    const retry = vi.fn();
    render(<ErrorState title="No se pudo cargar" onRetry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('disables a loading button while retaining its accessible name', () => {
    render(<LoadingButton isLoading>Cargar productos</LoadingButton>);

    expect(
      screen.getByRole('button', { name: 'Cargar productos' }),
    ).toBeDisabled();
  });

  it('renders empty and permission states with clear headings', () => {
    render(
      <>
        <EmptyState
          title="No hay productos"
          description="Prueba con otro filtro."
        />
        <PermissionDeniedState />
      </>,
    );

    expect(
      screen.getByRole('heading', { name: 'No hay productos' }),
    ).toBeVisible();
    expect(
      screen.getByText('No tienes permiso para ver esta sección.'),
    ).toBeVisible();
  });

  it('closes a dialog with Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Eliminar venta' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps a pending dialog open and traps focus while actions are disabled', async () => {
    const user = userEvent.setup();
    render(<PendingDialogHarness />);
    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog).toBeVisible();
    await user.tab();
    expect(dialog).toHaveFocus();
  });

  it('renders API error detail in a toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness detail="La venta ya fue cancelada." />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Mostrar error' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La venta ya fue cancelada.',
    );
  });
});
