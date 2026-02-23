import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";

interface Channel {
  id: number;
  name: string;
}

export function WorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    if (!slug) return;
    setChannels([]);
    fetch(`${API_BASE}/api/workspaces/${slug}/channels`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((data) => setChannels(data.channels ?? []));
  }, [slug]);

  return (
    <div className="flex h-full">
      {/* Channel sidebar */}
      <nav
        aria-label="Channels"
        className="flex w-60 flex-col gap-1 overflow-y-auto border-r border-[--color-border] bg-[--color-surface] px-2 py-3"
      >
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">
          Channels
        </p>
        {channels.map((ch) => (
          <Link
            key={ch.id}
            to={`/w/${slug}/c/${ch.name}`}
            aria-label={`# ${ch.name}`}
            className="rounded px-2 py-1 text-sm text-[--color-text-muted] hover:bg-[--color-border] hover:text-[--color-text]"
          >
            # {ch.name}
          </Link>
        ))}
      </nav>

      {/* Main chat area */}
      <div className="flex flex-1 items-center justify-center text-[--color-text-muted]">
        Select a channel
      </div>
    </div>
  );
}
