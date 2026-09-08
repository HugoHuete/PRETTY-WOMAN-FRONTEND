import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const auth = vi.hoisted(() => ({
  value: {
    status: "authenticated" as const,
    session: {
      accessToken: "token",
      expiresAtUtc: "2099-01-01T00:00:00Z",
      csrfToken: null,
      user: {
        id: "user-1",
        username: "maria",
        email: "maria@example.com",
        name: "María",
        lastname: "Pérez",
        enabled: true,
        roles: ["Employee"],
      },
    },
    signOut: vi.fn(async () => undefined),
  },
}));

vi.mock("../../features/auth/auth-provider", () => ({
  useAuth: () => auth.value,
}));

afterEach(() => {
  auth.value.session.user.roles = ["Employee"];
  vi.clearAllMocks();
});

function renderShell(roles: string[] = ["Employee"], path = "/sales") {
  auth.value.session.user.roles = roles;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />} path="*">
          <Route element={<div>Contenido de prueba</div>} path="*" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("opens the tablet menu and closes it with Escape", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Abrir navegación" }));
    expect(
      screen.getByRole("dialog", { name: "Menú de navegación" }),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("dialog", { name: "Menú de navegación" }),
      ).getByRole("navigation", { name: "Navegación principal" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Menú de navegación" }),
    ).not.toBeInTheDocument();
  });

  it("closes the mobile drawer when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Abrir navegación" }));
    await user.click(screen.getByRole("presentation"));

    expect(
      screen.queryByRole("dialog", { name: "Menú de navegación" }),
    ).not.toBeInTheDocument();
  });

  it("marks the current route and omits admin links for Employee", () => {
    renderShell(["Employee"], "/sales");

    expect(
      screen.getByRole("img", { name: "Pretty Woman Boutique" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("María Pérez")).toHaveLength(1);
    expect(
      within(
        screen.getByRole("button", { name: "Abrir perfil de María Pérez" }),
      ).getByText("Ventas"),
    ).toBeVisible();
    expect(screen.getAllByText("Operación")).toHaveLength(2);
    const themeButton = screen.getByRole("button", { name: /modo oscuro/i });
    expect(themeButton).toHaveAttribute("aria-pressed", "false");
    expect(themeButton.querySelector(".pw-theme-switch")).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Cerrar sesión",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Envíos" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Usuarios" }),
    ).not.toBeInTheDocument();
  });

  it("keeps sign out in the sidebar profile menu", async () => {
    const user = userEvent.setup();
    renderShell(["Admin"]);

    await user.click(
      screen.getByRole("button", { name: "Abrir perfil de María Pérez" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeVisible();

    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(auth.value.signOut).toHaveBeenCalledOnce();
  });
});
