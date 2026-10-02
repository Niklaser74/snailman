-- Dagens labyrint, records and tournaments end to end with three made-up
-- players. Run with Supabase MCP execute_sql (or the SQL editor). It always
-- rolls back: the last line raises on purpose, with "ALL OK" and a log when
-- everything passed, or the first failing check otherwise.
do $test$
declare
  a uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  b uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  c uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  j jsonb; cid uuid; d date := public.snailman_today(); log text := ''; ok boolean;
  rec jsonb := '[[0,"l"],[140,"u"]]';
begin
  -- ---------- daily ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  j := public.snailman_daily_submit(d, 'Anna', 1200, 2, 9000, rec, 1);
  j := public.snailman_daily_submit(d, 'Anna', 800, 1, 5000, rec, 1);
  if (j->'me'->>'score')::int <> 1200 or (j->'me'->>'attempts')::int <> 2 then raise exception 'daily keeps the best: %', j->'me'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true); perform set_config('request.jwt.claim.sub', b::text, true);
  j := public.snailman_daily_submit(d, 'Bo', 2500, 3, 12000, rec, 1);
  if (j->'me'->>'rank')::int <> 1 or (j->'top'->0->>'name') <> 'Bo' or not (j->'top'->0->>'mine')::boolean then raise exception 'board order: %', j; end if;
  j := public.snailman_records_board();
  if (j->'me'->>'score')::int <> 2500 then raise exception 'record not kept: %', j; end if;
  log := log || 'daily best-of-attempts, board order, records; ';

  begin perform public.snailman_daily_submit(d - 2, 'Bo', 10, 1, 10, rec, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'an old day was accepted'; end if;
  begin perform public.snailman_daily_submit(d, 'Bo', 15, 1, 10, rec, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'a score that is not a multiple of 10 was accepted'; end if;
  begin perform public.snailman_daily_submit(d, 'Bo', 10, 1, 10, rec, 99); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'an unknown rules version was accepted'; end if;
  log := log || 'old day, odd score, unknown rules refused; ';

  -- ---------- tournament: A hosts 3 rounds for up to 3 players ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true); perform set_config('request.jwt.claim.sub', a::text, true);
  j := public.snailman_contest_create('Anna', 3, 3, 1); cid := (j->>'id')::uuid;
  if jsonb_array_length(j->'seeds') <> 3 or jsonb_array_length(j->'players') <> 1 or j->>'status' <> 'open' then raise exception 'create: %', j; end if;
  j := public.snailman_contest_submit(cid, 1, 900, 1, 6000, rec, 1);
  begin perform public.snailman_contest_submit(cid, 3, 900, 1, 6000, rec, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'round 3 before round 2 was accepted'; end if;
  begin perform public.snailman_contest_submit(cid, 1, 900, 1, 6000, rec, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'round 1 twice was accepted'; end if;
  log := log || 'rounds in order, once each; ';

  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true); perform set_config('request.jwt.claim.sub', b::text, true);
  j := public.snailman_contest_get(cid);  -- a look before joining is allowed
  begin perform public.snailman_contest_run(cid, a, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'a non-member read a recording'; end if;
  j := public.snailman_contest_join(cid, 'Bo');
  begin perform public.snailman_contest_run(cid, a, 1); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'B watched round 1 before playing it'; end if;
  j := public.snailman_contest_submit(cid, 1, 1500, 2, 8000, rec, 1);
  j := public.snailman_contest_run(cid, a, 1);
  if (j->>'score')::int <> 900 or j->'inputs' <> rec or (j->>'seed')::int is null then raise exception 'run after playing: %', j; end if;
  log := log || 'look before join, recordings only after playing the round; ';

  perform set_config('request.jwt.claims', json_build_object('sub', c)::text, true); perform set_config('request.jwt.claim.sub', c::text, true);
  j := public.snailman_contest_join(cid, 'Cia');
  -- a fourth player would not fit
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  perform set_config('request.jwt.claim.sub', (current_setting('request.jwt.claims')::jsonb->>'sub'), true);
  begin perform public.snailman_contest_join(cid, 'Dan'); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'a full contest took a fourth player'; end if;
  log := log || 'full at max_players; ';

  -- everyone plays everything: it finishes by itself
  perform set_config('request.jwt.claims', json_build_object('sub', c)::text, true); perform set_config('request.jwt.claim.sub', c::text, true);
  for i in 1..3 loop perform public.snailman_contest_submit(cid, i, 100 * i, 1, 1000, rec, 1); end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true); perform set_config('request.jwt.claim.sub', b::text, true);
  perform public.snailman_contest_submit(cid, 2, 10, 1, 1000, rec, 1);
  j := public.snailman_contest_submit(cid, 3, 10, 1, 1000, rec, 1);
  if j->>'status' <> 'open' then raise exception 'finished before A was done'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true); perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.snailman_contest_submit(cid, 2, 10, 1, 1000, rec, 1);
  j := public.snailman_contest_submit(cid, 3, 10, 1, 1000, rec, 1);
  if j->>'status' <> 'finished' or jsonb_array_length(j->'runs') <> 9 or j->'runs'->0 ? 'inputs' then raise exception 'finish: %', j->>'status'; end if;
  log := log || 'finishes when full and all played, no recordings in the summary; ';

  -- ---------- leaving, closing, deadline ----------
  j := public.snailman_contest_create('Anna', 1, 4, 1); cid := (j->>'id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true); perform set_config('request.jwt.claim.sub', b::text, true);
  perform public.snailman_contest_join(cid, 'Bo');
  perform public.snailman_contest_leave(cid);
  if exists (select 1 from public.snailman_contest_players where contest = cid and user_id = b) then raise exception 'leave left B in'; end if;
  perform public.snailman_contest_join(cid, 'Bo');
  begin perform public.snailman_contest_close(cid); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'B closed A''s contest'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true); perform set_config('request.jwt.claim.sub', a::text, true);
  begin perform public.snailman_contest_leave(cid); ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'the host left a contest others are in'; end if;
  j := public.snailman_contest_close(cid);
  if j->>'status' <> 'finished' then raise exception 'close'; end if;
  perform public.snailman_contest_leave(cid);
  if not (select hidden from public.snailman_contest_players where contest = cid and user_id = a) then raise exception 'finished leave should hide'; end if;
  if exists (select 1 from jsonb_array_elements(public.snailman_my_contests()) x where x->>'id' = cid::text) then raise exception 'hidden contest still listed'; end if;
  log := log || 'leave, host-only close, hide after the end; ';

  j := public.snailman_contest_create('Anna', 1, 2, 1); cid := (j->>'id')::uuid;
  update public.snailman_contests set deadline = now() - interval '1 minute' where id = cid;
  j := public.snailman_contest_get(cid);
  if j->>'status' <> 'finished' then raise exception 'deadline did not end it'; end if;
  perform public.snailman_cleanup();
  log := log || 'deadline ends it, cleanup runs';

  raise exception 'ALL OK (rolled back): %', log;
end $test$;
