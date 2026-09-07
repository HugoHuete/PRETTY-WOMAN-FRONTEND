import { LoginPage } from './features/auth/login-page';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/auth-provider';

function SessionLoading() {
  return <main className="grid min-h-dvh place-items-center bg-pw-canvas text-pw-ink">Restaurando sesión…</main>;
}

function ProtectedHome() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return <HomePage />;
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <LoginPage />;
}

function HomePage() {
  const { session, signOut } = useAuth();
  if (!session) return null;

  return (
    <main className="grid min-h-dvh place-items-center bg-pw-canvas px-4 text-pw-ink">
      <section className="w-full max-w-xl rounded-xl border border-pw-line bg-white p-8 text-center">
        <p className="text-sm font-bold text-pw-brand-deep">Sesión activa</p>
        <h1 className="mt-2 text-3xl font-bold">Bienvenida, {session.user.name}</h1>
        <p className="mt-3 text-pw-muted">Aquí aparecerán los módulos de trabajo.</p>
        <button
          className="mt-6 min-h-12 rounded-lg border border-pw-line px-4 font-bold hover:bg-pw-canvas"
          type="button"
          onClick={() => void signOut()}
        >
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<ProtectedHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
