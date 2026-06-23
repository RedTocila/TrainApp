-- AI Coach: stored insights, reports, check-ins, and analysis history

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  insight_type text not null check (
    insight_type in (
      'meal_suggestion',
      'habit_pattern',
      'progress_note',
      'prediction',
      'recommendation',
      'check_in_feedback'
    )
  ),
  period_start date,
  period_end date,
  title text not null default '',
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_user_type_idx
  on public.ai_insights(user_id, insight_type, created_at desc);

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_type text not null check (report_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  training_score smallint check (training_score between 0 and 100),
  nutrition_score smallint check (nutrition_score between 0 and 100),
  consistency_score smallint check (consistency_score between 0 and 100),
  summary text not null default '',
  highlights jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, report_type, period_start)
);

create index if not exists ai_reports_user_idx
  on public.ai_reports(user_id, period_start desc);

create table if not exists public.weekly_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  weight_kg numeric(5, 1),
  measurements jsonb not null default '{}'::jsonb,
  photo_urls jsonb not null default '[]'::jsonb,
  notes text,
  ai_feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.ai_meal_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('photo', 'text')),
  input_text text,
  result jsonb not null,
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  logged_meal_id uuid references public.daily_meal_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_meal_analyses_user_idx
  on public.ai_meal_analyses(user_id, created_at desc);

alter table public.ai_insights enable row level security;
alter table public.ai_reports enable row level security;
alter table public.weekly_check_ins enable row level security;
alter table public.ai_meal_analyses enable row level security;

create policy "Users read own ai insights"
  on public.ai_insights for select using (auth.uid() = user_id);
create policy "Users insert own ai insights"
  on public.ai_insights for insert with check (auth.uid() = user_id);

create policy "Users read own ai reports"
  on public.ai_reports for select using (auth.uid() = user_id);
create policy "Users insert own ai reports"
  on public.ai_reports for insert with check (auth.uid() = user_id);

create policy "Users manage own check ins"
  on public.weekly_check_ins for all using (auth.uid() = user_id);

create policy "Users read own meal analyses"
  on public.ai_meal_analyses for select using (auth.uid() = user_id);
create policy "Users insert own meal analyses"
  on public.ai_meal_analyses for insert with check (auth.uid() = user_id);

create policy "Admins read all ai insights"
  on public.ai_insights for select using (public.is_admin());
create policy "Admins read all ai reports"
  on public.ai_reports for select using (public.is_admin());
create policy "Admins read all check ins"
  on public.weekly_check_ins for select using (public.is_admin());
