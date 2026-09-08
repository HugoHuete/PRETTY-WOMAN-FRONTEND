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
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "../../shared/ui/data-table";
import { FilterBar } from "../../shared/ui/filter-bar";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../shared/ui/screen-state";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { StatusBadge } from "../../shared/ui/status-badge";
import { useToast } from "../../shared/ui/toast-context";

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  name: string;
  lastname: string;
  enabled: boolean;
  locked: boolean;
  roles: string[];
};

type UserFormValues = {
  username: string;
  email: string;
  password: string;
  name: string;
  lastname: string;
  role: string;
};

type PanelMode = "create" | "edit" | null;
type UserAction = "unlock" | "disable" | "enable";
type UserFilters = { user: string; role: string; enabled: string };
type AuthRequest = (path: string, init?: RequestInit) => Promise<Response>;

const emptyFilters: UserFilters = { user: "", role: "", enabled: "" };

function roleLabel(role: string) {
  if (role === "Admin") return "Admin";
  if (role === "Employee") return "Ventas";
  return role;
}

function userListPath(filters: UserFilters) {
  const params = new URLSearchParams();
  if (filters.user.trim()) params.set("user", filters.user.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.enabled) params.set("enabled", filters.enabled);
  const query = params.toString();
  return query ? `/api/v1/auth/users?${query}` : "/api/v1/auth/users";
}

function userInitials(user: UserRecord) {
  return `${user.name.slice(0, 1)}${user.lastname.slice(0, 1)}`.toUpperCase();
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo completar la solicitud.";
}

async function getResponseError(response: Response) {
  try {
    const problem = (await response.json()) as {
      detail?: string;
      title?: string;
    };
    return (
      problem.detail ?? problem.title ?? "No se pudo completar la solicitud."
    );
  } catch {
    return "No se pudo completar la solicitud.";
  }
}

