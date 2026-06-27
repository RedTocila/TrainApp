import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth";
import { getChallengeById, updateChallenge } from "@/lib/actions/challenges";
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

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const challenge = await getChallengeById(id);
  if (!challenge) notFound();

  const updateWithId = updateChallenge.bind(null, id);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Edit challenge</h1>
            <p className="text-sm text-muted-foreground">
              Update schedule, group size, or final Zoom link.
            </p>
          </div>
          <Link href={`/admin/challenges/${id}/bracket`}>
            <Button variant="outline" size="sm">
              Manage bracket
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateWithId} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required defaultValue={challenge.title} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required defaultValue={challenge.slug} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Start date & time</Label>
                  <Input
                    id="scheduled_at"
                    name="scheduled_at"
                    type="datetime-local"
                    required
                    defaultValue={toDatetimeLocalValue(challenge.scheduled_at)}
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
                    defaultValue={challenge.duration_minutes}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group_size">Group size</Label>
                  <Input
                    id="group_size"
                    name="group_size"
                    type="number"
                    min={2}
                    max={50}
                    required
                    defaultValue={challenge.group_size}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="final_zoom_url">Final round Zoom link</Label>
                <Input
                  id="final_zoom_url"
                  name="final_zoom_url"
                  defaultValue={challenge.final_zoom_url ?? ""}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  defaultValue={challenge.description}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published"
                  name="published"
                  className="rounded"
                  defaultChecked={challenge.published}
                />
                <Label htmlFor="published">Published</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save changes</Button>
                <Link href="/admin/challenges">
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
