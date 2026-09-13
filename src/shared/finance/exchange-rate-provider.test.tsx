import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExchangeRateProvider, convertToCordobas, useExchangeRate } from './exchange-rate-provider';

const auth = vi.hoisted(() => ({
  request: vi.fn(),
  status: 'authenticated' as const,
}));

vi.mock('../../features/auth/auth-provider', () => ({
  useAuth: () => auth,
}));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function RateProbe() {
  const { bankRate, status, error, refresh } = useExchangeRate();
  return <><output>{error ?? `${status}:${bankRate ?? 'sin tasa'}`}</output><button onClick={() => void refresh()}>Actualizar</button></>;
}

afterEach(() => auth.request.mockReset());

describe('ExchangeRateProvider', () => {
  it('loads the current rate once and shares bankRate with consumers', async () => {
    auth.request.mockReturnValue(jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' }));

    const { rerender } = render(
      <ExchangeRateProvider>
        <RateProbe />
      </ExchangeRateProvider>,
    );

    expect(await screen.findByText('ready:36.62')).toBeVisible();
    rerender(
      <ExchangeRateProvider>
        <RateProbe />
      </ExchangeRateProvider>,
    );

    await waitFor(() => expect(auth.request).toHaveBeenCalledTimes(1));
  });

  it('exposes an error when the current rate cannot be loaded', async () => {
    auth.request.mockReturnValue(jsonResponse({ detail: 'No existe una tasa vigente.' }, 404));

    render(
      <ExchangeRateProvider>
        <RateProbe />
      </ExchangeRateProvider>,
    );

    expect(await screen.findByText('No existe una tasa vigente.')).toBeVisible();
  });

  it('allows refresh to retry after a failed request settles', async () => {
    const user = userEvent.setup();
    auth.request
      .mockReturnValueOnce(jsonResponse({ detail: 'Error temporal.' }, 503))
      .mockReturnValueOnce(jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' }));

    render(
      <ExchangeRateProvider>
        <RateProbe />
      </ExchangeRateProvider>,
    );

    expect(await screen.findByText('Error temporal.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByText('ready:36.62')).toBeVisible();
    expect(auth.request).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests for the current rate', async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    auth.request.mockReturnValue(new Promise<Response>((resolve) => { resolveRequest = resolve; }));

    render(
      <ExchangeRateProvider>
        <RateProbe />
      </ExchangeRateProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(auth.request).toHaveBeenCalledTimes(1);
    resolveRequest?.(await jsonResponse({ bankRate: 36.62, storeRate: 37.1, startDate: '2026-09-12' }));
    expect(await screen.findByText('ready:36.62')).toBeVisible();
  });

  it('converts purchase values using bankRate only for USD', () => {
    expect(convertToCordobas(8.5, '1', 36.62)).toBe(311.27);
    expect(convertToCordobas(8.5, '2', 36.62)).toBe(8.5);
  });
});
