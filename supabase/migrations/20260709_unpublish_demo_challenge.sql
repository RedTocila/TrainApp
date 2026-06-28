-- Remove demo challenge from client catalog
update public.challenges
set published = false
where slug = 'demo-summer-challenge';
