import { requireAdmin } from "@/lib/actions/auth";
import { createChallenge } from "@/lib/actions/challenges";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewChallengePage() {
  await requireAdmin();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">New challenge</h1>
          <p className="text-sm text-muted-foreground">
            Members join a LiveKit video room from the Live tab when the session is open.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Challenge details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createChallenge} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="30-day squat challenge kickoff" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="squat-challenge-july" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Start date & time</Label>
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
                <Label htmlFor="room_name">LiveKit room name (optional)</Label>
                <Input
                  id="room_name"
                  name="room_name"
                  placeholder="Defaults to slug if empty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  placeholder="What to prepare, challenge rules, goals..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="published" name="published" className="rounded" />
                <Label htmlFor="published">Publish immediately</Label>
              </div>
              <Button type="submit">Create challenge</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
