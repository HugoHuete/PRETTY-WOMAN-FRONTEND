import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "../../features/auth/auth-provider";

export type CurrentExchangeRate = {
  storeRate: number;
  bankRate: number;
  startDate: string;
};

type ExchangeRateStatus = "idle" | "loading" | "ready" | "error";

type ExchangeRateContextValue = {
  rate: CurrentExchangeRate | null;
  bankRate: number | null;
  startDate: string | null;
  status: ExchangeRateStatus;
  error: string | null;
  refresh(): Promise<void>;
};

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

export function ExchangeRateProvider({ children }: PropsWithChildren) {
  const { request, status: authStatus } = useAuth();
  const [rate, setRate] = useState<CurrentExchangeRate | null>(null);
  const [status, setStatus] = useState<ExchangeRateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const inFlightRequest = useRef<Promise<void> | null>(null);

  const loadRate = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    if (inFlightRequest.current) {
      await inFlightRequest.current;
      return;
    }

    const version = ++requestVersion.current;
    setStatus("loading");
    setError(null);

    const promise = (async () => {
      try {
        const response = await request("/api/v1/exchange-rates/current");
        const body = await response.clone().json().catch(() => ({})) as Partial<CurrentExchangeRate> & { detail?: string; title?: string };
        if (!response.ok) {
          throw new Error(body.detail ?? body.title ?? "No se pudo cargar la tasa de cambio.");
        }

        const nextRate = {
          storeRate: Number(body.storeRate),
          bankRate: Number(body.bankRate),
          startDate: String(body.startDate ?? ""),
        };
        if (!Number.isFinite(nextRate.bankRate) || nextRate.bankRate <= 0) {
          throw new Error("La tasa de cambio recibida no es válida.");
        }

        if (version === requestVersion.current) {
          setRate(nextRate);
          setStatus("ready");
        }
      } catch (nextError) {
        if (version !== requestVersion.current) return;
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "No se pudo cargar la tasa de cambio.");
      }
    })();
    let trackedPromise: Promise<void>;
    trackedPromise = promise.finally(() => {
      if (inFlightRequest.current === trackedPromise) inFlightRequest.current = null;
    });
    inFlightRequest.current = trackedPromise;
  }, [authStatus, request]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadRate();
      return;
    }

    requestVersion.current += 1;
    setRate(null);
    setStatus("idle");
    setError(null);
  }, [authStatus, loadRate]);

  const value = useMemo<ExchangeRateContextValue>(() => ({
    rate,
    bankRate: rate?.bankRate ?? null,
    startDate: rate?.startDate ?? null,
    status,
    error,
    refresh: loadRate,
  }), [error, loadRate, rate, status]);

  return <ExchangeRateContext.Provider value={value}>{children}</ExchangeRateContext.Provider>;
}

export function useExchangeRate() {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    throw new Error("useExchangeRate debe utilizarse dentro de ExchangeRateProvider.");
  }
  return context;
}

export function convertToCordobas(amount: number, purchaseCurrencyId: string, bankRate: number) {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return purchaseCurrencyId === "1" ? amount * bankRate : amount;
}
