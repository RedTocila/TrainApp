-- Extra reminder slots: everyday report (5), weekly report (6), high-risk points (7).

alter table public.reminder_push_sends
  drop constraint if exists reminder_push_sends_slot_check;

alter table public.reminder_push_sends
  add constraint reminder_push_sends_slot_check
  check (slot in (1, 2, 3, 4, 5, 6, 7));
