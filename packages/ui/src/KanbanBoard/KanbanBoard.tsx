import { getStatusLabel } from "@colloquium/utils";
import { Badge } from "../components/ui/badge";
import { SessionCard } from "../SessionCard/SessionCard";
import type { Session, SessionStatus } from "@colloquium/types";

const COLUMNS: SessionStatus[] = [
  "in_progress",
  "awaiting_input",
  "interrupted",
  "ready_for_review",
];

interface KanbanBoardProps {
  sessions: Session[];
  onSessionClick: (id: string) => void;
}

export function KanbanBoard({ sessions, onSessionClick }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
      {COLUMNS.map((status) => {
        const columnSessions = sessions.filter((s) => s.status === status);
        return (
          <div key={status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {getStatusLabel(status)}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {columnSessions.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 min-h-[120px]">
              {columnSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => onSessionClick(session.id)}
                />
              ))}
              {columnSessions.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground text-center">
                  No sessions
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
