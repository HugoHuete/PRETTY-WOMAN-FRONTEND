import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useAuth } from "../auth/auth-provider";
import { usePageActions } from "../../shared/layout/page-actions-context";
import { FilterBar } from "../../shared/ui/filter-bar";
import { EmptyState, ErrorState, LoadingState } from "../../shared/ui/screen-state";
import { LoadingButton } from "../../shared/ui/loading-button";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";

export type ClientRecord = {
  id: number;
  name: string;
  phone?: string | null;
  instagram?: string | null;
  messenger?: string | null;
  address?: string | null;
  comments?: string | null;
  isFriend?: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
  createdAt?: string | null;
};

type ClientApiRecord = ClientRecord & {
  phoneNumber?: string | null;
  instagramUser?: string | null;
  messengerUser?: string | null;
};
type ClientFormValues = {
  name: string;
  phone: string;
  instagram: string;
  messenger: string;
  address: string;
  comments: string;
  isFriend: boolean;
};

type ClientStatusAction = "block" | "unblock";
type AuthRequest = (path: string, init?: RequestInit) => Promise<Response>;

function valueOf(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalize(value: string | null | undefined) {
  return valueOf(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeClient(client: ClientApiRecord): ClientRecord {
  return {
    ...client,
    phone: client.phone ?? client.phoneNumber,
    instagram: client.instagram ?? client.instagramUser,
    messenger: client.messenger ?? client.messengerUser,
  };
}
function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function responseError(response: Response) {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? "No se pudo completar la solicitud.";
  } catch {
    return "No se pudo completar la solicitud.";
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo completar la solicitud.";
}

async function requestJson<T>(
  request: AuthRequest,
  path: string,
  init?: RequestInit,
) {
  const response = init ? await request(path, init) : await request(path);
  if (!response.ok) throw new Error(await responseError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function formValuesFor(client?: ClientRecord): ClientFormValues {
  return {
    name: valueOf(client?.name),
    phone: valueOf(client?.phone),
    instagram: valueOf(client?.instagram),
    messenger: valueOf(client?.messenger),
    address: valueOf(client?.address),
    comments: valueOf(client?.comments),
    isFriend: Boolean(client?.isFriend),
  };
}

function ClientForm({
  client,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  client?: ClientRecord;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(() => formValuesFor(client));
  const [nameError, setNameError] = useState("");

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = event.target;
    const nextValue =
      type === "checkbox" && "checked" in event.target
        ? event.target.checked
        : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    if (name === "name" && value.trim()) setNameError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.name.trim()) {
      setNameError("Escribe el nombre completo.");
      return;
    }
    void onSubmit({
      ...values,
      name: values.name.trim(),
      phone: values.phone.trim(),
      instagram: values.instagram.trim().replace(/^@/, ""),
      messenger: values.messenger.trim(),
      address: values.address.trim(),
      comments: values.comments.trim(),
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold sm:col-span-2" htmlFor="client-name">
          Nombre completo
          <input
            autoComplete="name"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-name"
            name="name"
            required
            value={values.name}
            onChange={handleChange}
          />
          {nameError ? <span className="text-xs font-semibold text-red-700">{nameError}</span> : null}
        </label>
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="client-phone">
          Teléfono
          <input
            autoComplete="tel"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-phone"
            name="phone"
            inputMode="tel"
            placeholder="8888-0000"
            type="tel"
            value={values.phone}
            onChange={handleChange}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="client-instagram">
          Usuario de Instagram
          <span className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-pw-muted">@</span>
            <input
              autoComplete="off"
              className="min-h-11 w-full rounded-lg border border-pw-line bg-white px-3 pl-8 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
              id="client-instagram"
              name="instagram"
              value={values.instagram}
              onChange={handleChange}
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="client-messenger">
          Usuario de Messenger
          <input
            autoComplete="off"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-messenger"
            name="messenger"
            value={values.messenger}
            onChange={handleChange}
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-pw-line bg-pw-canvas px-3 text-sm font-bold sm:col-span-2">
          <input
            className="size-4 accent-pw-brand"
            name="isFriend"
            type="checkbox"
            checked={values.isFriend}
            onChange={handleChange}
          />
          <span>Es amistad</span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold sm:col-span-2" htmlFor="client-address">
          Dirección
          <textarea
            autoComplete="street-address"
            className="rounded-lg border border-pw-line bg-white px-3 py-2 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-address"
            name="address"
            rows={2}
            value={values.address}
            onChange={handleChange}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-bold sm:col-span-2" htmlFor="client-comments">
          Notas
          <textarea
            className="rounded-lg border border-pw-line bg-white px-3 py-2 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-comments"
            name="comments"
            placeholder="Preferencias o información útil para futuras atenciones"
            rows={3}
            value={values.comments}
            onChange={handleChange}
          />
        </label>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-pw-line pt-4 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-lg border border-pw-line px-4 font-bold hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <LoadingButton isLoading={isSubmitting} type="submit">
          {client ? "Guardar cambios" : "Guardar clienta"}
        </LoadingButton>
      </div>
    </form>
  );
}

function ClientFormDialog({
  client,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  client?: ClientRecord;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSubmitting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-pw-ink/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby="client-form-title"
        aria-modal="true"
        className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border border-pw-line bg-white shadow-xl"
        role="dialog"
        aria-label={client ? "Editar cliente" : "Nueva clienta"}
      >
        <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Directorio</p>
            <h2 className="mt-1 text-xl font-extrabold" id="client-form-title">
              {client ? "Editar cliente" : "Nueva clienta"}
            </h2>
          </div>
          <button
            ref={closeRef}
            aria-label="Cerrar formulario de cliente"
            className="grid size-10 place-items-center rounded-lg border border-pw-line text-xl leading-none hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="p-5">
          <ClientForm
            client={client}
            isSubmitting={isSubmitting}
            onCancel={onClose}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

function ClientStatusDialog({
  action,
  client,
  error,
  isPending,
  onClose,
  onConfirm,
}: {
  action: ClientStatusAction;
  client: ClientRecord;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isBlocking = action === "block";


  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isPending, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-pw-ink/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div
        aria-modal="true"
        aria-labelledby="client-status-title"
        aria-label={isBlocking ? "Bloquear clienta" : "Desbloquear clienta"}
        className="w-full max-w-lg rounded-xl border border-pw-line bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-pw-line px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">Acción administrativa</p>
            <h2 className="mt-1 text-xl font-extrabold" id="client-status-title">
              {isBlocking ? "Bloquear clienta" : "Desbloquear clienta"}
            </h2>
          </div>
          <button
            aria-label="Cerrar cambio de estado"
            className="grid size-10 place-items-center rounded-lg border border-pw-line text-xl leading-none hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            disabled={isPending}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="space-y-4 p-5">
          <p className="text-sm text-pw-muted">
            {isBlocking
              ? `Nuevas operaciones para ${client.name} quedarán bloqueadas hasta que un Admin la desbloquee.`
              : `La clienta ${client.name} podrá volver a asociarse a nuevas operaciones.`}
          </p>
          {isBlocking ? (
            <label className="grid gap-1.5 text-sm font-bold" htmlFor="client-block-reason">
              Motivo del bloqueo
              <textarea
                className="rounded-lg border border-pw-line bg-white px-3 py-2 font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
                id="client-block-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-pw-line px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-lg border border-pw-line px-4 font-bold hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            disabled={isPending}
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="min-h-11 rounded-lg bg-red-700 px-4 font-extrabold text-white hover:bg-red-800 focus-visible:outline-3 focus-visible:outline-red-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || (isBlocking && !reason.trim())}
            type="button"
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? "Actualizando…" : isBlocking ? "Bloquear clienta" : "Desbloquear clienta"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ClientActions({
  client,
  canManageStatus,
  onEdit,
  onStatus,
}: {
  client: ClientRecord;
  canManageStatus: boolean;
  onEdit: () => void;
  onStatus: (action: ClientStatusAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        aria-label={`Editar ${client.name}`}
        className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        type="button"
        onClick={onEdit}
      >
        Editar
      </button>
      {canManageStatus ? (
        <button
          aria-label={`${client.isBlocked ? "Desbloquear" : "Bloquear"} a ${client.name}`}
          className={`min-h-9 rounded-lg border px-3 text-xs font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 ${client.isBlocked ? "border-amber-300 text-amber-900 hover:bg-amber-50 focus-visible:outline-amber-700" : "border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-700"}`}
          type="button"
          onClick={() => onStatus(client.isBlocked ? "unblock" : "block")}
        >
          {client.isBlocked ? "Desbloquear" : "Bloquear"}
        </button>
      ) : null}
    </div>
  );
}

export function ClientsPage() {
  const { request, session } = useAuth();
  const { setAction, setHeading } = usePageActions();
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formClient, setFormClient] = useState<ClientRecord | null | undefined>(undefined);
  const [statusTarget, setStatusTarget] = useState<{ client: ClientRecord; action: ClientStatusAction } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const initialLoadStarted = useRef(false);
  const canManageStatus = session?.user.roles.includes("Admin") ?? false;

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await requestJson<ClientApiRecord[] | { items?: ClientApiRecord[] }>(request, "/api/v1/clients");
      const items = Array.isArray(result) ? result : result.items ?? [];
      setClients(items.map(normalizeClient));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (retry === 0 && initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadClients();
  }, [loadClients, retry]);

  useEffect(() => {
    setHeading({ title: "Clientes", breadcrumbs: "Operación" });
    return () => setHeading(null);
  }, [setHeading]);

  const openCreate = useCallback(() => setFormClient(null), []);
  const createAction = useMemo(
    () => (
      <button
        aria-label="Nueva clienta"
        className="min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        type="button"
        onClick={openCreate}
      >
        <span aria-hidden="true" className="mr-1 text-lg leading-none">+</span>
        Nueva clienta
      </button>
    ),
    [openCreate],
  );

  useEffect(() => {
    setAction(createAction);
    return () => setAction(null);
  }, [createAction, setAction]);

  const visibleClients = useMemo(() => {
    const query = normalize(search);
    if (!query) return clients;
    const digits = query.replace(/\D/g, "");
    return clients.filter((client) => {
      const searchable = normalize(
        [client.name, client.phone, client.instagram, client.messenger].join(" "),
      );
      return searchable.includes(query) || (digits.length > 0 && valueOf(client.phone).replace(/\D/g, "").includes(digits));
    });
  }, [clients, search]);

  const saveClient = async (values: ClientFormValues) => {
    const isEdit = Boolean(formClient);
    setIsSubmitting(true);
    try {

      await requestJson<ClientRecord>(
        request,
        isEdit ? `/api/v1/clients/${formClient?.id}` : "/api/v1/clients",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            phoneNumber: values.phone,
            instagramUser: values.instagram,
            messengerUser: values.messenger,
            address: values.address,
            isFriend: values.isFriend,
            comments: values.comments,
          }),
        },
      );
      setFormClient(undefined);
      await loadClients();
      showToast({
        tone: "success",
        title: isEdit ? "Cliente actualizado" : "Clienta creada",
        detail: isEdit ? "Los datos quedaron guardados." : "Ya puedes asociarla a una venta.",
      });
    } catch (saveError) {
      showToast({
        tone: "error",
        title: isEdit ? "No se pudo actualizar la clienta" : "No se pudo crear la clienta",
        detail: errorMessage(saveError),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeClientStatus = async (reason: string) => {
    if (!statusTarget) return;
    setIsSubmitting(true);
    setStatusError(null);
    try {
      await requestJson<ClientRecord>(
        request,
        `/api/v1/clients/${statusTarget.client.id}/${statusTarget.action}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(statusTarget.action === "block" ? { body: JSON.stringify({ blockedReason: reason }) } : {}),
        },
      );
      setStatusTarget(null);
      await loadClients();
      showToast({
        tone: "success",
        title: statusTarget.action === "block" ? "Clienta bloqueada" : "Clienta desbloqueada",
      });
    } catch (statusSaveError) {
      setStatusError(errorMessage(statusSaveError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSearch = Boolean(search.trim());

  return (
    <div className="space-y-5">
      <FilterBar aria-label="Filtros de clientes" onSubmit={(event) => event.preventDefault()}>
        <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted sm:max-w-xl" htmlFor="client-search">
          Buscar clientes
          <input
            aria-label="Buscar clientes"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="client-search"
            placeholder="Nombre, teléfono o usuario"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {hasSearch ? (
          <button
            className="min-h-11 rounded-lg px-2 text-sm font-extrabold text-pw-brand-deep underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            type="button"
            onClick={() => setSearch("")}
          >
            Limpiar búsqueda
          </button>
        ) : null}
      </FilterBar>

      <section aria-label="Listado de clientes">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && error ? (
          <ErrorState
            title="No se pudieron cargar las clientas"
            description={error}
            onRetry={() => setRetry((current) => current + 1)}
          />
        ) : null}
        {!isLoading && !error && visibleClients.length === 0 ? (
          <EmptyState
            title={hasSearch ? "No encontramos coincidencias" : "No hay clientas registradas"}
            description={hasSearch ? "Prueba con otro nombre, teléfono o usuario." : "Crea la primera clienta para asociarla a ventas y entregas."}
          />
        ) : null}
        {!isLoading && !error && visibleClients.length > 0 ? (
          <>
            <p aria-live="polite" className="mb-3 text-sm text-pw-muted">
              <strong className="text-pw-ink">{visibleClients.length} {visibleClients.length === 1 ? "clienta encontrada" : "clientas encontradas"}</strong>
            </p>
            <div className="overflow-x-auto rounded-xl border border-pw-line bg-white">
              <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Directorio de clientas con información de contacto y estado.</caption>
                <thead className="bg-pw-brand-soft text-[0.8125rem] uppercase tracking-[0.04em] text-pw-ink">
                  <tr>
                    {["Clienta", "Teléfono", "Instagram", "Messenger", "Registro", "Estado", "Acciones"].map((heading) => (
                      <th className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold" key={heading} scope="col">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pw-line">
                  {visibleClients.map((client) => (
                    <tr className="hover:bg-pw-brand-soft/40" key={client.id}>
                      <td className="px-4 py-3">
                        <div className="flex min-w-44 items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pw-brand-soft text-xs font-extrabold text-pw-brand-deep">{clientInitials(valueOf(client.name))}</span>
                          <span className="min-w-0">
                            <strong className="block truncate">{client.name}</strong>
                            <span className="block text-xs text-pw-muted">Cliente #{client.id}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{client.phone ? <a className="font-semibold text-pw-ink underline-offset-2 hover:text-pw-brand-deep hover:underline" href={`tel:${client.phone.replace(/\D/g, "")}`}>{client.phone}</a> : <span className="text-pw-muted">Sin teléfono</span>}</td>
                      <td className="max-w-40 px-4 py-3">{client.instagram ? <span className="truncate text-pw-ink">@{client.instagram.replace(/^@/, "")}</span> : <span className="text-pw-muted">Sin usuario</span>}</td>
                      <td className="max-w-40 px-4 py-3">{client.messenger ? <span className="truncate text-pw-ink">{client.messenger}</span> : <span className="text-pw-muted">Sin usuario</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-pw-muted">{formatDate(client.createdAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge icon={<span aria-hidden="true">{client.isBlocked ? "×" : "✓"}</span>} tone={client.isBlocked ? "danger" : "success"}>
                          {client.isBlocked ? "Bloqueada" : "Activa"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <ClientActions
                          canManageStatus={canManageStatus}
                          client={client}
                          onEdit={() => setFormClient(client)}
                          onStatus={(action) => {
                            setStatusError(null);
                            setStatusTarget({ client, action });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      {formClient !== undefined ? (
        <ClientFormDialog
          client={formClient ?? undefined}
          isSubmitting={isSubmitting}
          onClose={() => {
            if (!isSubmitting) setFormClient(undefined);
          }}
          onSubmit={saveClient}
        />
      ) : null}

      {statusTarget ? (
        <ClientStatusDialog
          action={statusTarget.action}
          client={statusTarget.client}
          error={statusError}
          isPending={isSubmitting}
          onClose={() => {
            if (!isSubmitting) setStatusTarget(null);
          }}
          onConfirm={(reason) => void changeClientStatus(reason)}
        />
      ) : null}
    </div>
  );
}
