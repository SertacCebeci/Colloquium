import type { Peer } from "@colloquium/types";
import { cn } from "../lib/utils";

interface AvatarNameplateProps {
  peer: Pick<Peer, "displayName" | "color">;
  isLocal?: boolean;
  className?: string;
}

export function AvatarNameplate({ peer, isLocal, className }: AvatarNameplateProps) {
  const initials = peer.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn("flex flex-col items-center gap-1 pointer-events-none select-none", className)}
    >
      {/* Avatar circle */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-lg ring-2 ring-white/60"
        style={{ backgroundColor: peer.color }}
      >
        {initials}
      </div>

      {/* Name tag */}
      <div className="bg-white/90 backdrop-blur-sm text-[11px] font-medium text-stone-700 px-2.5 py-0.5 rounded-full shadow-sm border border-stone-200/60 whitespace-nowrap leading-5">
        {isLocal ? `${peer.displayName} (you)` : peer.displayName}
      </div>
    </div>
  );
}
