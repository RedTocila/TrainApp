import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllPosts } from "@/lib/actions/blog";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { DeleteBlogButton } from "@/components/delete-blog-button";

export default async function AdminBlogPage() {
  await requireAdmin();
  const posts = await getAllPosts();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Blog Posts</h1>
            <p className="text-muted-foreground">Manage info articles for clients</p>
          </div>
          <Link href="/admin/blog/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Post
            </Button>
          </Link>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No blog posts yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{post.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(post.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={post.published ? "success" : "secondary"}>
                      {post.published ? "Published" : "Draft"}
                    </Badge>
                    <DeleteBlogButton postId={post.id} />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
