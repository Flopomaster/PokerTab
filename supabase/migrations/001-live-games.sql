-- ערב חי: משחק שנפתח וניתן לנהל אותו תוך כדי, לפני שמזינים כמה כל אחד יצא.
-- להריץ ב-SQL Editor פעם אחת. ערבים קיימים מסומנים אוטומטית כסגורים.
alter table public.games
  add column if not exists status text not null default 'closed';
