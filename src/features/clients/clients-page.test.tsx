import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageActionsProvider, usePageActions } from "../../shared/layout/page-actions-context";
import { ToastProvider } from "../../shared/ui/toast-provider";
import { ClientsPage } from "./clients-page";

const auth = vi.hoisted(() => ({
  request: vi.fn(),
  session: { user: { roles: ["Admin"] } },
}));

vi.mock("../auth/auth-provider", () => ({
  useAuth: () => auth,
}));

type ClientRecord = {
  id: number;
  name: string;
  phone: string;
  instagram: string;
  messenger: string;
  address: string;
  comments: string;
  isFriend: boolean;
  isBlocked: boolean;
  blockedReason: string;
  createdAt: string;
};

function clientRecord(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id: 101,
    name: "Karla Rodríguez",
    phone: "8888-1420",
    instagram: "karlarodriguez",
    messenger: "Karla Rodríguez",
    address: "Residencial Las Colinas, Managua",
    comments: "Prefiere coordinar entregas por Instagram.",
    isFriend: true,
    isBlocked: false,
    blockedReason: "",
    createdAt: "2026-07-12T00:00:00Z",
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

function renderClients() {
  return render(
    <PageActionsProvider>
      <ToastProvider>
        <PageActionHost />
        <ClientsPage />
      </ToastProvider>
    </PageActionsProvider>,
  );
}

function PageActionHost() {
  return usePageActions().action;
}

afterEach(() => {
  auth.request.mockReset();
  auth.session.user.roles = ["Admin"];
});

describe("ClientsPage", () => {
  it("loads clients into a table with contact and status", async () => {
    auth.request.mockResolvedValueOnce(
      await jsonResponse([
        clientRecord(),
        clientRecord({ id: 102, name: "María Fernanda López", isBlocked: true }),
      ]),
    );

    renderClients();

    expect(
      await screen.findByRole("button", { name: "Editar Karla Rodríguez" }),
    ).toBeVisible();
    expect(screen.getAllByText("8888-1420")).not.toHaveLength(0);
    expect(screen.getAllByText("@karlarodriguez")).not.toHaveLength(0);
    expect(screen.getByText("Activa")).toBeVisible();
    expect(screen.getByText("Bloqueada")).toBeVisible();
    expect(screen.getByRole("table")).toHaveClass("w-full");
    expect(auth.request).toHaveBeenCalledWith("/api/v1/clients");
  });

  it("renders contact fields returned by the backend DTO", async () => {
    auth.request.mockResolvedValueOnce(await jsonResponse({
      items: [{
        id: 104,
        name: "Laura Méndez",
        phoneNumber: "8777-4422",
        instagramUser: "lauramendez",
        messengerUser: "Laura Méndez",
        isBlocked: false,
        createdAt: "2026-07-13T00:00:00Z",
      }],
    }));

    renderClients();

    expect(await screen.findByText("8777-4422")).toBeVisible();
    expect(screen.getByText("@lauramendez")).toBeVisible();
    expect(screen.getAllByText("Laura Méndez", { exact: true })).not.toHaveLength(0);
  });

  it("filters the loaded directory by name, phone and social user", async () => {
    const user = userEvent.setup();
    auth.request.mockResolvedValueOnce(
      await jsonResponse([
        clientRecord(),
        clientRecord({ id: 102, name: "Gabriela Mora", phone: "7712-2045", instagram: "gabymora", messenger: "" }),
      ]),
    );

    renderClients();
    await screen.findByText("Gabriela Mora");

    await user.type(screen.getByLabelText("Buscar clientes"), "gabymora");

    expect(screen.getByText("Gabriela Mora")).toBeVisible();
    expect(screen.queryByText("Karla Rodríguez")).not.toBeInTheDocument();
    expect(screen.getByText("1 clienta encontrada")).toBeVisible();
  });

  it("creates a client and reloads the directory", async () => {
    const user = userEvent.setup();
    const created = clientRecord({ id: 103, name: "Ana Lucía Ríos", phone: "8992-0174" });
    auth.request
      .mockResolvedValueOnce(await jsonResponse([]))
      .mockResolvedValueOnce(await jsonResponse(created, 201))
      .mockResolvedValueOnce(await jsonResponse([created]));

    renderClients();
    await user.click(await screen.findByRole("button", { name: "Nueva clienta" }));
    await user.type(screen.getByLabelText("Nombre completo"), "Ana Lucía Ríos");
    await user.type(screen.getByLabelText("Teléfono"), "8992-0174");
    await user.type(screen.getByRole("textbox", { name: "Usuario de Instagram" }), "ana.rios");
    await user.type(screen.getByRole("textbox", { name: "Usuario de Messenger" }), "Ana Ríos");
    await user.click(screen.getByRole("button", { name: "Guardar clienta" }));

    await waitFor(() => expect(screen.getByText("Ana Lucía Ríos")).toBeVisible());
    expect(auth.request).toHaveBeenNthCalledWith(
      2,
      "/api/v1/clients",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lucía Ríos",
          phoneNumber: "8992-0174",
          instagramUser: "ana.rios",
          messengerUser: "Ana Ríos",
          address: "",
          isFriend: false,
          comments: "",
        }),
      }),
    );
  });

  it("edits a client with the selected form values", async () => {
    const user = userEvent.setup();
    const current = clientRecord();
    auth.request
      .mockResolvedValueOnce(await jsonResponse([current]))
      .mockResolvedValueOnce(await jsonResponse({ ...current, phone: "8888-9999" }))
      .mockResolvedValueOnce(await jsonResponse([{ ...current, phone: "8888-9999" }]));

    renderClients();
    await user.click(await screen.findByRole("button", { name: "Editar Karla Rodríguez" }));
    const phone = screen.getByLabelText("Teléfono");
    await user.clear(phone);
    await user.type(phone, "8888-9999");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.getByText("8888-9999")).toBeVisible());
    expect(auth.request).toHaveBeenNthCalledWith(
      2,
      "/api/v1/clients/101",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("blocks a client with a required reason when the admin confirms", async () => {
    const user = userEvent.setup();
    const current = clientRecord();
    auth.request
      .mockResolvedValueOnce(await jsonResponse([current]))
      .mockResolvedValueOnce(await jsonResponse({ ...current, isBlocked: true }))
      .mockResolvedValueOnce(await jsonResponse([{ ...current, isBlocked: true }]));

    renderClients();
    await user.click(await screen.findByRole("button", { name: "Bloquear a Karla Rodríguez" }));
    expect(screen.getByRole("dialog", { name: "Bloquear clienta" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bloquear clienta" })).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo del bloqueo"), "Pedidos no retirados");
    await user.click(screen.getByRole("button", { name: "Bloquear clienta" }));

    await waitFor(() => expect(screen.getByText("Bloqueada")).toBeVisible());
    expect(auth.request).toHaveBeenNthCalledWith(
      2,
      "/api/v1/clients/101/block",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ blockedReason: "Pedidos no retirados" }),
      }),
    );
  });


  it("retries the client list after a loading error", async () => {
    const user = userEvent.setup();
    auth.request
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce(await jsonResponse([clientRecord()]));

    renderClients();

    expect(await screen.findByRole("heading", { name: "No se pudieron cargar las clientas" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Editar Karla Rodríguez" })).toBeVisible());
    expect(auth.request).toHaveBeenCalledTimes(2);
  });

  it("does not show blocking actions to a seller", async () => {
    const user = userEvent.setup();
    auth.session.user.roles = ["Employee"];
    auth.request.mockResolvedValueOnce(await jsonResponse([clientRecord()]));

    renderClients();
    await screen.findByRole("button", { name: "Editar Karla Rodríguez" });

    expect(screen.queryByRole("button", { name: "Bloquear a Karla Rodríguez" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar Karla Rodríguez" }));
    expect(within(screen.getByRole("dialog", { name: "Editar cliente" })).getByLabelText("Nombre completo")).toBeVisible();
  });
});
