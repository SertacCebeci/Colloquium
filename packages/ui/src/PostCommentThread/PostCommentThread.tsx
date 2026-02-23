import { formatRelativeTime } from "@colloquium/utils";
import type { PostComment } from "@colloquium/types";

interface PostCommentThreadProps {
  comments: PostComment[];
}

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center
                 font-mono text-[10px] font-bold text-zinc-400 select-none"
    >
      {initials}
    </span>
  );
}

export function PostCommentThread({ comments }: PostCommentThreadProps) {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <p className="font-mono text-xs text-zinc-600 py-6 text-center tracking-wide">
        No comments yet — be the first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((comment) => (
        <div key={comment.id} className="flex gap-3 py-5 border-b border-zinc-800/60 last:border-0">
          <AuthorAvatar name={comment.authorName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold text-zinc-300">
                {comment.authorName}
              </span>
              <time
                dateTime={comment.createdAt}
                className="font-mono text-[10px] text-zinc-600 tracking-wide"
              >
                {formatRelativeTime(comment.createdAt)}
              </time>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed break-words">{comment.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
