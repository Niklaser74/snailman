-- Snailman online: Dagens labyrint (a daily maze, the same for everyone),
-- the record list, and Snigelpost tournaments (2-8 players play the same
-- mazes in their own time; a push tells the others when someone has played).
-- Same project (snails) and accounts as the rest of the series; own prefix
-- snailman_. Push subscriptions and the VAPID key are shared
-- (snails_push_subscriptions, snails_save_push, snails_vapid_private).
-- Apply with Supabase MCP (apply_migration) or the SQL editor; the
-- snailmageddon repo's `supabase db push` does not know this file.
--
-- A run is a seed plus a recording (js/engine.js: [tick, 'u'|'d'|'l'|'r']).
-- The server stores the recording with the score. It does not replay it;
-- the clients do when a run is watched, and say so when it does not add up.

-- ---------- shared checks ----------
create or replace function public.snailman_rules_ok(p_rules_version int)
returns boolean language sql immutable as $$ select p_rules_version = any (array[1]) $$;

create or replace function public.snailman_check_run(p_score int, p_level int, p_ticks int, p_inputs jsonb, p_rules_version int)
returns void language plpgsql immutable as $$
begin
  if not public.snailman_rules_ok(p_rules_version) then raise exception 'unsupported rules version'; end if;
  if p_score is null or p_score < 0 or p_score > 1000000 or p_score % 10 <> 0 then raise exception 'bad score'; end if;
  if p_level is null or p_level < 1 or p_level > 999 then raise exception 'bad level'; end if;
  if p_ticks is null or p_ticks < 1 or p_ticks > 120 * 60 * 120 then raise exception 'bad run length'; end if;
  if jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) > 50000 or pg_column_size(p_inputs) > 400000 then raise exception 'bad recording'; end if;
end $$;

create or replace function public.snailman_today()
returns date language sql stable as $$ select (now() at time zone 'Europe/Stockholm')::date $$;

create or replace function public.snailman_clean_name(p_name text)
returns text language sql immutable as $$ select left(coalesce(nullif(trim(p_name), ''), 'Snäcka'), 24) $$;

revoke all on function public.snailman_check_run(int, int, int, jsonb, int) from anon, authenticated, public;

-- ---------- Dagens labyrint ----------
create table public.snailman_daily (
  day date not null,
  user_id uuid not null,
  name text not null,
  score int not null,
  level int not null,
  ticks int not null,
  attempts int not null default 1,
  rules_version int not null,
  inputs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (day, user_id)
);
create index snailman_daily_board on public.snailman_daily (day, score desc, updated_at);
alter table public.snailman_daily enable row level security;
revoke all on public.snailman_daily from anon, authenticated;

