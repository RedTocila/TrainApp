import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { requireClient } from "@/lib/actions/auth";
import { getPostBySlug } from "@/lib/actions/blog";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireClient();
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || !post.published) notFound();

  return (
    <PageTransition>
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/dashboard/blog">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </Link>
        <header>
          <h1 className="text-3xl font-black tracking-tight">{post.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {format(new Date(post.created_at), "MMMM d, yyyy")}
          </p>
        </header>
        <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-primary">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </PageTransition>
  );
}
