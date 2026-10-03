-- The hub's Snigelpost lines: snailman_contest_mine_brief and snailman_contest_stats.
-- Run with Supabase MCP execute_sql. It always rolls back: the last line raises
-- on purpose, with "ALL OK" when everything passed.
do $test$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); j jsonb;
begin
  insert into auth.users (id, aud, role) values (a, 'authenticated', 'authenticated'), (b, 'authenticated', 'authenticated');
  insert into public.snailman_contests (id, host, rounds, max_players, seeds, rules_version) values (c1, a, 3, 4, '{1,2,3}', 1), (c2, a, 1, 2, '{1}', 1);
  insert into public.snailman_contest_players (contest, user_id, name) values (c1, a, 'Anna'), (c1, b, 'Bo'), (c2, a, 'Anna'), (c2, b, 'Bo');
  insert into public.snailman_contest_runs (contest, user_id, round, score, level, ticks, rules_version) values (c1, a, 1, 100, 1, 100, 1), (c2, a, 1, 50, 1, 100, 1);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  j := public.snailman_contest_mine_brief();
  if jsonb_array_length(j) <> 2 or (j->0->>'id')::uuid <> c1 or (j->0->>'next')::int <> 2 or j->1->'next' <> 'null'::jsonb or (j->0->>'players')::int <> 2 then
    raise exception 'brief: %', j;
  end if;
  j := public.snailman_contest_stats();
  if (j->>'open')::int < 2 or (j->>'rounds_week')::int < 2 then raise exception 'stats: %', j; end if;
  raise exception 'ALL OK (rolled back): your turn first (round 2), waiting second, stats count them';
end $test$;
