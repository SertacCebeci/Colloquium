import { Card, CardContent, CardHeader } from "../components/ui/card";
import { formatRelativeTime } from "@colloquium/utils";
import { StatusBadge } from "../StatusBadge/StatusBadge";
import type { Session } from "@colloquium/types";

interface SessionCardProps {
  session: Session;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onClick}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-snug line-clamp-2">{session.name}</h3>
          <StatusBadge status={session.status} />
        </div>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className="text-xs text-muted-foreground truncate">{session.workingDirectory}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(session.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
