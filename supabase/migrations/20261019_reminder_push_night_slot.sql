-- Allow the 23:00 end-of-day reminder slot.

alter table public.reminder_push_sends
  drop constraint if exists reminder_push_sends_slot_check;

alter table public.reminder_push_sends
  add constraint reminder_push_sends_slot_check
  check (slot in (1, 2, 3, 4));
