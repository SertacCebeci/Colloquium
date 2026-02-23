import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

interface Workspace {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

interface Props {
  children: ReactNode;
}

export function WorkspaceLayout({ children }: Props) {
  const navigate = useNavigate();
  const { "*": wildcard } = useParams();
  const activeSlug = wildcard?.split("/")[0] ?? "";

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/workspaces`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          navigate("/login", { replace: true });
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setWorkspaces(data.workspaces);
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return (
    <div className="flex h-dvh bg-[--color-bg]">
      {/* Workspace rail */}
      <nav
        aria-label="Workspaces"
        className="flex w-14 flex-col items-center gap-2 border-r border-[--color-border] bg-[--color-surface] py-3"
      >
        {workspaces.map((ws) => (
          <Link
            key={ws.id}
            to={`/w/${ws.slug}`}
            aria-label={ws.name}
            title={ws.name}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${
              activeSlug === ws.slug
                ? "bg-[--color-accent] text-[--color-bg]"
                : "hover:bg-[--color-border]"
            }`}
          >
            {ws.icon ?? ws.name[0]}
          </Link>
        ))}

        <Link
          to="/w/new"
          aria-label="Create new workspace"
          title="Create new workspace"
          className="mt-auto flex h-10 w-10 items-center justify-center rounded-xl text-xl text-[--color-text-muted] hover:bg-[--color-border] hover:text-[--color-text]"
        >
          +
        </Link>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
