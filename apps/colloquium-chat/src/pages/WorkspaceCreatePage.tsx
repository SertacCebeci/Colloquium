import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

const EMOJI_OPTIONS = [
  "🚀",
  "💬",
  "🎯",
  "⚡",
  "🌍",
  "🔥",
  "💡",
  "🛠️",
  "🎨",
  "📚",
  "🤝",
  "🏆",
  "🌱",
  "🎵",
  "🔮",
  "🦋",
  "🐳",
  "🦄",
  "🍀",
  "⭐",
];

export function WorkspaceCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(EMOJI_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), icon }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to create workspace");
        setSubmitting(false);
        return;
      }

      const { workspace } = await res.json();
      navigate(`/w/${workspace.slug}`, { replace: true });
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[--color-bg] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-[--color-text]">Create a workspace</h1>
        <p className="mb-8 text-sm text-[--color-text-muted]">
          A workspace is where your team communicates.
        </p>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="workspace-name"
              className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]"
            >
              Workspace name
            </label>
            <input
              id="workspace-name"
              type="text"
              placeholder="My Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none focus:ring-1 focus:ring-[--color-accent]"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
              Icon
            </span>
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label="select emoji"
                  aria-pressed={icon === emoji}
                  onClick={() => setIcon(emoji)}
                  className={`rounded p-1 text-lg transition-colors ${
                    icon === emoji
                      ? "bg-[--color-accent] text-[--color-bg]"
                      : "hover:bg-[--color-surface]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="mt-1 rounded-md bg-[--color-accent] px-4 py-2 text-sm font-medium text-[--color-bg] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