-- one row per player: the best run ever sent to the daily board
create table public.snailman_records (
  user_id uuid primary key,
  name text not null,
  score int not null,
  level int not null,
  ticks int not null,
  day date not null,
  rules_version int not null,
  inputs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index snailman_records_board on public.snailman_records (score desc, updated_at);
alter table public.snailman_records enable row level security;
revoke all on public.snailman_records from anon, authenticated;

create or replace function public.snailman_daily_board(p_day date)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare me public.snailman_daily; top jsonb; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce(jsonb_agg(x order by x.rank), '[]'::jsonb) into top from (
    select row_number() over (order by d.score desc, d.updated_at) as rank, d.name, d.score, d.level, d.user_id = auth.uid() as mine
    from public.snailman_daily d where d.day = p_day order by d.score desc, d.updated_at limit 10) x;
  select count(*) into n from public.snailman_daily where day = p_day;
  select * into me from public.snailman_daily where day = p_day and user_id = auth.uid();
  return jsonb_build_object('day', p_day, 'today', public.snailman_today(), 'players', n, 'top', top,
    'me', case when me.user_id is null then null else jsonb_build_object(
      'rank', 1 + (select count(*) from public.snailman_daily d where d.day = p_day and (d.score > me.score or (d.score = me.score and d.updated_at < me.updated_at))),
      'score', me.score, 'level', me.level, 'attempts', me.attempts) end);
end $$;

create or replace function public.snailman_records_board()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare me public.snailman_records; top jsonb; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce(jsonb_agg(x order by x.rank), '[]'::jsonb) into top from (
    select row_number() over (order by r.score desc, r.updated_at) as rank, r.name, r.score, r.level, r.day, r.user_id = auth.uid() as mine
    from public.snailman_records r order by r.score desc, r.updated_at limit 10) x;
  select count(*) into n from public.snailman_records;
  select * into me from public.snailman_records where user_id = auth.uid();
  return jsonb_build_object('players', n, 'top', top,
    'me', case when me.user_id is null then null else jsonb_build_object(
      'rank', 1 + (select count(*) from public.snailman_records r where r.score > me.score or (r.score = me.score and r.updated_at < me.updated_at)),
      'score', me.score, 'level', me.level, 'day', me.day) end);
end $$;

-- one finished attempt at the day's maze; the best one counts. Today or
-- yesterday only (a run started before midnight may end after it).
create or replace function public.snailman_daily_submit(p_day date, p_name text, p_score int, p_level int, p_ticks int, p_inputs jsonb, p_rules_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nm text := public.snailman_clean_name(p_name);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_day is null or p_day not in (public.snailman_today(), public.snailman_today() - 1) then raise exception 'not a playable day'; end if;
  perform public.snailman_check_run(p_score, p_level, p_ticks, p_inputs, p_rules_version);
  insert into public.snailman_daily as d (day, user_id, name, score, level, ticks, rules_version, inputs)
  values (p_day, auth.uid(), nm, p_score, p_level, p_ticks, p_rules_version, p_inputs)
  on conflict (day, user_id) do update set
    attempts = d.attempts + 1,
    name = excluded.name,
    score = greatest(d.score, excluded.score),
    level = case when excluded.score > d.score then excluded.level else d.level end,
    ticks = case when excluded.score > d.score then excluded.ticks else d.ticks end,
    rules_version = case when excluded.score > d.score then excluded.rules_version else d.rules_version end,
    inputs = case when excluded.score > d.score then excluded.inputs else d.inputs end,
    updated_at = case when excluded.score > d.score then now() else d.updated_at end;
  insert into public.snailman_records as r (user_id, name, score, level, ticks, day, rules_version, inputs)
  values (auth.uid(), nm, p_score, p_level, p_ticks, p_day, p_rules_version, p_inputs)
  on conflict (user_id) do update set
    name = excluded.name,
    score = greatest(r.score, excluded.score),
    level = case when excluded.score > r.score then excluded.level else r.level end,
    ticks = case when excluded.score > r.score then excluded.ticks else r.ticks end,
    day = case when excluded.score > r.score then excluded.day else r.day end,
    rules_version = case when excluded.score > r.score then excluded.rules_version else r.rules_version end,
    inputs = case when excluded.score > r.score then excluded.inputs else r.inputs end,
    updated_at = case when excluded.score > r.score then now() else r.updated_at end;
  return public.snailman_daily_board(p_day);
end $$;

-- ---------- Snigelpost tournaments ----------
create table public.snailman_contests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  host uuid not null,
  rounds int not null check (rounds in (1, 3, 5)),
  max_players int not null check (max_players between 2 and 8),
  seeds int[] not null,
  rules_version int not null,
  status text not null default 'open' check (status in ('open', 'finished')),
  deadline timestamptz not null default now() + interval '7 days',
  finished_at timestamptz
);
create index snailman_contests_open on public.snailman_contests (status, deadline);
alter table public.snailman_contests enable row level security;
revoke all on public.snailman_contests from anon, authenticated;

create table public.snailman_contest_players (
  contest uuid not null references public.snailman_contests (id) on delete cascade,
  user_id uuid not null,
  name text not null,
  joined_at timestamptz not null default now(),
  hidden boolean not null default false,   -- "remove from my list" after the end
  primary key (contest, user_id)
);
create index snailman_contest_players_user on public.snailman_contest_players (user_id);
alter table public.snailman_contest_players enable row level security;
revoke all on public.snailman_contest_players from anon, authenticated;

create table public.snailman_contest_runs (
  contest uuid not null,
  user_id uuid not null,
  round int not null check (round between 1 and 5),
  score int not null,
  level int not null,
  ticks int not null,
  rules_version int not null,
  inputs jsonb not null default '[]'::jsonb,
  played_at timestamptz not null default now(),
  primary key (contest, user_id, round),
  foreign key (contest, user_id) references public.snailman_contest_players (contest, user_id) on delete cascade
);
alter table public.snailman_contest_runs enable row level security;
revoke all on public.snailman_contest_runs from anon, authenticated;

-- everything a client needs, without the recordings
create or replace function public.snailman_contest_json(p_contest uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', c.id, 'created_at', c.created_at, 'updated_at', c.updated_at, 'host', c.host,
    'rounds', c.rounds, 'max_players', c.max_players, 'seeds', to_jsonb(c.seeds),
    'rules_version', c.rules_version, 'status', c.status, 'deadline', c.deadline, 'finished_at', c.finished_at,
    'me', auth.uid(),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', p.name, 'joined_at', p.joined_at) order by p.joined_at)
                         from public.snailman_contest_players p where p.contest = c.id), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'round', r.round, 'score', r.score, 'level', r.level, 'ticks', r.ticks, 'played_at', r.played_at) order by r.round, r.played_at)
                      from public.snailman_contest_runs r where r.contest = c.id), '[]'::jsonb))
  from public.snailman_contests c where c.id = p_contest;
