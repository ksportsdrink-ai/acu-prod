-- ============================================================
--  발침 관리 시스템 — Supabase SQL 스키마
--  Supabase SQL Editor에서 전체 복사 후 Run 클릭
-- ============================================================

-- 1. profiles (사용자 프로필)
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text unique not null,
  name              text not null,
  role              text not null check (role in ('superadmin','admin','doctor','intern','viewer')),
  department        text,
  accessible_floors text[] default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- 2. tasks (발침 태스크)
create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  task_date            date not null default current_date,
  scheduled_time       timestamptz not null,
  room                 text not null,
  floor                text not null,
  patient_anonymized   text not null,
  needle_count         integer not null check (needle_count > 0),
  department           text,
  status               text not null check (status in ('scheduled','in_progress','delayed','completed')) default 'scheduled',

  created_by           uuid references public.profiles(id),
  created_by_name      text,

  in_progress_by       uuid references public.profiles(id),
  in_progress_by_name  text,
  in_progress_at       timestamptz,

  completed_by         uuid references public.profiles(id),
  completed_by_name    text,
  completed_at         timestamptz,

  delay_reason         text,
  memo                 text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3. audit_logs (감사 로그)
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  task_id    uuid references public.tasks(id) on delete cascade,
  action     text not null,
  actor_id   uuid references public.profiles(id),
  actor_name text,
  old_status text,
  new_status text,
  note       text,
  created_at timestamptz not null default now()
);

-- 4. 인덱스
create index idx_tasks_date     on public.tasks(task_date);
create index idx_tasks_status   on public.tasks(status);
create index idx_tasks_floor    on public.tasks(floor);
create index idx_tasks_sched    on public.tasks(scheduled_time);
create index idx_audit_task_id  on public.audit_logs(task_id);

-- 5. updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 6. 신규 유저 가입 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, role, accessible_floors)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'intern'),
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'floors')),
      array['5층','6층','7층']
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. RLS (Row Level Security) 활성화
alter table public.profiles  enable row level security;
alter table public.tasks      enable row level security;
alter table public.audit_logs enable row level security;

-- 8. RLS 정책 — profiles
create policy "자신의 프로필 읽기"
  on public.profiles for select
  using (auth.uid() = id);

create policy "관리자는 전체 프로필 읽기"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin')
    )
  );

create policy "관리자는 프로필 수정"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin')
    )
  );

-- 9. RLS 정책 — tasks
create policy "인증된 유저는 오늘 태스크 읽기"
  on public.tasks for select
  using (auth.role() = 'authenticated');

create policy "의사/관리자는 태스크 생성"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin','doctor')
        and p.is_active = true
    )
  );

create policy "인증된 유저는 태스크 업데이트"
  on public.tasks for update
  using (auth.role() = 'authenticated');

create policy "관리자만 태스크 삭제"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin')
    )
  );

-- 10. RLS 정책 — audit_logs
create policy "인증된 유저는 로그 읽기"
  on public.audit_logs for select
  using (auth.role() = 'authenticated');

create policy "인증된 유저는 로그 생성"
  on public.audit_logs for insert
  with check (auth.role() = 'authenticated');
