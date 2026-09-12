import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-provider";
import {
  getVisibleNavigation,
  type NavigationGroup,
  type NavigationIcon,
} from "../navigation/app-navigation";
import { PageActionsProvider, usePageActions } from "./page-actions-context";
import { ToastProvider } from "../ui/toast-provider";

const brandLogoUrl =
  "https://media.prettywomanboutiquenic.com/branding/white_logo.png";

const iconPaths: Record<NavigationIcon, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3Z" />
      <path d="M14 10h4l3 3v4h-7Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M16.5 15a4.5 4.5 0 0 1 4 5" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 7.5 9 4.5 9-4.5V17l-9 4-9-4Z" />
      <path d="M12 12v9" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.2 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M8 11h8M8 15h8" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h12" />
      <path d="M16 13h3" />
    </>
  ),
  calendar: (
    <>
      <path d="M4 6h16v15H4Z" />
      <path d="M8 3v6M16 3v6M4 11h16M8 15h3M14 15h2" />
    </>
  ),
  campaign: (
    <>
      <path d="M4 7h16v12H4Z" />
      <path d="M8 4v6M16 4v6M4 11h16M8 15h3M14 15h2" />
    </>
  ),
};

function ShellIcon({ icon }: { icon: NavigationIcon }) {
  return (
    <svg
      aria-hidden="true"
      className="pw-nav-icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[icon]}
    </svg>
  );
}

function Navigation({
  groups,
  onNavigate,
}: {
  groups: NavigationGroup[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegación principal" className="pw-navigation">
      {groups.map((group) => (
        <section className="pw-navigation-group" key={group.label}>
          <h2 className="pw-navigation-title">{group.label}</h2>
          {group.items.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `pw-navigation-link${isActive ? " is-current" : ""}`
              }
              end={item.to === "/"}
              key={item.to}
              title={item.label}
              to={item.to}
              onClick={onNavigate}
            >
              <ShellIcon icon={item.icon} />
              <span className="pw-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </section>
      ))}
    </nav>
  );
}

function Profile({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      )
        setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={profileRef} className="pw-profile-container">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Abrir perfil de ${name}`}
        className="pw-profile"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="pw-avatar">
          {initials}
        </span>
        <span className="pw-profile-copy">
          <strong>{name}</strong>
          <small>{role}</small>
        </span>
        <span aria-hidden="true" className="pw-profile-chevron">
          ⌄
        </span>
      </button>
      {open ? (
        <div
          aria-label="Opciones de perfil"
          className="pw-profile-menu"
          role="menu"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  groups,
  name,
  role,
  onSignOut,
  onNavigate,
}: {
  groups: NavigationGroup[];
  name: string;
  role: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="pw-brand">
        <img src={brandLogoUrl} alt="Pretty Woman Boutique" />
      </div>
      <Navigation groups={groups} onNavigate={onNavigate} />
      <div className="pw-sidebar-footer">
        <Profile name={name} role={role} onSignOut={onSignOut} />
      </div>
    </>
  );
}

type DrawerProps = {
  groups: NavigationGroup[];
  name: string;
  role: string;
  onSignOut: () => void;
  onClose: () => void;
};

function NavigationDrawer({
  groups,
  name,
  role,
  onSignOut,
  onClose,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button, a[href]"),
      );
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="pw-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        aria-label="Menú de navegación"
        className="pw-drawer"
        role="dialog"
        aria-modal="true"
      >
        <button
          ref={closeRef}
          aria-label="Cerrar navegación"
          className="pw-drawer-close"
          type="button"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
        <SidebarContent
          groups={groups}
          name={name}
          role={role}
          onSignOut={onSignOut}
          onNavigate={onClose}
        />
      </div>
    </div>
  );
}

function AppShellContent() {
  const { session, signOut } = useAuth();
  const { action, heading } = usePageActions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return (
        localStorage.getItem("pw-theme") === "dark" ||
        document.documentElement.dataset.theme === "dark"
      );
    } catch {
      return document.documentElement.dataset.theme === "dark";
    }
  });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const groups = getVisibleNavigation(session?.user.roles ?? []);
  const currentGroup = groups.find((group) =>
    group.items.some((item) => item.to === location.pathname),
  );
  const currentItem = currentGroup?.items.find(
    (item) => item.to === location.pathname,
  );
  const userName =
    `${session?.user.name ?? ""} ${session?.user.lastname ?? ""}`.trim() ||
    "Equipo Pretty Woman";
  const userRole = session?.user.roles.includes("Admin") ? "Admin" : "Ventas";
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    try {
      localStorage.setItem("pw-theme", darkMode ? "dark" : "light");
    } catch {
      // La preferencia visual sigue funcionando aunque el navegador bloquee storage.
    }
  }, [darkMode]);

  useEffect(() => {
    if (!drawerOpen) menuButtonRef.current?.focus();
  }, [drawerOpen]);

  return (
    <div className="pw-app-shell">
      <aside aria-label="Navegación principal" className="pw-sidebar">
        <SidebarContent
          groups={groups}
          name={userName}
          role={userRole}
          onSignOut={() => void signOut()}
        />
      </aside>

      {drawerOpen ? (
        <NavigationDrawer
          groups={groups}
          name={userName}
          role={userRole}
          onSignOut={() => void signOut()}
          onClose={closeDrawer}
        />
      ) : null}

      <div className="pw-app-main">
        <header className="pw-topbar">
          <div className="pw-topbar-heading">
            <button
              ref={menuButtonRef}
              aria-label="Abrir navegación"
              aria-expanded={drawerOpen}
              className="pw-menu-button"
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <div>
              <p className="pw-crumb">
                {heading?.breadcrumbs ?? currentGroup?.label ?? "Pretty Woman"}
              </p>
              <h1>
                {heading?.title ?? currentItem?.label ?? "Panel administrativo"}
              </h1>
            </div>
          </div>
          <div className="pw-top-actions">
            {action}
            <button
              aria-label={
                darkMode ? "Activar modo claro" : "Activar modo oscuro"
              }
              aria-pressed={darkMode}
              className="pw-theme-button"
              type="button"
              onClick={() => setDarkMode((value) => !value)}
            >
              <span aria-hidden="true" className="pw-theme-switch">
                ◐
              </span>
              <span className="pw-theme-label">
                {darkMode ? "Modo claro" : "Modo oscuro"}
              </span>
            </button>
          </div>
        </header>

        <main className="pw-workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <ToastProvider>
      <PageActionsProvider>
        <AppShellContent />
      </PageActionsProvider>
    </ToastProvider>
  );
}
