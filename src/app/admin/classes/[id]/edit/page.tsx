import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getClassById, updateClass } from "@/lib/actions/classes";
import { CLASS_CATEGORIES } from "@/lib/class-utils";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const fitnessClass = await getClassById(id);
  if (!fitnessClass) notFound();

  const updateWithId = updateClass.bind(null, id);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Edit class</h1>
          <p className="text-sm text-muted-foreground">
            Add or update the YouTube replay link after the live session ends.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{fitnessClass.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateWithId} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required defaultValue={fitnessClass.title} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required defaultValue={fitnessClass.slug} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={fitnessClass.category}
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
                  <Input
                    id="scheduled_at"
                    name="scheduled_at"
                    type="datetime-local"
                    required
                    defaultValue={toDatetimeLocalValue(fitnessClass.scheduled_at)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                  <Input
                    id="duration_minutes"
                    name="duration_minutes"
                    type="number"
                    min={15}
                    step={15}
                    required
                    defaultValue={fitnessClass.duration_minutes}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting_url">Live meeting link (Zoom / Meet)</Label>
                <Input
                  id="meeting_url"
                  name="meeting_url"
                  type="url"
                  defaultValue={fitnessClass.meeting_url ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay_url">Replay link (YouTube)</Label>
                <Input
                  id="replay_url"
                  name="replay_url"
                  type="url"
                  defaultValue={fitnessClass.replay_url ?? ""}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover_image">Cover image URL (optional)</Label>
                <Input
                  id="cover_image"
                  name="cover_image"
                  defaultValue={fitnessClass.cover_image ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={8}
                  defaultValue={fitnessClass.description}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published"
                  name="published"
                  className="rounded"
                  defaultChecked={fitnessClass.published}
                />
                <Label htmlFor="published">Published</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save changes</Button>
                <Link href="/admin/classes">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
