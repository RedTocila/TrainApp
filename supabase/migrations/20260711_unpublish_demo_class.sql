-- Remove demo live class from client catalog
update public.classes
set published = false
where slug = 'demo-full-body-strength';
