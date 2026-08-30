import { useState } from "react";
import brandLogo from "../../../assets/brand/Pink_Logo_v1.png";
import { AuthApiError } from "./auth-session";
import { useAuth } from "./auth-provider";

type FieldErrors = { username?: string; password?: string };

const inputClasses =
  "min-h-12 w-full rounded-lg border border-pw-line bg-white px-3 text-pw-ink outline-none transition focus:border-pw-brand-deep focus:ring-3 focus:ring-pw-brand-soft aria-invalid:border-red-700 disabled:cursor-wait";

export function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    const nextErrors: FieldErrors = {};

    if (!trimmedUsername) nextErrors.username = "Ingresa tu usuario.";
    if (!password) nextErrors.password = "Ingresa tu contraseña.";

    setFieldErrors(nextErrors);
    setFeedback("");
    if (Object.keys(nextErrors).length > 0) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      setFeedback("No se configuró la dirección del servidor.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(trimmedUsername, password);
      setFeedback("Acceso correcto. Estamos preparando tu espacio de trabajo.");
    } catch (error) {
      setFeedback(
        error instanceof AuthApiError
          ? error.detail
          : "No se pudo conectar con el servidor. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-pw-canvas px-4 py-6 text-pw-ink sm:px-10 sm:py-7">
      <a
        className="inline-flex w-max justify-self-center focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-3"
        href="/"
        aria-label="Pretty Woman Boutique"
      >
        <img
          className="h-20 w-auto max-w-55 object-contain sm:h-28 sm:max-w-62.5"
          src={brandLogo}
          alt="Pretty Woman Boutique"
        />
      </a>

      <section
        className="flex justify-center py-6 sm:py-8"
        aria-labelledby="login-title"
      >
        <div className="w-full max-w-117.5 rounded-xl border border-pw-line bg-white px-5 py-7 sm:px-9 sm:py-8">
          <header className="mb-6 text-center">
            <p className="mb-1.5 text-[13px] font-extrabold text-pw-brand-deep">
              Acceso al equipo
            </p>
            <h1
              id="login-title"
              className="mb-2 text-3xl font-bold tracking-tight"
            >
              Inicia sesión
            </h1>
            <p className="text-[15px] text-pw-muted">
              Ingresa con tu usuario y contraseña.
            </p>
          </header>

          <form className="grid gap-2" onSubmit={handleSubmit} noValidate>
            <fieldset
              className="grid min-w-0 gap-2 disabled:cursor-wait"
              disabled={isSubmitting}
            >
              <label className="text-sm font-bold" htmlFor="username">
                Usuario
              </label>
              <input
                className={inputClasses}
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  clearFieldError("username");
                }}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={
                  fieldErrors.username ? "username-error" : undefined
                }
              />
              {fieldErrors.username ? (
                <p
                  className="min-h-5 text-xs font-bold text-red-700"
                  id="username-error"
                >
                  {fieldErrors.username}
                </p>
              ) : null}

              <div className="mt-2 flex items-baseline justify-between gap-3">
                <label className="text-sm font-bold" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <input
                  className={`${inputClasses} pr-16`}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError("password");
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                />
                <button
                  className="absolute top-1 right-1 h-9 px-2 text-xs font-extrabold text-pw-muted focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-2"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {fieldErrors.password ? (
                <p
                  className="min-h-5 text-xs font-bold text-red-700"
                  id="password-error"
                >
                  {fieldErrors.password}
                </p>
              ) : null}

              <label className="my-2 flex items-center gap-2 text-[13px] font-semibold text-pw-muted">
                <input
                  className="size-4 accent-pw-brand"
                  type="checkbox"
                  name="remember"
                />
                <span>Recordarme en este equipo</span>
              </label>
              <button
                className="min-h-12 rounded-lg bg-pw-brand text-sm font-extrabold text-white transition-colors hover:bg-pw-brand-deep focus-visible:outline-3 focus-visible:outline-pw-brand-deep focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-70"
                type="submit"
              >
                {isSubmitting ? "Ingresando…" : "Ingresar"}
              </button>
            </fieldset>
            <p
              className="min-h-5 text-xs font-bold text-red-700"
              role="status"
              aria-live="polite"
            >
              {feedback}
            </p>
          </form>
        </div>
      </section>

    </main>
  );
}
