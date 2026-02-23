import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type { CreatePostCommentRequest } from "@colloquium/types";

interface PostCommentFormProps {
  onSubmit: (req: CreatePostCommentRequest) => Promise<void>;
}

export function PostCommentForm({ onSubmit }: PostCommentFormProps) {
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !body.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ authorName: authorName.trim(), body: body.trim() });
      setBody("");
      // Keep authorName so users don't have to retype their name
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = authorName.trim().length > 0 && body.trim().length > 0 && !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4">
      <Input
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm
                   focus:border-amber-500 focus:ring-amber-500/20 max-w-xs"
        required
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment…"
        aria-label="Comment"
        rows={4}
        className="bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 text-sm
                   leading-relaxed resize-none focus:border-amber-500 focus:ring-amber-500/20"
        required
      />
      <Button
        type="submit"
        disabled={!canSubmit}
        className="self-start bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700
                   font-mono text-xs tracking-widest uppercase h-9 px-5 rounded-sm transition-colors
                   disabled:opacity-40"
      >
        {isSubmitting ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
