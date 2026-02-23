import { Badge } from "../components/ui/badge";
import { getStatusLabel, getStatusBadgeVariant } from "@colloquium/utils";
import type { SessionStatus } from "@colloquium/types";

interface StatusBadgeProps {
  status: SessionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={getStatusBadgeVariant(status)}>{getStatusLabel(status)}</Badge>;
}
