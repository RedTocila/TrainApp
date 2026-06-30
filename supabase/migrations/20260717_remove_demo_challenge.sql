-- Remove demo challenge from the database (preview is no longer served in-app)
delete from public.challenge_announcements
where challenge_id = '00000000-0000-4000-8000-000000000002';

delete from public.challenges
where slug = 'demo-summer-challenge'
   or id = '00000000-0000-4000-8000-000000000002';
