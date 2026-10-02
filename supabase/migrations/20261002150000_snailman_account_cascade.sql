-- Deleting an account deletes its Snailman data, as the series privacy
-- policy (snails.se/privacy.html) promises. A player's rounds go with the
-- player row (snailman_contest_runs already cascades from it). A tournament
-- whose host is deleted goes as a whole, with the other players' rounds:
-- it cannot be ended or managed without a host. Sibling of snailmageddon's
-- 20261002150000_account_cascade.sql.
alter table public.snailman_contests
  add constraint snailman_contests_host_fkey foreign key (host) references auth.users (id) on delete cascade;
alter table public.snailman_contest_players
  add constraint snailman_contest_players_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.snailman_daily
  add constraint snailman_daily_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.snailman_records
  add constraint snailman_records_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
create index if not exists snailman_daily_user on public.snailman_daily (user_id);
create index if not exists snailman_contests_host on public.snailman_contests (host);
