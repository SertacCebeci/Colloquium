import { formatRelativeTime, truncate } from "@colloquium/utils";
import type { Post } from "@colloquium/types";
import { PostStatusBadge } from "../PostStatusBadge/PostStatusBadge";

interface PostCardProps {
  post: Post;
  index?: number;
  onClick: () => void;
}

export function PostCard({ post, index, onClick }: PostCardProps) {
  const excerpt = truncate(post.body, 160);

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group relative grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 py-8 border-b border-zinc-800 cursor-pointer
                 hover:bg-zinc-900/40 transition-colors duration-200 px-4 -mx-4 rounded-sm focus:outline-none
                 focus-visible:ring-1 focus-visible:ring-amber-500"
    >
      {/* Index number */}
      {index !== undefined && (
        <span
          className="row-span-3 self-start pt-1 font-mono text-xs text-zinc-600 select-none w-6 text-right
                     group-hover:text-amber-600 transition-colors duration-200"
        >
          {String(index).padStart(2, "0")}
        </span>
      )}

      {/* Title */}
      <h2 className="font-serif text-xl font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors duration-150">
        <span className="relative">
          {post.title}
          {/* Amber underline reveal on hover */}
          <span
            className="absolute bottom-0 left-0 h-px w-0 bg-amber-500 group-hover:w-full transition-all duration-300 ease-out"
            aria-hidden
          />
        </span>
      </h2>

      {/* Excerpt */}
      <p className="text-sm text-zinc-400 leading-relaxed mt-1 line-clamp-2">{excerpt}</p>

      {/* Metadata row */}
      <footer className="flex items-center gap-3 mt-2 flex-wrap">
        <PostStatusBadge status={post.status} />
        <span className="font-mono text-[11px] text-zinc-500 tracking-wide">{post.authorName}</span>
        <span className="font-mono text-[11px] text-zinc-600" aria-hidden>
          ·
        </span>
        <time
          dateTime={post.publishedAt ?? post.createdAt}
          className="font-mono text-[11px] text-zinc-500"
        >
          {formatRelativeTime(post.publishedAt ?? post.createdAt)}
        </time>
      </footer>
    </article>
  );
}
