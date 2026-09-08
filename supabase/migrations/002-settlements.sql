-- ============================================================================
-- אישור דו-צדדי להעברות: המשלם מסמן שהעביר, והמקבל מאשר שקיבל.
-- להריץ ב-SQL Editor של Supabase פעם אחת.
-- ============================================================================

create table if not exists public.transfer_settlements (
  game_id               uuid not null references public.games on delete cascade,
  from_player           uuid not null references public.players on delete cascade,
  to_player             uuid not null references public.players on delete cascade,
  sender_marked         boolean not null default false,
  sender_marked_at      timestamptz,
  receiver_confirmed    boolean not null default false,
  receiver_confirmed_at timestamptz,
  primary key (game_id, from_player, to_player)
);

alter table public.transfer_settlements enable row level security;

-- קריאה לכל חבר מאושר בקלאב; כתיבה רק דרך הפונקציות למטה
drop policy if exists settlements_select on public.transfer_settlements;
create policy settlements_select on public.transfer_settlements for select
  using (public.is_club_member(public.game_club(game_id)));

/* שחקן ששייך למשתמש המחובר */
create or replace function public.player_is_mine(p_player uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from players where id = p_player and user_id = auth.uid());
$$;

/*
  מי רשאי לפעול בשם שחקן:
  שחקן שמקושר לחשבון — רק בעל החשבון עצמו.
  שחקן אורח בלי חשבון — הדילר של השולחן או אדמין הקלאב.
*/
create or replace function public.can_act_for_player(p_game uuid, p_player uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when exists (select 1 from players where id = p_player and user_id is not null)
      then public.player_is_mine(p_player)
    else public.is_game_dealer(p_game) or public.is_club_admin(public.game_club(p_game))
  end;
$$;

create or replace function public.mark_transfer_sent(p_game uuid, p_from uuid, p_to uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_act_for_player(p_game, p_from) then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into transfer_settlements (game_id, from_player, to_player, sender_marked, sender_marked_at)
  values (p_game, p_from, p_to, p_value, case when p_value then now() end)
  on conflict (game_id, from_player, to_player) do update
    set sender_marked = p_value,
        sender_marked_at = case when p_value then now() else null end;
end;
$$;

create or replace function public.confirm_transfer_received(p_game uuid, p_from uuid, p_to uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_act_for_player(p_game, p_to) then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into transfer_settlements (game_id, from_player, to_player, receiver_confirmed, receiver_confirmed_at)
  values (p_game, p_from, p_to, p_value, case when p_value then now() end)
  on conflict (game_id, from_player, to_player) do update
    set receiver_confirmed = p_value,
        receiver_confirmed_at = case when p_value then now() else null end;
end;
$$;

/* העברת סימוני "שולם" מהמנגנון הישן, כדי שלא ייעלמו */
do $$
begin
  insert into transfer_settlements (game_id, from_player, to_player, sender_marked, receiver_confirmed)
  select g.id, split_part(k, '>', 1)::uuid, split_part(k, '>', 2)::uuid, true, true
  from games g, unnest(g.paid_transfers) as k
  where k like '%>%'
  on conflict do nothing;
exception when others then
  null; -- נתונים ישנים לא תקינים לא אמורים להפיל את המיגרציה
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transfer_settlements'
  ) then
    execute 'alter publication supabase_realtime add table public.transfer_settlements';
  end if;
end $$;
