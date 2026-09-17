-- =====================================================================
--  Yeni oyunlar: Kutu Doldurma + Dört Taş
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
--  (schema.sql zaten dolu bir DB'de tekrar çalıştırılamaz, bu dosya
--   sadece eksik olan yeni parçaları içerir)
-- =====================================================================

-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- KUTU DOLDURMA (Dots and Boxes): 4x4 nokta -> 3x3 kutu, couple başına tek satır.
-- yatay/dikey: her kenarın sahibi (çizen kullanıcının id'si) ya da null.
-- kutular: her kutunun sahibi (son kenarı tamamlayan kullanıcı) ya da null.
-- kazanan text: kazanan user_id'si ya da 'berabere' (XOX'taki desenle aynı).
create table public.dotsboxes_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  yatay      jsonb not null,
  dikey      jsonb not null,
  kutular    jsonb not null,
  sira       uuid references auth.users(id),
  kazanan    text,
  updated_at timestamptz not null default now()
);

-- DÖRT TAŞ (Connect 4): 7 sütun x 6 satır, couple başına tek satır.
-- board: 42 elemanlı düz dizi (satır-major), her hücre null | 'kirmizi' | 'sari'.
-- kirmizi_id: oyunu başlatan taraf, kırmızı taşlarla oynar.
create table public.connect4_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  board      jsonb not null,
  kirmizi_id uuid not null references auth.users(id),
  sira       uuid references auth.users(id),
  kazanan    text,
  updated_at timestamptz not null default now()
);


-- 2) RLS
-- ---------------------------------------------------------------------

alter table public.dotsboxes_games enable row level security;
alter table public.connect4_games  enable row level security;

-- DOTSBOXES_GAMES: sadece kendi couple'ının oyunu
create policy "read couple dotsboxes_games"
  on public.dotsboxes_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple dotsboxes_games"
  on public.dotsboxes_games for insert
  with check (public.is_couple_member(couple_id));

create policy "update couple dotsboxes_games"
  on public.dotsboxes_games for update
  using (public.is_couple_member(couple_id));

-- CONNECT4_GAMES: sadece kendi couple'ının oyunu
create policy "read couple connect4_games"
  on public.connect4_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple connect4_games"
  on public.connect4_games for insert
  with check (public.is_couple_member(couple_id) and kirmizi_id = auth.uid());

create policy "update couple connect4_games"
  on public.connect4_games for update
  using (public.is_couple_member(couple_id));


-- 3) REALTIME
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.dotsboxes_games;
alter publication supabase_realtime add table public.connect4_games;
