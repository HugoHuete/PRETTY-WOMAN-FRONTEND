import { render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PageActionsProvider,
  usePageActions,
} from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { UsersPage } from "./users-page";

const auth = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => ({ request: auth.request }),
}));

type UserRecord = {
  id: string;
  username: string;
  email: string;
  name: string;
  lastname: string;
  enabled: boolean;
  locked: boolean;
  roles: string[];
};

function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    username: "maria.vendedora",
    email: "maria@example.com",
    name: "María",
    lastname: "Pérez",
    enabled: true,
    locked: false,
    roles: ["Employee"],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderUsers({ strict = false }: { strict?: boolean } = {}) {
  const tree = (
    <PageActionsProvider>
      <ToastProvider>
        <PageActionHost />
        <UsersPage />
      </ToastProvider>
    </PageActionsProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function PageActionHost() {
  return usePageActions().action;
}

afterEach(() => {
  auth.request.mockReset();
});

describe("UsersPage", () => {
  it("requests the initial list once under StrictMode", async () => {
    auth.request.mockResolvedValueOnce(await jsonResponse([]));

    renderUsers({ strict: true });

    await waitFor(() => expect(auth.request).toHaveBeenCalledTimes(1));
    expect(auth.request).toHaveBeenCalledWith("/api/v1/auth/users");
  });

  it("loads users into a table with role and enabled status", async () => {
    auth.request.mockResolvedValueOnce(
      await jsonResponse([
        userRecord(),
        userRecord({
          id: "user-2",
          username: "ana.admin",
          email: "ana@example.com",
          name: "Ana",
          lastname: "Gómez",
          roles: ["Admin"],
          enabled: false,
          locked: true,
        }),
      ]),
    );

    renderUsers();

    expect(
      await screen.findByRole("button", { name: "Editar maria.vendedora" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Editar ana.admin" }),
    ).toBeVisible();
    expect(screen.getAllByText("Ventas")).toHaveLength(2);
    expect(screen.getAllByText("Admin")).toHaveLength(2);
    expect(screen.getAllByText("Activo")).toHaveLength(2);
    expect(screen.getAllByText("Deshabilitado")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Desbloquear maria.vendedora" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desbloquear ana.admin" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Buscar")).toHaveAttribute(
      "placeholder",
      "Usuario, nombre o correo",
    );
    expect(auth.request).toHaveBeenCalledWith("/api/v1/auth/users");
  });

  it("loads the user list with the selected role and status filters", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation(() =>
      jsonResponse([userRecord({ enabled: false })]),
    );

    renderUsers();
    await screen.findByRole("button", { name: "Editar maria.vendedora" });
    await user.selectOptions(screen.getByLabelText("Rol"), "Employee");
    await user.selectOptions(screen.getByLabelText("Estado"), "false");

    await waitFor(() => {
      expect(auth.request).toHaveBeenLastCalledWith(
        "/api/v1/auth/users?role=Employee&enabled=false",
      );
    });
  });

  it("keeps the pending search when another filter changes", async () => {
    const user = userEvent.setup();
    auth.request.mockImplementation(() => jsonResponse([userRecord()]));

    renderUsers();
    await screen.findByRole("button", { name: "Editar maria.vendedora" });
    await user.type(screen.getByLabelText("Buscar"), "maria");
    await user.selectOptions(screen.getByLabelText("Rol"), "Employee");

    await waitFor(() => {
      expect(auth.request).toHaveBeenLastCalledWith(
        "/api/v1/auth/users?user=maria&role=Employee",
      );
    });
  });

  it("refreshes the active filtered list after changing a user status", async () => {
    const user = userEvent.setup();
    const currentUser = userRecord();
    let filteredRequestCount = 0;
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/auth/users" && !init)
        return jsonResponse([currentUser]);
      if (path === "/api/v1/auth/users?enabled=true") {
        filteredRequestCount += 1;
        return jsonResponse(filteredRequestCount === 1 ? [currentUser] : []);
      }
      if (path === "/api/v1/auth/users/user-1/disable")
        return jsonResponse({ ...currentUser, enabled: false });
      throw new Error(`Unexpected request: ${path}`);
    });

    renderUsers();
    await user.click(
      await screen.findByRole("button", { name: "Seleccionar estado" }),
    );
    await user.click(
      within(screen.getByRole("listbox")).getByRole("option", {
        name: "Activo",
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Deshabilitar maria.vendedora",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Deshabilitar" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenLastCalledWith(
        "/api/v1/auth/users?enabled=true",
      );
      expect(
        screen.getByRole("heading", { name: "No encontramos coincidencias" }),
      ).toBeVisible();
    });
  });

  it("ignores repeated status confirmations while the request is pending", async () => {
    const user = userEvent.setup();
    const actionResponse = deferred<Response>();
    const currentUser = userRecord();
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/auth/users" && !init)
        return jsonResponse([currentUser]);
      if (path === "/api/v1/auth/users/user-1/disable")
        return actionResponse.promise;
      return jsonResponse([]);
    });

    renderUsers();
    await user.click(
      await screen.findByRole("button", {
        name: "Deshabilitar maria.vendedora",
      }),
    );
    const confirmButton = screen.getByRole("button", { name: "Deshabilitar" });
    await user.click(confirmButton);
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(
      auth.request.mock.calls.filter(
        ([path]) => path === "/api/v1/auth/users/user-1/disable",
      ),
    ).toHaveLength(1);

    actionResponse.resolve(
      await jsonResponse({ ...currentUser, enabled: false }),
    );
  });

  it("opens a styled dropdown with selectable options", async () => {
    const user = userEvent.setup();
    auth.request.mockResolvedValue(await jsonResponse([userRecord()]));

    renderUsers();
    await screen.findByRole("button", { name: "Editar maria.vendedora" });

    const roleTrigger = screen.getByRole("button", { name: "Seleccionar rol" });
    expect(roleTrigger).toHaveAttribute("aria-expanded", "false");
    await user.click(roleTrigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeVisible();
    expect(
      within(listbox).getByRole("option", { name: "Ventas" }),
    ).toBeVisible();
    expect(
      within(listbox).getByRole("option", { name: "Admin" }),
    ).toBeVisible();

    await user.click(within(listbox).getByRole("option", { name: "Admin" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenLastCalledWith(
        "/api/v1/auth/users?role=Admin",
      );
    });
    expect(roleTrigger).toHaveTextContent("Admin");
  });

  it("closes an open dropdown when keyboard focus leaves it", async () => {
    const user = userEvent.setup();
    auth.request.mockResolvedValue(await jsonResponse([userRecord()]));

    renderUsers();
    await screen.findByRole("button", { name: "Editar maria.vendedora" });
    const roleTrigger = screen.getByRole("button", { name: "Seleccionar rol" });
    await user.click(roleTrigger);
    expect(screen.getByRole("listbox")).toBeVisible();

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not move focus to closed dropdowns when Escape is pressed elsewhere", async () => {
    const user = userEvent.setup();
    auth.request.mockResolvedValue(await jsonResponse([userRecord()]));

    renderUsers();
    await screen.findByRole("button", { name: "Editar maria.vendedora" });
    const search = screen.getByLabelText("Buscar");
    search.focus();

    await user.keyboard("{Escape}");

    expect(search).toHaveFocus();
  });

  it("creates an Employee and refreshes the table", async () => {
    const user = userEvent.setup();
    const created = userRecord({
      id: "user-3",
      username: "luis.vendedor",
      name: "Luis",
    });
    auth.request
      .mockResolvedValueOnce(await jsonResponse([]))
      .mockResolvedValueOnce(await jsonResponse(created, 201))
      .mockResolvedValueOnce(await jsonResponse([created]));

    renderUsers();
    await user.click(
      (await screen.findAllByRole("button", { name: "Nuevo usuario" }))[0],
    );
    await user.type(screen.getByLabelText("Usuario"), "luis.vendedor");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "luis@example.com",
    );
    await user.type(screen.getByLabelText("Nombre"), "Luis");
    await user.type(screen.getByLabelText("Apellido"), "Ruiz");
    await user.type(
      screen.getByLabelText(/Contraseña temporal/),
      "secreto-123",
    );
    await user.selectOptions(
      within(
        screen.getByRole("dialog", { name: "Nuevo usuario" }),
      ).getByLabelText("Rol"),
      "Employee",
    );
    await user.click(screen.getByRole("button", { name: "Guardar usuario" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenNthCalledWith(2, "/api/v1/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "luis.vendedor",
          email: "luis@example.com",
          password: "secreto-123",
          name: "Luis",
          lastname: "Ruiz",
          role: "Employee",
        }),
      });
      expect(auth.request).toHaveBeenNthCalledWith(3, "/api/v1/auth/users");
    });
    expect(
      await screen.findByRole("button", { name: "Editar luis.vendedor" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Usuario creado");
  });

  it("moves focus into the user dialog and returns it when closed with Escape", async () => {
    const user = userEvent.setup();
    auth.request.mockResolvedValueOnce(await jsonResponse([]));

    renderUsers();
    const createButton = (
      await screen.findAllByRole("button", { name: "Nuevo usuario" })
    )[0];
    await user.click(createButton);
    const closeButton = screen.getByRole("button", {
      name: "Cerrar formulario de usuario",
    });
    expect(closeButton).toHaveFocus();

    screen.getByRole("button", { name: "Guardar usuario" }).focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Nuevo usuario" }),
    ).not.toBeInTheDocument();
    expect(createButton).toHaveFocus();
  });

  it("keeps the selected user when an older detail response arrives later", async () => {
    const user = userEvent.setup();
    const first = userRecord();
    const second = userRecord({
      id: "user-2",
      username: "ana.admin",
      email: "ana@example.com",
      name: "Ana",
      lastname: "Gómez",
      roles: ["Admin"],
    });
    const firstDetail = deferred<Response>();
    const secondDetail = deferred<Response>();
    auth.request.mockImplementation((path: string) => {
      if (path === "/api/v1/auth/users") return jsonResponse([first, second]);
      if (path === "/api/v1/auth/users/user-1") return firstDetail.promise;
      if (path === "/api/v1/auth/users/user-2") return secondDetail.promise;
      throw new Error(`Unexpected request: ${path}`);
    });

    renderUsers();
    await user.click(
      await screen.findByRole("button", { name: "Editar maria.vendedora" }),
    );
    await user.click(screen.getByRole("button", { name: "Editar ana.admin" }));

    secondDetail.resolve(await jsonResponse(second));
    expect(
      await screen.findByRole("heading", { name: "Editar usuario" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "ana@example.com",
    );
    firstDetail.resolve(await jsonResponse(first));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Editar usuario" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
        "ana@example.com",
      );
    });
  });

  it("does not let the initial load hide a user after creation and refresh", async () => {
    const user = userEvent.setup();
    const initialList = deferred<Response>();
    const refreshedList = deferred<Response>();
    const created = userRecord({
      id: "user-3",
      username: "luis.vendedor",
      name: "Luis",
    });
    let listRequestCount = 0;
    auth.request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/api/v1/auth/users" && !init) {
        listRequestCount += 1;
        return listRequestCount === 1
          ? initialList.promise
          : refreshedList.promise;
      }
      if (path === "/api/v1/auth/users" && init?.method === "POST")
        return jsonResponse(created, 201);
      throw new Error(`Unexpected request: ${path}`);
    });

    renderUsers();
    await user.click(
      (await screen.findAllByRole("button", { name: "Nuevo usuario" }))[0],
    );
    await user.type(screen.getByLabelText("Usuario"), "luis.vendedor");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "luis@example.com",
    );
    await user.type(screen.getByLabelText("Nombre"), "Luis");
    await user.type(screen.getByLabelText("Apellido"), "Ruiz");
    await user.type(
      screen.getByLabelText(/Contraseña temporal/),
      "secreto-123",
    );
    await user.click(screen.getByRole("button", { name: "Guardar usuario" }));

    await waitFor(() => expect(listRequestCount).toBe(2));
    refreshedList.resolve(await jsonResponse([created]));
    expect(
      await screen.findByRole("button", { name: "Editar luis.vendedor" }),
    ).toBeVisible();
    initialList.resolve(await jsonResponse([]));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Editar luis.vendedor" }),
      ).toBeVisible();
    });
  });

  it("loads a user detail by id and updates its profile", async () => {
    const user = userEvent.setup();
    auth.request
      .mockResolvedValueOnce(await jsonResponse([userRecord()]))
      .mockResolvedValueOnce(await jsonResponse(userRecord()))
      .mockResolvedValueOnce(
        await jsonResponse(userRecord({ name: "María Elena" })),
      )
      .mockResolvedValueOnce(
        await jsonResponse([userRecord({ name: "María Elena" })]),
      );

    renderUsers();
    await user.click(
      await screen.findByRole("button", { name: "Editar maria.vendedora" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Editar usuario" }),
    ).toBeVisible();
    expect(auth.request).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/users/user-1",
    );

    const nameInput = screen.getByLabelText("Nombre");
    await user.clear(nameInput);
    await user.type(nameInput, "María Elena");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenNthCalledWith(
        3,
        "/api/v1/auth/users/user-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "maria@example.com",
            name: "María Elena",
            lastname: "Pérez",
          }),
        },
      );
      expect(auth.request).toHaveBeenLastCalledWith("/api/v1/auth/users");
    });
  });

  it("confirms disabling a user and sends the state action", async () => {
    const user = userEvent.setup();
    auth.request
      .mockResolvedValueOnce(await jsonResponse([userRecord()]))
      .mockResolvedValueOnce(await jsonResponse(userRecord({ enabled: false })))
      .mockResolvedValueOnce(
        await jsonResponse([userRecord({ enabled: false })]),
      );

    renderUsers();
    await user.click(
      await screen.findByRole("button", {
        name: "Deshabilitar maria.vendedora",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "¿Deshabilitar este usuario?",
    );
    await user.click(screen.getByRole("button", { name: "Deshabilitar" }));

    await waitFor(() => {
      expect(auth.request).toHaveBeenNthCalledWith(
        2,
        "/api/v1/auth/users/user-1/disable",
        {
          method: "POST",
        },
      );
      expect(auth.request).toHaveBeenLastCalledWith("/api/v1/auth/users");
    });
  });
});
