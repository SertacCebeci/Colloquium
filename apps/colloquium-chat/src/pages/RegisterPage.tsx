import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    username: z
      .string()
      .min(2, "Username must be at least 2 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Username may only contain lowercase letters, numbers, and underscores"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFields = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFields) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          password: data.password,
        }),
      });

      if (res.status === 409) {
        setError("email", { message: "An account with that email already exists" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError("root", {
          message: (body as { error?: string }).error ?? "Registration failed",
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
        <h1 className="mb-1 text-xl font-semibold text-[--color-text]">Create your account</h1>
        <p className="mb-8 text-sm text-[--color-text-muted]">
          Already have one?{" "}
          <Link to="/login" className="text-[--color-accent] hover:underline">
            Sign in
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
              htmlFor="username"
              className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              {...register("username")}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              placeholder="yourname"
            />
            {errors.username && (
              <p className="text-xs text-[--color-danger]">{errors.username.message}</p>
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
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-[--color-danger]">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm-password"
              className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-[--color-danger]">{errors.confirmPassword.message}</p>
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
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
