-- Snigelpost tournaments on the hub's card.
--
-- snailman_contest_stats() is open to anon like snailman_daily_leader: only
-- counts — tournaments running (with at least two players) and rounds played
-- this week. No ids (a tournament is a private link), no names.
--
-- snailman_contest_mine_brief() is for a browser that already has an account:
-- the caller's running tournaments, light enough for the front page — which
-- round is theirs to play next (null = waiting for the others), how many
-- players, the deadline. snailman_my_contests() returns whole tournaments
-- with every run; this is the hub's summary of the same.
create or replace function public.snailman_contest_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open', (select count(*) from public.snailman_contests c
              where c.status = 'open' and c.deadline > now()
                and (select count(*) from public.snailman_contest_players p where p.contest = c.id) >= 2),
    'rounds_week', (select count(*) from public.snailman_contest_runs r
                     where r.played_at >= date_trunc('week', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm'));
$$;
revoke execute on function public.snailman_contest_stats() from public;
grant execute on function public.snailman_contest_stats() to anon, authenticated;

create or replace function public.snailman_contest_mine_brief()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'rounds', c.rounds, 'deadline', c.deadline, 'now', now(),
             'players', (select count(*) from public.snailman_contest_players p2 where p2.contest = c.id),
             'next', case when played.n < c.rounds then played.n + 1 else null end)
           order by (played.n < c.rounds) desc, c.deadline)
      from public.snailman_contests c
      join public.snailman_contest_players p on p.contest = c.id and p.user_id = auth.uid() and not p.hidden
      cross join lateral (select count(*)::int as n from public.snailman_contest_runs r
                           where r.contest = c.id and r.user_id = auth.uid()) played
     where c.status = 'open' and c.deadline > now()), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array['snailman_contest_mine_brief()'] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
