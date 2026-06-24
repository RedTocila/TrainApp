import type { FitnessClass } from "@/lib/types";

function demoScheduledAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

/** Shown when no classes exist in the database yet (or alongside real classes). */
export const DEMO_CLASS: FitnessClass = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Demo: Full-Body Strength Live",
  slug: "demo-full-body-strength",
  description: `## Preview the live class experience

This is a **demo session** showing how classes work in LevelUp.

- **Live:** Join via Zoom/Meet when the join button is active (15 min before start)
- **Replay:** Watch the embedded recording below anytime

### What you need
- Dumbbells or water bottles
- A mat
- 45 minutes`,
  category: "Training",
  cover_image:
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50e?w=1200&auto=format&fit=crop",
  scheduled_at: demoScheduledAt(),
  duration_minutes: 45,
  meeting_url: "https://zoom.us/j/0000000000?pwd=demo",
  replay_url: "https://www.youtube.com/watch?v=UItWltV0mHU",
  published: true,
  created_at: new Date().toISOString(),
};

export function getDemoClasses(): FitnessClass[] {
  return [DEMO_CLASS];
}

export function getDemoClassBySlug(slug: string): FitnessClass | undefined {
  return slug === DEMO_CLASS.slug ? DEMO_CLASS : undefined;
}
