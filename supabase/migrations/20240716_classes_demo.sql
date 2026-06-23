-- Demo class so admins and AI subscribers can preview the classes flow

insert into public.classes (
  title,
  slug,
  description,
  category,
  cover_image,
  scheduled_at,
  duration_minutes,
  meeting_url,
  replay_url,
  published
) values (
  'Demo: Full-Body Strength Live',
  'demo-full-body-strength',
  E'## Preview the live class experience\n\nThis is a **demo session** showing how classes work in TrainApp.\n\n- **Live:** Join via Zoom/Meet when the join button is active (15 min before start)\n- **Replay:** Watch the embedded recording anytime after the coach adds a YouTube link\n\n### What you need\n- Dumbbells or water bottles\n- A mat\n- 45 minutes',
  'Training',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50e?w=1200&auto=format&fit=crop',
  now() + interval '3 days',
  45,
  'https://zoom.us/j/00000000000?pwd=demo',
  'https://www.youtube.com/watch?v=UItWltV0mHU',
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  cover_image = excluded.cover_image,
  scheduled_at = excluded.scheduled_at,
  duration_minutes = excluded.duration_minutes,
  meeting_url = excluded.meeting_url,
  replay_url = excluded.replay_url,
  published = excluded.published;
