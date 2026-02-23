import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFields = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFields) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (res.status === 401) {
        setError("root", { message: "Invalid email or password" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError("root", {
          message: (body as { error?: string }).error ?? "Login failed",
        });
        return;
      }

      navigate("/w/new");
    } catch {
      setError("root", { message: "Network error — please try again" });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[--color-bg] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-[--color-text]">Sign in to Colloquium</h1>
        <p className="mb-8 text-sm text-[--color-text-muted]">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-[--color-accent] hover:underline">
            Create one
          </Link>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-xs text-[--color-danger]">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-[--color-danger]">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="rounded-md border border-[--color-danger]/30 bg-[--color-danger]/10 px-3 py-2 text-sm text-[--color-danger]">
              {errors.root.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 rounded-md bg-[--color-accent] px-4 py-2 text-sm font-medium text-[--color-bg] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
