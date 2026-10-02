-- Today's leader on the hub's card. The hub never creates an account, so this
-- one function is open to anon (like Snigelkrattan's snailrake_daily_leader):
-- it gives out only what the daily board already shows everyone — the
-- leader's display name and score, and how many played today's maze. No user
-- ids, no runs. The day is Snailman's (snailman_today, Stockholm time).
create or replace function public.snailman_daily_leader()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'day', public.snailman_today(),
    'players', (select count(*) from public.snailman_daily where day = public.snailman_today()),
    'leader', (select jsonb_build_object('name', name, 'score', score)
                 from public.snailman_daily
                where day = public.snailman_today() and score > 0
                order by score desc, updated_at limit 1));
$$;
revoke execute on function public.snailman_daily_leader() from public;
grant execute on function public.snailman_daily_leader() to anon, authenticated;
