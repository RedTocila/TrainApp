import { requireAdmin } from "@/lib/actions/auth";
import { createClass } from "@/lib/actions/classes";
import { CLASS_CATEGORIES } from "@/lib/class-utils";
import { AdminBackLink } from "@/components/admin-back-link";
import { ClassCoverImageField } from "@/components/class-cover-image-field";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewClassPage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <AdminBackLink href="/admin/classes" label="Back to classes" />
        <div>
          <h1 className="text-2xl font-black">New live class</h1>
          <p className="text-sm text-muted-foreground">
            Add a YouTube Live URL for the stream. After class, paste the same or updated YouTube
            link as the replay so clients can watch later.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Class details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createClass} encType="multipart/form-data" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Full-body strength live" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="full-body-strength-mar-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="Training"
                >
                  {CLASS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Live date & time</Label>
                  <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                  <Input
                    id="duration_minutes"
                    name="duration_minutes"
                    type="number"
                    min={15}
                    step={15}
                    defaultValue={60}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting_url">YouTube Live URL</Label>
                <Input
                  id="meeting_url"
                  name="meeting_url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay_url">Replay link (YouTube — add after class ends)</Label>
                <Input
                  id="replay_url"
                  name="replay_url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <ClassCoverImageField />
              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={8}
                  placeholder="What clients will need, equipment, focus areas..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="published" name="published" className="rounded" />
                <Label htmlFor="published">Publish immediately</Label>
              </div>
              <Button type="submit">Create class</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
