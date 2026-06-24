-- Optional YouTube cooking video per meal

alter table public.meals
  add column if not exists youtube_url text;
