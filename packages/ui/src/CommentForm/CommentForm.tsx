import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type { CreateCommentRequest } from "@colloquium/types";

interface CommentFormProps {
  onSubmit: (req: CreateCommentRequest) => Promise<void>;
  lineCount: number;
}

export function CommentForm({ onSubmit, lineCount }: CommentFormProps) {
  const [lineNumber, setLineNumber] = useState(1);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ lineNumber, body: body.trim() });
      setBody("");
      setLineNumber(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="line-number" className="text-xs shrink-0">
          Line
        </Label>
        <Input
          id="line-number"
          type="number"
          min={1}
          max={lineCount}
          value={lineNumber}
          onChange={(e) => setLineNumber(Number(e.target.value))}
          className="w-20 h-7 text-sm"
        />
      </div>
      <Textarea
        placeholder="Leave a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />
      <Button type="submit" size="sm" disabled={isSubmitting || !body.trim()}>
        {isSubmitting ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
