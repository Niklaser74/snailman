-- The advisor's "function search path mutable": pin search_path on the
-- helper functions from 20261002120000_snailman.sql. No behaviour change.
alter function public.snailman_rules_ok(int) set search_path = public;
alter function public.snailman_check_run(int, int, int, jsonb, int) set search_path = public;
alter function public.snailman_today() set search_path = public;
alter function public.snailman_clean_name(text) set search_path = public;
alter function public.snailman_contest_json(uuid) set search_path = public;
