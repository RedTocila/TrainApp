import Link from "next/link";
import { requireClient } from "@/lib/actions/auth";
import { getPublishedPosts } from "@/lib/actions/blog";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default async function BlogPage() {
  await requireClient();
  const posts = await getPublishedPosts();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Info Blog</h1>
          <p className="text-muted-foreground">Tips, guides, and fitness knowledge</p>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No articles published yet. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <StaggerContainer>
            <div className="space-y-4">
              {posts.map((post) => (
                <StaggerItem key={post.id}>
                  <Link href={`/dashboard/blog/${post.slug}`}>
                    <Card className="transition-transform hover:scale-[1.01]">
                      <CardHeader>
                        <CardTitle>{post.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(post.created_at), "MMMM d, yyyy")}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {post.content.slice(0, 150)}...
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        )}
      </div>
    </PageTransition>
  );
}
