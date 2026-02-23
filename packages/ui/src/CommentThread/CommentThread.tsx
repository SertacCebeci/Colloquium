import { formatRelativeTime } from "@colloquium/utils";
import type { Comment } from "@colloquium/types";

interface CommentThreadProps {
  comments: Comment[];
}

export function CommentThread({ comments }: CommentThreadProps) {
  const sorted = [...comments].sort((a, b) => {
    if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-4 py-2">No comments yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y">
      {sorted.map((comment) => (
        <div key={comment.id} className="px-4 py-3 flex gap-3">
          <span className="shrink-0 text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 h-fit">
            L{comment.lineNumber}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm break-words">{comment.body}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(comment.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
