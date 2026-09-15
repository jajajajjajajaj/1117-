-- Supabase SQL Editor에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
-- Paste into the Supabase SQL editor and run. Safe to run more than once.

-- ── 신청자 / applicants ─────────────────────────────────────────
create table if not exists public.applicants (
  nick text primary key,
  days jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── 설정 + 배정 결과 (한 줄만 사용) / settings (single row) ──────
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data)
values (1, '{"capacity":1,"published":{"mon":false,"tue":false,"thu":false},"assignments":{"mon":{},"tue":{},"thu":{}},"manual":{"mon":{},"tue":{},"thu":{}},"unassigned":{"mon":[],"tue":[],"thu":[]},"lastRun":null}'::jsonb)
on conflict (id) do nothing;

-- ── 관리자 코드 / admin access code ────────────────────────────
-- 확장(pgcrypto) 없이 Postgres 내장 sha256() 만 사용합니다. / uses built-in sha256(), no extensions.
create table if not exists public.admin_access (
  id int primary key default 1 check (id = 1),
  code_hash text not null
);
create table if not exists public.admin_sessions (
  token text primary key,
  created_at timestamptz not null default now()
);

-- 이전 버전 잔여물 정리 / clean up earlier versions
alter table public.admin_sessions drop column if exists username;
drop table if exists public.admins cascade;
drop function if exists public.admin_login(text, text);
drop function if exists public.admin_login(text);
drop function if exists public.admin_change_password(text, text);
drop function if exists public.admin_change_code(text, text);
drop function if exists public.admin_check(text);
drop function if exists public.admin_logout(text);
drop function if exists public.admin_save_settings(text, jsonb);
drop function if exists public.admin_delete_applicant(text, text);
drop function if exists public.admin_reset(text, jsonb);

create or replace function public.code_hash(p text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- 관리자 코드를 1234 로 (재)설정합니다. 실행할 때마다 1234 로 초기화됩니다.
-- (Re)sets the admin code to 1234 every time this file is run.
delete from public.admin_access where id is not null;
insert into public.admin_access (id, code_hash) values (1, public.code_hash('1234'));
delete from public.admin_sessions where token is not null;

-- 코드를 SQL로 바꾸려면 / to change the code via SQL:
-- update public.admin_access set code_hash = public.code_hash('새코드') where id = 1;

-- ── RLS ─────────────────────────────────────────────────────────
alter table public.applicants enable row level security;
alter table public.settings enable row level security;
alter table public.admin_access enable row level security;
alter table public.admin_sessions enable row level security;

-- 누구나 신청 조회/등록/수정 가능 / anyone can read, insert, update applicants
drop policy if exists "applicants read" on public.applicants;
create policy "applicants read" on public.applicants for select using (true);
drop policy if exists "applicants insert" on public.applicants;
create policy "applicants insert" on public.applicants for insert with check (true);
drop policy if exists "applicants update" on public.applicants;
create policy "applicants update" on public.applicants for update using (true) with check (true);
-- 삭제 정책 없음 → 아래 관리자 함수로만 가능 / no delete policy: only via admin functions
drop policy if exists "applicants delete admin" on public.applicants;

-- 설정은 누구나 읽기만 / settings: read-only for everyone, written via admin functions
drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select using (true);
drop policy if exists "settings update admin" on public.settings;

-- admin_access, admin_sessions 에는 정책이 없으므로 직접 접근 불가 / no policies: not directly accessible

-- ── 관리자 함수 (security definer) / admin functions ─────────────
create or replace function public.admin_login(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if not exists (
    select 1 from admin_access where id = 1 and code_hash = public.code_hash(p_code)
  ) then
    return null;
  end if;
  delete from admin_sessions where created_at < now() - interval '30 days';
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into admin_sessions (token) values (tok);
  return tok;
end $$;

create or replace function public.admin_check(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from admin_sessions where token = p_token and created_at > now() - interval '30 days'
  );
$$;

create or replace function public.admin_logout(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from admin_sessions where token = p_token;
$$;

create or replace function public.admin_save_settings(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check(p_token) then raise exception 'unauthorized'; end if;
  update settings set data = p_data, updated_at = now() where id = 1;
end $$;

create or replace function public.admin_delete_applicant(p_token text, p_nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check(p_token) then raise exception 'unauthorized'; end if;
  delete from applicants where nick = p_nick;
end $$;

create or replace function public.admin_reset(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check(p_token) then raise exception 'unauthorized'; end if;
  delete from applicants where nick is not null;
  update settings set data = p_data, updated_at = now() where id = 1;
end $$;

create or replace function public.admin_change_code(p_token text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not admin_check(p_token) then raise exception 'unauthorized'; end if;
  update admin_access set code_hash = public.code_hash(p_new) where id = 1;
  delete from admin_sessions where token <> p_token;
end $$;

grant execute on function public.code_hash(text) to anon, authenticated;
grant execute on function public.admin_login(text) to anon, authenticated;
grant execute on function public.admin_check(text) to anon, authenticated;
grant execute on function public.admin_logout(text) to anon, authenticated;
grant execute on function public.admin_save_settings(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_applicant(text, text) to anon, authenticated;
grant execute on function public.admin_reset(text, jsonb) to anon, authenticated;
grant execute on function public.admin_change_code(text, text) to anon, authenticated;

-- ── 확인 / check ────────────────────────────────────────────────
-- 실행 결과에 긴 문자열(토큰)이 나오면 정상입니다. / a long token string means everything works.
select public.admin_login('1234') as test_token;
