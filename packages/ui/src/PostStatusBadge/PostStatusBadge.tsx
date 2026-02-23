import type { PostStatus } from "@colloquium/types";

interface PostStatusBadgeProps {
  status: PostStatus;
}

const CONFIG: Record<PostStatus, { label: string; classes: string; dot: string }> = {
  published: {
    label: "Published",
    classes:
      "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 ring-1 ring-emerald-500/20",
    dot: "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]",
  },
  draft: {
    label: "Draft",
    classes: "bg-amber-950/60 text-amber-400 border border-amber-700/50 ring-1 ring-amber-500/20",
    dot: "bg-amber-400",
  },
};

export function PostStatusBadge({ status }: PostStatusBadgeProps) {
  const { label, classes, dot } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-[10px] font-semibold tracking-widest uppercase ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}
