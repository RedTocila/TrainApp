"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBlogPost } from "@/lib/actions/blog";
import { Button } from "@/components/ui/button";

export function DeleteBlogButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => startTransition(() => { void deleteBlogPost(postId); })}
    >
      <Trash2 className="h-4 w-4 text-red-400" />
    </Button>
  );
}
