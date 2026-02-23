import type { Peer } from "@colloquium/types";
import { cn } from "../lib/utils";

interface PresenceBarProps {
  peers: Peer[];
  currentUserId?: string;
  className?: string;
}

export function PresenceBar({ peers, currentUserId, className }: PresenceBarProps) {
  return (
    <div
      className={cn(
        "w-56 flex flex-col gap-0 overflow-hidden",
        "bg-white/75 backdrop-blur-xl",
        "border border-stone-200/50 rounded-2xl shadow-xl shadow-stone-900/8",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100/80">
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: "#2D6A4F" }}
        >
          In the office
        </span>
        <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full tabular-nums">
          {peers.length}
        </span>
      </div>

      {/* Peer list */}
      <div className="flex flex-col overflow-y-auto max-h-72 py-1.5 px-1.5 gap-0.5">
        {peers.map((peer) => {
          const initials = peer.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const isYou = peer.userId === currentUserId;

          return (
            <div
              key={peer.userId}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-stone-50/80 transition-colors"
            >
              {/* Avatar dot */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: peer.color }}
              >
                {initials}
              </div>

              {/* Name */}
              <span className="text-sm text-stone-700 font-medium truncate flex-1">
                {peer.displayName}
                {isYou && <span className="text-stone-400 font-normal ml-1 text-[11px]">you</span>}
              </span>

              {/* Online indicator */}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm" />
            </div>
          );
        })}

        {peers.length === 0 && (
          <p className="text-xs text-stone-400 text-center py-4 px-2">No one else is here yet</p>
        )}
      </div>
    </div>
  );
}
