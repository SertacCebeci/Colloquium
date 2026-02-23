import { useState, useEffect } from "react";
import { slugify } from "@colloquium/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { Post, CreatePostRequest, UpdatePostRequest, PostStatus } from "@colloquium/types";

interface PostFormProps {
  initialValues?: Partial<Post>;
  onSubmit: (req: CreatePostRequest | UpdatePostRequest) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function PostForm({
  initialValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Publish post",
}: PostFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [body, setBody] = useState(initialValues?.body ?? "");
  const [authorName, setAuthorName] = useState(initialValues?.authorName ?? "");
  const [status, setStatus] = useState<PostStatus>(initialValues?.status ?? "draft");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialValues?.slug);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from title unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !slug.trim() || !body.trim() || !authorName.trim()) {
      setError("All fields are required.");
      return;
    }
    try {
      await onSubmit({
        title: title.trim(),
        slug: slug.trim(),
        body: body.trim(),
        authorName: authorName.trim(),
        status,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="post-title"
          className="font-mono text-xs text-zinc-400 tracking-widest uppercase"
        >
          Title
        </Label>
        <Input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The title of your post"
          className="bg-zinc-900 border-zinc-700 text-zinc-100 font-serif text-lg placeholder:text-zinc-600
                     focus:border-amber-500 focus:ring-amber-500/20 h-12"
          required
        />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="post-slug"
          className="font-mono text-xs text-zinc-400 tracking-widest uppercase"
        >
          Slug
        </Label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-600 select-none">/posts/</span>
          <Input
            id="post-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            placeholder="url-slug"
            className="bg-zinc-900 border-zinc-700 text-zinc-100 font-mono text-sm placeholder:text-zinc-600
                       focus:border-amber-500 focus:ring-amber-500/20"
            required
          />
        </div>
      </div>

      {/* Author */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="post-author"
          className="font-mono text-xs text-zinc-400 tracking-widest uppercase"
        >
          Author
        </Label>
        <Input
          id="post-author"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name"
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600
                     focus:border-amber-500 focus:ring-amber-500/20"
          required
        />
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <Label className="font-mono text-xs text-zinc-400 tracking-widest uppercase">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PostStatus)}>
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 focus:ring-amber-500/20 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="draft" className="text-amber-400 focus:bg-zinc-800">
              Draft
            </SelectItem>
            <SelectItem value="published" className="text-emerald-400 focus:bg-zinc-800">
              Published
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="post-body"
          className="font-mono text-xs text-zinc-400 tracking-widest uppercase"
        >
          Content
        </Label>
        <Textarea
          id="post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your post here… Use double line breaks for paragraphs."
          rows={14}
          className="bg-zinc-900 border-zinc-700 text-zinc-200 font-serif text-sm leading-relaxed
                     placeholder:text-zinc-600 resize-y focus:border-amber-500 focus:ring-amber-500/20"
          required
        />
      </div>

      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}

      <Button
        type="submit"
        disabled={isLoading}
        className="self-start bg-amber-600 hover:bg-amber-500 text-zinc-950 font-mono text-sm
                   tracking-widest uppercase font-semibold px-8 h-10 rounded-sm transition-colors"
      >
        {isLoading ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
