import Link from "next/link";
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
            Set the tournament length (1–24 months). Three elimination Zoom days are scheduled across
            that period — Round 1 (10→5), Round 2 (1 winner per group), then the champion final.
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
                <Input id="title" name="title" required placeholder="100-person fitness challenge" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required placeholder="summer-challenge-2026" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Start date & time</Label>
                  <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_months">Tournament length (months)</Label>
                  <Input
                    id="duration_months"
                    name="duration_months"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    1, 2, 3, 6, 12, etc. Three elimination Zoom days are spread across this period.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_minutes">Zoom call length (minutes)</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="group_size">Group size (Zoom calls)</Label>
                  <Input
                    id="group_size"
                    name="group_size"
                    type="number"
                    min={2}
                    max={50}
                    defaultValue={10}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="round_1_zoom_at">Round 1 Zoom day (first group hour)</Label>
                  <Input id="round_1_zoom_at" name="round_1_zoom_at" type="datetime-local" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round_2_zoom_at">Round 2 Zoom day (first group hour)</Label>
                  <Input id="round_2_zoom_at" name="round_2_zoom_at" type="datetime-local" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round_3_zoom_at">Champion final Zoom</Label>
                  <Input id="round_3_zoom_at" name="round_3_zoom_at" type="datetime-local" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Zoom dates optional — leave blank to auto-schedule across the tournament length.
              </p>
              <div className="space-y-2">
                <Label htmlFor="final_zoom_url">Final round Zoom link (optional)</Label>
                <Input
                  id="final_zoom_url"
                  name="final_zoom_url"
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prize_pool_euros_per_participant">
                  Prize pool per participant (€)
                </Label>
                <Input
                  id="prize_pool_euros_per_participant"
                  name="prize_pool_euros_per_participant"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Display-only prize pool (no in-app payment). Champion paid manually offline.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  placeholder="Rules, prizes, dates — monthly Zoom eliminations; winners from platform reports + live peer voting."
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
