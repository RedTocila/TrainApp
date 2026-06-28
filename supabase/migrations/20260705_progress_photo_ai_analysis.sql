-- AI analysis per pose on progress photo sets (Coach Alex vision review)
alter table public.progress_photo_sets
  add column if not exists front_analysis jsonb,
  add column if not exists back_analysis jsonb,
  add column if not exists side_analysis jsonb;

comment on column public.progress_photo_sets.front_analysis is 'Coach Alex vision analysis for front pose (validity, physique notes, focus tips)';
comment on column public.progress_photo_sets.back_analysis is 'Coach Alex vision analysis for back pose';
comment on column public.progress_photo_sets.side_analysis is 'Coach Alex vision analysis for side pose';
