import { formatRelativeTime } from "@colloquium/utils";
import type { Plan, Comment } from "@colloquium/types";

interface PlanViewerProps {
  plan: Plan;
  comments: Comment[];
}

export function PlanViewer({ plan, comments }: PlanViewerProps) {
  const commentedLines = new Set(comments.map((c) => c.lineNumber));
  const lines = plan.content.split("\n");

  return (
    <div className="rounded-md border bg-card overflow-auto">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Plan — updated {formatRelativeTime(plan.updatedAt)}
        </span>
        <span className="text-xs text-muted-foreground">{lines.length} lines</span>
      </div>
      <pre className="text-sm font-mono p-0 m-0 overflow-x-auto">
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const hasComment = commentedLines.has(lineNum);
          return (
            <div
              key={lineNum}
              className={`flex group hover:bg-muted/50 ${hasComment ? "bg-yellow-500/10" : ""}`}
            >
              <span className="select-none w-12 shrink-0 text-right pr-4 text-muted-foreground/50 text-xs pt-[3px]">
                {lineNum}
              </span>
              <span className="flex-1 pr-4 whitespace-pre-wrap break-all">{line}</span>
              {hasComment && (
                <span className="shrink-0 w-4 text-yellow-500" title="Has comment">
                  ●
                </span>
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