async function requestJson<T>(
  request: AuthRequest,
  path: string,
  init?: RequestInit,
) {
  const response = init ? await request(path, init) : await request(path);
  if (!response.ok) throw new Error(await getResponseError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function formValuesFor(user?: UserRecord): UserFormValues {
  return {
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
    name: user?.name ?? "",
    lastname: user?.lastname ?? "",
    role: user?.roles[0] ?? "Employee",
  };
}

function UserForm({
  mode,
  user,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  user?: UserRecord;
  isSubmitting: boolean;
  onSubmit: (values: UserFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => formValuesFor(user));
  const isCreate = mode === "create";

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(values);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {isCreate ? (
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor="user-username"
        >
          Usuario
          <input
            autoComplete="username"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="user-username"
            name="username"
            required
            value={values.username}
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span className="block text-xs font-bold uppercase tracking-wide text-pw-muted">
            Usuario
          </span>
          <strong>{values.username}</strong>
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="user-email">
        Correo electrónico
        <input
          autoComplete="email"
          className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
          id="user-email"
          name="email"
          required
          type="email"
          value={values.email}
          onChange={handleChange}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="user-name">
          Nombre
          <input
            autoComplete="given-name"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="user-name"
            name="name"
            required
            value={values.name}
            onChange={handleChange}
          />
        </label>
        <label
          className="grid gap-1.5 text-sm font-bold"
          htmlFor="user-lastname"
        >
          Apellido
          <input
            autoComplete="family-name"
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="user-lastname"
            name="lastname"
            required
            value={values.lastname}
            onChange={handleChange}
          />
        </label>
      </div>

      {isCreate ? (
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="user-role">
          Rol
          <SelectControl
            id="user-role"
            name="role"
            value={values.role}
            options={[
              { value: "Employee", label: "Ventas" },
              { value: "Admin", label: "Admin" },
            ]}
            aria-label="Seleccionar rol"
            onChange={handleChange}
          />
        </label>
      ) : (
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span className="block text-xs font-bold uppercase tracking-wide text-pw-muted">
            Rol
          </span>
          <strong>{roleLabel(values.role)}</strong>
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-bold" htmlFor="user-password">
        {isCreate ? "Contraseña temporal" : "Nueva contraseña"}{" "}
        <span className="font-normal text-pw-muted">
          {isCreate ? "(mínimo 8 caracteres)" : "(opcional)"}
        </span>
        <input
          autoComplete="new-password"
          className="min-h-11 rounded-lg border border-pw-line bg-white px-3 font-normal outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
          id="user-password"
          minLength={8}
          name="password"
          required={isCreate}
          type="password"
          value={values.password}
          onChange={handleChange}
        />
      </label>

      <div className="flex flex-col-reverse gap-3 border-t border-pw-line pt-4 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-lg border border-pw-line px-4 font-bold hover:bg-stone-50 focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <LoadingButton isLoading={isSubmitting} type="submit">
          {isCreate ? "Guardar usuario" : "Guardar cambios"}
        </LoadingButton>
      </div>
    </form>
  );
}

function UserFormDialog({
  mode,
  user,
  isSubmitting,
  isLoading,
  error,
  onSubmit,
  onClose,
  onRetry,
}: {
  mode: "create" | "edit";
  user?: UserRecord | null;
  isSubmitting: boolean;
  isLoading: boolean;
  error: string | null;
  onSubmit: (values: UserFormValues) => Promise<void>;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-pw-ink/45 p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        aria-labelledby="user-form-dialog-title"
        aria-modal="true"
        className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-xl overflow-y-auto rounded-xl border border-pw-line bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-pw-line px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-pw-muted">
              Equipo
            </p>
            <h2
              className="mt-1 text-xl font-extrabold"
              id="user-form-dialog-title"
            >
              {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
            </h2>
          </div>
          <button
            ref={closeRef}
            aria-label="Cerrar formulario de usuario"
            className="grid size-9 place-items-center rounded-lg border border-pw-line text-xl leading-none hover:bg-pw-canvas focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            type="button"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="p-5">
          {isLoading ? <LoadingState /> : null}
          {!isLoading && error ? (
            <ErrorState
              title="No se pudo cargar el usuario"
              description={error}
              onRetry={onRetry}
            />
          ) : null}
          {!isLoading && !error && (mode === "create" || user) ? (
            <UserForm
              key={mode === "create" ? "create" : user?.id}
              mode={mode}
              user={user ?? undefined}
              isSubmitting={isSubmitting}
              onCancel={onClose}
              onSubmit={onSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserRowActions({
  user,
  onEdit,
  onAction,
}: {
  user: UserRecord;
  onEdit: () => void;
  onAction: (action: UserAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        aria-label={`Editar ${user.username}`}
        className="min-h-9 rounded-lg border border-pw-line px-3 text-xs font-extrabold text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        type="button"
        onClick={onEdit}
      >
        Editar
      </button>
      <button
        aria-label={`${user.enabled ? "Deshabilitar" : "Habilitar"} ${user.username}`}
        className={`min-h-9 rounded-lg border px-3 text-xs font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 ${user.enabled ? "border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-700" : "border-green-200 text-green-700 hover:bg-green-50 focus-visible:outline-green-700"}`}
        type="button"
        onClick={() => onAction(user.enabled ? "disable" : "enable")}
      >
        {user.enabled ? "Deshabilitar" : "Reactivar"}
      </button>
      {user.locked ? (
        <button
          aria-label={`Desbloquear ${user.username}`}
          className="min-h-9 rounded-lg border border-amber-200 px-3 text-xs font-extrabold text-amber-800 hover:bg-amber-50 focus-visible:outline-3 focus-visible:outline-amber-700 focus-visible:outline-offset-2"
          type="button"
          onClick={() => onAction("unlock")}
        >
          Desbloquear
        </button>
      ) : null}
    </div>
  );
}

export function UsersPage() {
  const { request } = useAuth();
  const { showToast } = useToast();
  const { setAction } = usePageActions();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<UserAction | null>(null);
  const [confirmation, setConfirmation] = useState<UserAction | null>(null);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const initialLoadStarted = useRef(false);

  const loadUsers = useCallback(
    async (nextFilters: UserFilters = emptyFilters) => {
      const requestId = ++listRequestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const loadedUsers = await requestJson<UserRecord[]>(
          request,
          userListPath(nextFilters),
        );
        if (requestId === listRequestId.current) setUsers(loadedUsers);
      } catch (loadError) {
        if (requestId === listRequestId.current)
          setError(getErrorMessage(loadError));
      } finally {
        if (requestId === listRequestId.current) setIsLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadUsers(emptyFilters);
  }, [loadUsers]);

  const openCreate = useCallback(() => {
    detailRequestId.current += 1;
    setSelectedUser(null);
    setDetailError(null);
    setIsDetailLoading(false);
    setPanelMode("create");
  }, []);

  const createAction = useMemo(
    () => (
      <button
        aria-label="Nuevo usuario"
        className="pw-topbar-create-action min-h-10 rounded-lg bg-pw-brand px-4 text-sm font-extrabold text-white hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
        type="button"
        onClick={openCreate}
      >
        <span aria-hidden="true" className="mr-1 text-lg leading-none">
          +
        </span>
        Nuevo usuario
      </button>
    ),
    [openCreate],
  );

  useEffect(() => {
    setAction(createAction);
    return () => setAction(null);
  }, [createAction, setAction]);

  const applyFilters = (nextFilters: UserFilters) => {
    setFilters(nextFilters);
    void loadUsers(nextFilters);
  };

  const openEdit = async (userId: string) => {
    const requestId = ++detailRequestId.current;
    const summary = users.find((user) => user.id === userId) ?? null;
    setPanelMode("edit");
    setSelectedUser(summary);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const detail = await requestJson<UserRecord>(
        request,
        `/api/v1/auth/users/${userId}`,
      );
      if (requestId === detailRequestId.current) setSelectedUser(detail);
    } catch (detailLoadError) {
      if (requestId === detailRequestId.current)
        setDetailError(getErrorMessage(detailLoadError));
    } finally {
      if (requestId === detailRequestId.current) setIsDetailLoading(false);
    }
  };

  const handleCreate = async (values: UserFormValues) => {
    setIsSubmitting(true);
    try {
      await requestJson<UserRecord>(request, "/api/v1/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setPanelMode(null);
      setSelectedUser(null);
      await loadUsers(filters);
      showToast({
        tone: "success",
        title: "Usuario creado",
        detail: "La cuenta ya puede iniciar sesión.",
      });
    } catch (createError) {
      showToast({
        tone: "error",
        title: "No se pudo crear el usuario",
        detail: getErrorMessage(createError),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (values: UserFormValues) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    const body: Record<string, string> = {
      email: values.email,
      name: values.name,
      lastname: values.lastname,
    };
    if (values.password) body.password = values.password;

    try {
      await requestJson<UserRecord>(
        request,
        `/api/v1/auth/users/${selectedUser.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setPanelMode(null);
      setSelectedUser(null);
      await loadUsers(filters);
      showToast({ tone: "success", title: "Usuario actualizado" });
    } catch (updateError) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el usuario",
        detail: getErrorMessage(updateError),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeAction = async () => {
    if (!selectedUser || !confirmation || pendingAction) return;
    const action = confirmation;
    setPendingAction(action);
    try {
      await requestJson<UserRecord>(
        request,
        `/api/v1/auth/users/${selectedUser.id}/${action}`,
        {
          method: "POST",
        },
      );
      await loadUsers(filters);
      setSelectedUser(null);
      setConfirmation(null);
      showToast({
        tone: "success",
        title:
          action === "unlock"
            ? "Acceso desbloqueado"
            : action === "disable"
              ? "Usuario deshabilitado"
              : "Usuario habilitado",
      });
    } catch (actionError) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el estado",
        detail: getErrorMessage(actionError),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const closeDialog = () => {
    if (isSubmitting || pendingAction) return;
    detailRequestId.current += 1;
    setPanelMode(null);
    setSelectedUser(null);
    setDetailError(null);
    setIsDetailLoading(false);
  };

  const actionLabels: Record<
    UserAction,
    { title: string; description: string; confirm: string }
  > = {
    unlock: {
      title: "Desbloquear acceso",
      description:
        "El usuario podrá volver a autenticarse si su cuenta estaba bloqueada.",
      confirm: "Desbloquear",
    },
    disable: {
      title: "¿Deshabilitar este usuario?",
      description:
        "La cuenta no podrá iniciar sesión hasta que un Admin la habilite nuevamente.",
      confirm: "Deshabilitar",
    },
    enable: {
      title: "¿Habilitar este usuario?",
      description: "La cuenta podrá volver a iniciar sesión.",
      confirm: "Habilitar",
    },
  };

  const columns: readonly DataTableColumn<UserRecord>[] = [
    {
      key: "user",
      header: "Usuario",
      render: (user) => (
        <div className="flex min-w-44 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pw-brand-soft text-xs font-extrabold text-pw-brand-deep">
            {userInitials(user)}
          </span>
          <span className="min-w-0">
            <strong className="block truncate">
              {user.name} {user.lastname}
            </strong>
            <span className="block truncate text-xs text-pw-muted">
              Usuario @{user.username}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Correo",
      render: (user) => (
        <span className="break-all text-pw-muted">{user.email}</span>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (user) => (
        <StatusBadge tone={user.roles.includes("Admin") ? "info" : "neutral"}>
          {user.roles.map(roleLabel).join(", ")}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (user) => (
        <StatusBadge
          icon={<span aria-hidden="true">{user.enabled ? "✓" : "×"}</span>}
          tone={user.enabled ? "success" : "danger"}
        >
          {user.enabled ? "Activo" : "Deshabilitado"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (user) => (
        <UserRowActions
          user={user}
          onEdit={() => void openEdit(user.id)}
          onAction={(action) => {
            setSelectedUser(user);
            setConfirmation(action);
          }}
        />
      ),
    },
  ];

  const hasFilters = Boolean(filters.user || filters.role || filters.enabled);

  return (
    <div className="space-y-5">
      <FilterBar
        aria-label="Filtros de usuarios"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters({ ...filters, user: searchTerm });
        }}
      >
        <label
          className="grid min-w-0 flex-1 gap-1.5 text-xs font-extrabold text-pw-muted sm:w-96 sm:flex-none"
          htmlFor="user-search"
        >
          Buscar
          <input
            className="min-h-11 rounded-lg border border-pw-line bg-white px-3 text-sm font-normal text-pw-ink outline-none focus:border-pw-brand-deep focus:ring-2 focus:ring-pw-brand/30"
            id="user-search"
            placeholder="Usuario, nombre o correo"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <label
          className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="user-role-filter"
        >
          Rol
          <SelectControl
            id="user-role-filter"
            value={filters.role}
            options={[
              { value: "", label: "Todos los roles" },
              { value: "Admin", label: "Admin" },
              { value: "Employee", label: "Ventas" },
            ]}
            aria-label="Seleccionar rol"
            onChange={(event) =>
              applyFilters({
                ...filters,
                user: searchTerm,
                role: event.target.value,
              })
            }
          />
        </label>
        <label
          className="grid min-w-44 gap-1.5 text-xs font-extrabold text-pw-muted"
          htmlFor="user-status-filter"
        >
          Estado
          <SelectControl
            id="user-status-filter"
            value={filters.enabled}
            options={[
              { value: "", label: "Todos los estados" },
              { value: "true", label: "Activo" },
              { value: "false", label: "Deshabilitado" },
            ]}
            aria-label="Seleccionar estado"
            onChange={(event) =>
              applyFilters({
                ...filters,
                user: searchTerm,
                enabled: event.target.value,
              })
            }
          />
        </label>
        {hasFilters ? (
          <button
            className="min-h-11 rounded-lg px-2 text-sm font-extrabold text-pw-brand-deep underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
            type="button"
            onClick={() => {
              setSearchTerm("");
              applyFilters(emptyFilters);
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
      </FilterBar>

      <section aria-label="Listado de usuarios">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && error ? (
          <ErrorState
            title="No se pudieron cargar los usuarios"
            description={error}
            onRetry={() => void loadUsers(filters)}
          />
        ) : null}
        {!isLoading && !error && users.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? "No encontramos coincidencias"
                : "No hay usuarios registrados"
            }
            description={
              hasFilters
                ? "Prueba con otros datos o limpia los filtros."
                : "Crea el primer usuario para darle acceso al sistema."
            }
            action={!hasFilters ? createAction : undefined}
          />
        ) : null}
        {!isLoading && !error && users.length > 0 ? (
          <DataTable
            caption="Usuarios con rol, estado y acciones"
            columns={columns}
            rows={users}
            rowKey={(user) => user.id}
          />
        ) : null}
      </section>

      {panelMode ? (
        <UserFormDialog
          mode={panelMode}
          user={selectedUser}
          isSubmitting={isSubmitting}
          isLoading={panelMode === "edit" && isDetailLoading}
          error={panelMode === "edit" ? detailError : null}
          onClose={closeDialog}
          onRetry={() => selectedUser && void openEdit(selectedUser.id)}
          onSubmit={panelMode === "create" ? handleCreate : handleUpdate}
        />
      ) : null}

      {confirmation && selectedUser ? (
        <ConfirmDialog
          open
          title={actionLabels[confirmation].title}
          description={`${actionLabels[confirmation].description} (${selectedUser.name} ${selectedUser.lastname}).`}
          confirmLabel={actionLabels[confirmation].confirm}
          isPending={Boolean(pendingAction)}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void executeAction()}
        />
      ) : null}
      {pendingAction ? (
        <span className="sr-only" role="status">
          Actualizando estado…
        </span>
      ) : null}
    </div>
  );
}