$$;
revoke all on function public.snailman_contest_json(uuid) from anon, authenticated, public;

-- finished when full and everyone has played every round, or at the deadline
create or replace function public.snailman_contest_settle(p_contest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests; np int; nr int;
begin
  select * into c from public.snailman_contests where id = p_contest;
  if c.id is null or c.status = 'finished' then return; end if;
  select count(*) into np from public.snailman_contest_players where contest = p_contest;
  select count(*) into nr from public.snailman_contest_runs where contest = p_contest;
  if c.deadline <= now() or (np >= c.max_players and nr >= np * c.rounds) then
    update public.snailman_contests set status = 'finished', finished_at = now(), updated_at = now() where id = p_contest;
  end if;
end $$;
revoke all on function public.snailman_contest_settle(uuid) from anon, authenticated, public;

create or replace function public.snailman_contest_create(p_name text, p_rounds int, p_max_players int, p_rules_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_rounds not in (1, 3, 5) then raise exception 'bad rounds'; end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then raise exception 'bad player count'; end if;
  if not public.snailman_rules_ok(p_rules_version) then raise exception 'unsupported rules version'; end if;
  insert into public.snailman_contests (host, rounds, max_players, seeds, rules_version)
  values (auth.uid(), p_rounds, p_max_players,
          array(select (floor(random() * 2147483646) + 1)::int from generate_series(1, p_rounds)), p_rules_version)
  returning id into cid;
  insert into public.snailman_contest_players (contest, user_id, name) values (cid, auth.uid(), public.snailman_clean_name(p_name));
  return public.snailman_contest_json(cid);
end $$;

create or replace function public.snailman_contest_join(p_contest uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests; np int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.snailman_contest_settle(p_contest);
  select * into c from public.snailman_contests where id = p_contest for update;
  if c.id is null then raise exception 'no such contest'; end if;
  if exists (select 1 from public.snailman_contest_players where contest = p_contest and user_id = auth.uid()) then
    update public.snailman_contest_players set hidden = false where contest = p_contest and user_id = auth.uid();
    return public.snailman_contest_json(p_contest);
  end if;
  if c.status = 'finished' then raise exception 'contest is finished'; end if;
  select count(*) into np from public.snailman_contest_players where contest = p_contest;
  if np >= c.max_players then raise exception 'contest is full'; end if;
  insert into public.snailman_contest_players (contest, user_id, name) values (p_contest, auth.uid(), public.snailman_clean_name(p_name));
  update public.snailman_contests set updated_at = now() where id = p_contest;
  return public.snailman_contest_json(p_contest);
end $$;

-- anyone with the link may look (to decide whether to join)
create or replace function public.snailman_contest_get(p_contest uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.snailman_contests where id = p_contest) then raise exception 'no such contest'; end if;
  perform public.snailman_contest_settle(p_contest);
  return public.snailman_contest_json(p_contest);
end $$;

create or replace function public.snailman_my_contests()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select array_agg(contest) into ids from public.snailman_contest_players where user_id = auth.uid() and not hidden;
  perform public.snailman_contest_settle(x) from unnest(coalesce(ids, '{}')) x;
  return coalesce((select jsonb_agg(public.snailman_contest_json(c.id) order by c.updated_at desc)
                   from public.snailman_contests c where c.id = any (coalesce(ids, '{}'))), '[]'::jsonb);
end $$;

-- one finished run of the next round this player has not played
create or replace function public.snailman_contest_submit(p_contest uuid, p_round int, p_score int, p_level int, p_ticks int, p_inputs jsonb, p_rules_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests; played int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.snailman_contest_settle(p_contest);
  select * into c from public.snailman_contests where id = p_contest for update;
  if c.id is null then raise exception 'no such contest'; end if;
  if not exists (select 1 from public.snailman_contest_players where contest = p_contest and user_id = auth.uid()) then raise exception 'not your contest'; end if;
  if c.status = 'finished' then raise exception 'contest is finished'; end if;
  if p_rules_version <> c.rules_version then raise exception 'wrong rules version'; end if;
  select count(*) into played from public.snailman_contest_runs where contest = p_contest and user_id = auth.uid();
  if p_round <> played + 1 or p_round > c.rounds then raise exception 'round out of order'; end if;
  perform public.snailman_check_run(p_score, p_level, p_ticks, p_inputs, p_rules_version);
  insert into public.snailman_contest_runs (contest, user_id, round, score, level, ticks, rules_version, inputs)
  values (p_contest, auth.uid(), p_round, p_score, p_level, p_ticks, p_rules_version, p_inputs);
  update public.snailman_contests set updated_at = now() where id = p_contest;
  perform public.snailman_contest_settle(p_contest);
  return public.snailman_contest_json(p_contest);
end $$;

-- a recording to watch: your own, or anyone's in a round you have played
-- yourself (watching first would be learning the maze), or after the end
create or replace function public.snailman_contest_run(p_contest uuid, p_user uuid, p_round int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests; r public.snailman_contest_runs;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.snailman_contests where id = p_contest;
  if c.id is null then raise exception 'no such contest'; end if;
  if not exists (select 1 from public.snailman_contest_players where contest = p_contest and user_id = auth.uid()) then raise exception 'not your contest'; end if;
  if c.status <> 'finished' and p_user <> auth.uid()
     and not exists (select 1 from public.snailman_contest_runs where contest = p_contest and user_id = auth.uid() and round = p_round) then
    raise exception 'play the round first';
  end if;
  select * into r from public.snailman_contest_runs where contest = p_contest and user_id = p_user and round = p_round;
  if r.contest is null then raise exception 'no such run'; end if;
  return jsonb_build_object('seed', c.seeds[p_round], 'round', r.round, 'score', r.score, 'level', r.level, 'ticks', r.ticks,
    'rules_version', r.rules_version, 'inputs', r.inputs,
    'name', (select name from public.snailman_contest_players where contest = p_contest and user_id = p_user));
end $$;

-- the host ends it now; rounds nobody played count as 0
create or replace function public.snailman_contest_close(p_contest uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.snailman_contests where id = p_contest for update;
  if c.id is null then raise exception 'no such contest'; end if;
  if c.host <> auth.uid() then raise exception 'only the host can end it'; end if;
  if c.status <> 'finished' then
    update public.snailman_contests set status = 'finished', finished_at = now(), updated_at = now() where id = p_contest;
  end if;
  return public.snailman_contest_json(p_contest);
end $$;

-- leave: a running contest drops you and your runs (the host may only drop a
-- contest nobody else has joined); a finished one only leaves your list
create or replace function public.snailman_contest_leave(p_contest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.snailman_contests; others int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from public.snailman_contests where id = p_contest for update;
  if c.id is null then return; end if;
  if c.status = 'finished' then
    update public.snailman_contest_players set hidden = true where contest = p_contest and user_id = auth.uid();
    if not exists (select 1 from public.snailman_contest_players where contest = p_contest and not hidden) then
      delete from public.snailman_contests where id = p_contest;
    end if;
    return;
  end if;
  select count(*) into others from public.snailman_contest_players where contest = p_contest and user_id <> auth.uid();
  if c.host = auth.uid() then
    if others > 0 then raise exception 'end it before leaving'; end if;
    delete from public.snailman_contests where id = p_contest;
    return;
  end if;
  delete from public.snailman_contest_players where contest = p_contest and user_id = auth.uid();
  update public.snailman_contests set updated_at = now() where id = p_contest;
end $$;

do $grants$
declare f text;
begin
  foreach f in array array[
    'snailman_daily_board(date)', 'snailman_records_board()',
    'snailman_daily_submit(date, text, int, int, int, jsonb, int)',
    'snailman_contest_create(text, int, int, int)', 'snailman_contest_join(uuid, text)',
    'snailman_contest_get(uuid)', 'snailman_my_contests()',
    'snailman_contest_submit(uuid, int, int, int, int, jsonb, int)',
    'snailman_contest_run(uuid, uuid, int)', 'snailman_contest_close(uuid)', 'snailman_contest_leave(uuid)'] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $grants$;

-- housekeeping, hourly: tournaments past their deadline end; finished ones
-- go after 90 days, daily rows after 60. Records stay.
create or replace function public.snailman_cleanup()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.snailman_contests set status = 'finished', finished_at = now(), updated_at = now()
   where status = 'open' and deadline <= now();
  delete from public.snailman_contests where status = 'finished' and finished_at < now() - interval '90 days';
  delete from public.snailman_daily where day < public.snailman_today() - 60;
end $$;
revoke all on function public.snailman_cleanup() from anon, authenticated, public;
select cron.schedule('snailman_cleanup', '41 * * * *', $$select public.snailman_cleanup()$$);
