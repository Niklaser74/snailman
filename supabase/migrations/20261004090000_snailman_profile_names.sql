-- The name on Snailman's boards and in tournaments is the account's name.
-- Until now it was whatever the game sent, and the game only knew a name if
-- the player had typed one in the Snigelpost panel — so a player named on
-- snails.se/account/ played the day's maze as "Snäcka".
--
-- The rule, in one place (snailman_name): the series profile name
-- (snails_profiles.name) when the player has chosen one, otherwise the name
-- the game sent. "Snäcka" in the profile is the default snails_profile_set
-- writes for an empty name, not a choice, so it does not count.
--
-- The stored name is kept right instead of joined at every read, because the
-- boards, the hub's leader, the tournament summary and the push function all
-- read it: on every write here, and by a trigger when the profile is renamed.

create or replace function public.snailman_profile_name(p_user uuid)
returns text language sql stable set search_path = public as $$
  select nullif(nullif(left(trim(p.name), 24), ''), 'Snäcka') from public.snails_profiles p where p.user_id = p_user;
$$;
create or replace function public.snailman_name(p_user uuid, p_sent text)
returns text language sql stable set search_path = public as $$
  select coalesce(public.snailman_profile_name(p_user), public.snailman_clean_name(p_sent));
$$;
revoke all on function public.snailman_profile_name(uuid) from anon, authenticated, public;
revoke all on function public.snailman_name(uuid, text) from anon, authenticated, public;

-- ---------- writes use it ----------
create or replace function public.snailman_daily_submit(p_day date, p_name text, p_score int, p_level int, p_ticks int, p_inputs jsonb, p_rules_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nm text := public.snailman_name(auth.uid(), p_name);
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
  insert into public.snailman_contest_players (contest, user_id, name) values (cid, auth.uid(), public.snailman_name(auth.uid(), p_name));
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
  insert into public.snailman_contest_players (contest, user_id, name) values (p_contest, auth.uid(), public.snailman_name(auth.uid(), p_name));
  update public.snailman_contests set updated_at = now() where id = p_contest;
  return public.snailman_contest_json(p_contest);
end $$;

-- ---------- a rename on snails.se/account/ reaches every Snailman row ----------
create or replace function public.snailman_profile_renamed()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := public.snailman_profile_name(new.user_id);
begin
  if nm is null then return new; end if; -- back to the default: keep what the game sent
  update public.snailman_daily set name = nm where user_id = new.user_id and name is distinct from nm;
  update public.snailman_records set name = nm where user_id = new.user_id and name is distinct from nm;
  update public.snailman_contest_players set name = nm where user_id = new.user_id and name is distinct from nm;
  return new;
end $$;
revoke all on function public.snailman_profile_renamed() from anon, authenticated, public;
drop trigger if exists snailman_profile_renamed on public.snails_profiles;
create trigger snailman_profile_renamed after insert or update of name on public.snails_profiles
  for each row execute function public.snailman_profile_renamed();

-- ---------- once: the rows already written ----------
update public.snailman_daily d set name = n.nm
  from (select user_id, public.snailman_profile_name(user_id) nm from public.snails_profiles) n
 where n.user_id = d.user_id and n.nm is not null and d.name is distinct from n.nm;
update public.snailman_records r set name = n.nm
  from (select user_id, public.snailman_profile_name(user_id) nm from public.snails_profiles) n
 where n.user_id = r.user_id and n.nm is not null and r.name is distinct from n.nm;
update public.snailman_contest_players c set name = n.nm
  from (select user_id, public.snailman_profile_name(user_id) nm from public.snails_profiles) n
 where n.user_id = c.user_id and n.nm is not null and c.name is distinct from n.nm;
