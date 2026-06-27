-- Optional DB row for the demo challenge (bracket preview is served in-app when slug is not in DB)

insert into public.challenges (
  id,
  title,
  slug,
  description,
  scheduled_at,
  duration_minutes,
  group_size,
  final_zoom_url,
  published
) values (
  '00000000-0000-4000-8000-000000000002',
  'Demo: 100-Person Summer Challenge',
  'demo-summer-challenge',
  E'## Preview the tournament bracket\n\nSee the in-app demo for the full bracket with 30 participants, group winners, and a champion.',
  now() - interval '10 minutes',
  120,
  10,
  'https://zoom.us/j/11111111111?pwd=demo-final',
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  scheduled_at = excluded.scheduled_at,
  duration_minutes = excluded.duration_minutes,
  group_size = excluded.group_size,
  final_zoom_url = excluded.final_zoom_url,
  published = excluded.published;
