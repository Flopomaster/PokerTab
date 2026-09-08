-- ============================================================================
-- PokerTab — סכימת בסיס הנתונים ומדיניות ההרשאות
-- להריץ פעם אחת ב-Supabase: SQL Editor → New query → הדבקה → Run
-- ============================================================================

-- ---------------------------------------------------------------- טבלאות ---

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text not null unique check (char_length(username) between 2 and 24),
  display_name text not null,
  emoji        text not null default '🃏',
  color        text not null default '#f0b429',
  created_at   timestamptz not null default now()
);

create table if not exists public.clubs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  join_code      text not null unique,
  default_buy_in numeric not null default 100,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- role: admin | member   status: pending | approved | rejected
create table if not exists public.club_members (
  club_id      uuid not null references public.clubs on delete cascade,
  user_id      uuid not null references public.profiles on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles(id) on delete set null,
  primary key (club_id, user_id)
);

-- שחקן בקלאב. user_id ריק = שחקן אורח שאין לו חשבון
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs on delete cascade,
  name       text not null,
  emoji      text not null default '🃏',
  color      text not null default '#f0b429',
  user_id    uuid references public.profiles(id) on delete set null,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists players_club_idx on public.players(club_id);

-- ערב משחק. dealer_id = "הדילר" — האחראי על הערב הזה
create table if not exists public.games (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs on delete cascade,
  date           date not null,
  title          text not null default '',
  location       text not null default '',
  notes          text not null default '',
  buy_in_amount  numeric not null default 100,
  dealer_id      uuid references public.profiles(id) on delete set null,
  -- live = הערב עדיין מתנהל; closed = הוזנו סכומי היציאה והערב נסגר
  status         text not null default 'closed',
  paid_transfers text[] not null default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists games_club_idx on public.games(club_id, date);

create table if not exists public.game_entries (
  game_id      uuid not null references public.games on delete cascade,
  player_id    uuid not null references public.players on delete cascade,
  buy_ins      numeric not null default 1,
  extra_buy_in numeric not null default 0,
  cash_out     numeric not null default 0,
  primary key (game_id, player_id)
);

-- ------------------------------------------------- פונקציות עזר להרשאות ---
-- security definer כדי שהבדיקה עצמה לא תיחסם על ידי RLS (ותיצור רקורסיה)

create or replace function public.is_club_member(p_club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_club_admin(p_club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid()
      and status = 'approved' and role = 'admin'
  );
$$;

create or replace function public.is_game_dealer(p_game uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from games where id = p_game and dealer_id = auth.uid());
$$;

create or replace function public.game_club(p_game uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select club_id from games where id = p_game;
$$;

-- פרופיל גלוי למי שחולק איתי קלאב, למי שביקש להצטרף לקלאב שאני מנהל, ולי עצמי
create or replace function public.can_see_profile(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select p_user = auth.uid()
     or exists (
       select 1 from club_members mine
       join club_members theirs on theirs.club_id = mine.club_id
       where mine.user_id = auth.uid() and mine.status = 'approved'
         and theirs.user_id = p_user
         and (theirs.status = 'approved' or mine.role = 'admin')
     );
$$;

-- ------------------------------------------------------------------ RLS ---

alter table public.profiles     enable row level security;
alter table public.clubs        enable row level security;
alter table public.club_members enable row level security;
alter table public.players      enable row level security;
alter table public.games        enable row level security;
alter table public.game_entries enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (public.can_see_profile(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- clubs — גם ממתין לאישור רואה את הקלאב שהוא ביקש להצטרף אליו
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs for select
  using (exists (select 1 from club_members m where m.club_id = id and m.user_id = auth.uid()));

drop policy if exists clubs_update on public.clubs;
create policy clubs_update on public.clubs for update
  using (public.is_club_admin(id)) with check (public.is_club_admin(id));

-- club_members
drop policy if exists members_select on public.club_members;
create policy members_select on public.club_members for select
  using (user_id = auth.uid() or public.is_club_member(club_id));

drop policy if exists members_update on public.club_members;
create policy members_update on public.club_members for update
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- אדמין מסיר חבר; כל אחד יכול לעזוב בעצמו
drop policy if exists members_delete on public.club_members;
create policy members_delete on public.club_members for delete
  using (public.is_club_admin(club_id) or user_id = auth.uid());

-- players — כל חבר מאושר מוסיף (למשל אורח לערב), אדמין עורך ומוחק
drop policy if exists players_select on public.players;
create policy players_select on public.players for select
  using (public.is_club_member(club_id));

drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert
  with check (public.is_club_member(club_id));

-- אדמין עורך כל שחקן; חבר רגיל יכול לעדכן רק את שורת השחקן שלו עצמו
drop policy if exists players_update on public.players;
create policy players_update on public.players for update
  using (public.is_club_admin(club_id) or user_id = auth.uid())
  with check (public.is_club_admin(club_id) or user_id = auth.uid());

drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete
  using (public.is_club_admin(club_id));

-- games — כל חבר פותח ערב; רק הדילר של הערב או אדמין הקלאב עורכים ומוחקים
drop policy if exists games_select on public.games;
create policy games_select on public.games for select
  using (public.is_club_member(club_id));

drop policy if exists games_insert on public.games;
create policy games_insert on public.games for insert
  with check (public.is_club_member(club_id) and dealer_id = auth.uid());

drop policy if exists games_update on public.games;
create policy games_update on public.games for update
  using (dealer_id = auth.uid() or public.is_club_admin(club_id))
  with check (dealer_id is not null);

drop policy if exists games_delete on public.games;
create policy games_delete on public.games for delete
  using (dealer_id = auth.uid() or public.is_club_admin(club_id));

-- game_entries — נגזר מהרשאות הערב
drop policy if exists entries_select on public.game_entries;
create policy entries_select on public.game_entries for select
  using (public.is_club_member(public.game_club(game_id)));

drop policy if exists entries_write on public.game_entries;
create policy entries_write on public.game_entries for all
  using (public.is_game_dealer(game_id) or public.is_club_admin(public.game_club(game_id)))
  with check (public.is_game_dealer(game_id) or public.is_club_admin(public.game_club(game_id)));

-- ------------------------------------------------------------------ RPC ---

-- קוד הצטרפות בן 6 תווים, בלי אותיות/ספרות מבלבלות (0/O, 1/I)
create or replace function public.generate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from clubs where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_club(p_name text, p_buy_in numeric default 100)
returns public.clubs language plpgsql security definer set search_path = public as $$
declare
  new_club clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into clubs (name, join_code, default_buy_in, created_by)
  values (trim(p_name), generate_join_code(), coalesce(p_buy_in, 100), auth.uid())
  returning * into new_club;

  insert into club_members (club_id, user_id, role, status, decided_at, decided_by)
  values (new_club.id, auth.uid(), 'admin', 'approved', now(), auth.uid());

  -- מייצרים שחקן שמקושר ליוצר הקלאב, כדי שיוכל להופיע בערבים
  insert into players (club_id, name, emoji, color, user_id)
  select new_club.id, p.display_name, p.emoji, p.color, p.id
  from profiles p where p.id = auth.uid();

  return new_club;
end;
$$;

-- הצטרפות לפי קוד: יוצרת בקשה במצב 'pending' שממתינה לאישור אדמין
create or replace function public.join_club(p_code text)
returns table (club_id uuid, club_name text, status text)
language plpgsql security definer set search_path = public as $$
declare
  target clubs;
  existing club_members;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target from clubs where upper(join_code) = upper(trim(p_code));
  if not found then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  select * into existing from club_members m
  where m.club_id = target.id and m.user_id = auth.uid();

  if found then
    -- בקשה שנדחתה בעבר אפשר להגיש מחדש
    if existing.status = 'rejected' then
      update club_members m set status = 'pending', requested_at = now(), decided_at = null, decided_by = null
      where m.club_id = target.id and m.user_id = auth.uid();
      return query select target.id, target.name, 'pending'::text;
    end if;
    return query select target.id, target.name, existing.status;
  end if;

  insert into club_members (club_id, user_id, role, status)
  values (target.id, auth.uid(), 'member', 'pending');

  return query select target.id, target.name, 'pending'::text;
end;
$$;

create or replace function public.regenerate_join_code(p_club uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if not is_club_admin(p_club) then
    raise exception 'NOT_ADMIN';
  end if;
  code := generate_join_code();
  update clubs set join_code = code where id = p_club;
  return code;
end;
$$;

-- מיפוי שם משתמש → כתובת ההתחברות, כדי לאפשר כניסה בשם משתמש בלבד
create or replace function public.login_email(p_username text)
returns text language sql security definer stable set search_path = public, auth as $$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username));
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where lower(username) = lower(trim(p_username)));
$$;

-- ------------------------------------------------------------- Realtime ---
-- אידמפוטנטי: אפשר להריץ את הקובץ שוב בלי שגיאה
do $$
declare
  t text;
begin
  foreach t in array array['games', 'game_entries', 'players', 'club_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
