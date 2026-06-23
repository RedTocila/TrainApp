import { requireAdmin } from "@/lib/actions/auth";
import { createBlogPost } from "@/lib/actions/blog";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewBlogPage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">New Blog Post</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Post Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createBlogPost} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="my-article-slug" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover_image">Cover Image URL (optional)</Label>
                <Input id="cover_image" name="cover_image" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content (Markdown)</Label>
                <Textarea id="content" name="content" rows={12} required />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="published" name="published" className="rounded" />
                <Label htmlFor="published">Publish immediately</Label>
              </div>
              <Button type="submit">Create Post</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
