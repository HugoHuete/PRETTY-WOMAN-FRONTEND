import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/auth-provider';
import { LoginPage } from './features/auth/login-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { UsersPage } from './features/users/users-page';
import { AppShell } from './shared/layout/app-shell';
import { EmptyState, PermissionDeniedState } from './shared/ui/screen-state';

function SessionLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-pw-canvas text-pw-ink">
      Restaurando sesión…
    </main>
  );
}

function ProtectedRoutes() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return <Outlet />;
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <LoginPage />;
}

function RoleRoute({ roles, children }: { roles: readonly string[]; children: ReactNode }) {
  const { session } = useAuth();
  const hasRole = roles.some((role) => session?.user.roles.includes(role));
  return hasRole ? children : <PermissionDeniedState />;
}

function UpcomingPage({ title: _title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      title="Esta sección estará disponible pronto"
      description={`${description} La estructura de navegación ya está lista para integrar este módulo.`}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LoginRoute />} path="/login" />
        <Route element={<ProtectedRoutes />}>
          <Route element={<AppShell />}>
            <Route element={<DashboardPage />} index />
            <Route
              element={
                <UpcomingPage
                  title="Envíos"
                  description="Da seguimiento a los pedidos y entregas de la boutique."
                />
              }
              path="shipments"
            />
            <Route
              element={
                <UpcomingPage
                  title="Productos"
                  description="Consulta el catálogo y la disponibilidad de prendas."
                />
              }
              path="products"
            />
            <Route
              element={
                <UpcomingPage
                  title="Clientes"
                  description="Administra la información de las personas clientas."
                />
              }
              path="clients"
            />
            <Route
              element={
                <UpcomingPage
                  title="Ventas"
                  description="Consulta y registra las ventas de la boutique."
                />
              }
              path="sales"
            />
            <Route
              element={
                <UpcomingPage
                  title="Reservas"
                  description="Da seguimiento a las prendas reservadas."
                />
              }
              path="reservations"
            />
            <Route
              element={
                <RoleRoute roles={['Admin']}>
                  <UpcomingPage
                    title="Compras"
                    description="Gestiona órdenes de compra y recepción de mercancía."
                  />
                </RoleRoute>
              }
              path="purchases/orders"
            />
            <Route
              element={
                <UpcomingPage
                  title="Incidencias"
                  description="Consulta incidencias y disponibilidad relacionada."
                />
              }
              path="inventory/issues"
            />
            <Route
              element={
                <RoleRoute roles={['Admin']}>
                  <UpcomingPage
                    title="Campañas"
                    description="Administra campañas y descuentos de la boutique."
                  />
                </RoleRoute>
              }
              path="discounts/campaigns"
            />
            <Route
              element={<Navigate replace to="/discounts/campaigns" />}
              path="campaigns"
            />
            <Route
              element={
                <RoleRoute roles={['Admin']}>
                  <UsersPage />
                </RoleRoute>
              }
              path="users"
            />
            <Route
              element={
                <RoleRoute roles={['Admin']}>
                  <UpcomingPage
                    title="Finanzas"
                    description="Consulta el estado financiero de la boutique."
                  />
                </RoleRoute>
              }
              path="finances"
            />
          </Route>
        </Route>
        <Route element={<Navigate to="/" replace />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
