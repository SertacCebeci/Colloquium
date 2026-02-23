const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
  interrupted: "Interrupted",
  awaiting_input: "Awaiting Input",
  ready_for_review: "Ready for Review",
};

const STATUS_BADGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_progress: "default",
  interrupted: "destructive",
  awaiting_input: "secondary",
  ready_for_review: "outline",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  return STATUS_BADGE_VARIANTS[status] ?? "default";
}

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDuration(startIso: string, endIso?: string): string {
  const ms = new Date(endIso ?? new Date().toISOString()).getTime() - new Date(startIso).getTime();
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function sortSessionsByRecency<T extends { updatedAt: string }>(sessions: T[]): T[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
