-- All flash challenges are 24-hour sprints

update public.challenges
set
  duration_days = 1,
  description = case slug
    when 'flash-longest-plank' then
      'Hold the longest plank you can on video. **24-hour flash window** to submit your best attempt. **Entry fee** · **€5** added to the prize pool per entrant · **50 spots max**.'
    when 'flash-longest-wall-sit' then
      'How long can you hold a wall sit? Record your best time within **24 hours**. **Entry fee** · winner takes the pool · **50 spots max**.'
    when 'flash-most-burpees-10min' then
      'Max burpees in 10 minutes — film it and log your score. **24-hour flash window**. **Entry fee** · **€5** per entrant to the pool · **50 spots max**.'
    else description
  end
where is_flash = true;
