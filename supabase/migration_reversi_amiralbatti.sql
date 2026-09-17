-- =====================================================================
--  Yeni oyunlar: Reversi + Amiral Battı
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- =====================================================================

-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- REVERSİ (Othello): 8x8 tahta, couple başına tek satır.
-- board: 64 elemanlı düz dizi (satır-major), her hücre null | 'siyah' | 'beyaz'.
-- siyah_id: oyunu başlatan taraf, siyah taşlarla oynar ve ilk hamleyi yapar.
create table public.reversi_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  board      jsonb not null,
  siyah_id   uuid not null references auth.users(id),
  sira       uuid references auth.users(id),
  kazanan    text,
  updated_at timestamptz not null default now()
);

-- AMİRAL BATTI (Battleship): 8x8 tahta, couple başına tek satır.
-- gemiler/hazir/atislar: { "<user_id>": [...] } — her oyuncu kendi anahtarına yazar.
-- gemiler: gemi başına bir hücre-indeksi (0-63) dizisi, yani dizi içinde dizi
-- (örn. [[12,13,14],[20,28]]) — her gemi ayrı tutulur ki arayüzde tek tek
-- gösterilebilsin. atislar ise attığı hücrelerin düz indeks dizisidir.
-- Diğer oyunlardaki (UNO eller) desenle aynı: satır couple'a açık olduğu için
-- karşı taraf teknik olarak network sekmesinden gemi yerlerini görebilir —
-- dürüstlük esasına dayanır.
-- created_at: her "oyunu başlat" tıklamasında istemci tarafından yeniden yazılır
-- (yeni tur = yeni id), frontend'de yerel gemi taslağını sıfırlamak için kullanılır.
create table public.battleship_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  gemiler    jsonb not null default '{}'::jsonb,
  hazir      jsonb not null default '{}'::jsonb,
  atislar    jsonb not null default '{}'::jsonb,
  sira       uuid references auth.users(id),
  kazanan    uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 2) RLS
-- ---------------------------------------------------------------------

alter table public.reversi_games    enable row level security;
alter table public.battleship_games enable row level security;

-- REVERSI_GAMES: sadece kendi couple'ının oyunu
create policy "read couple reversi_games"
  on public.reversi_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple reversi_games"
  on public.reversi_games for insert
  with check (public.is_couple_member(couple_id) and siyah_id = auth.uid());

create policy "update couple reversi_games"
  on public.reversi_games for update
  using (public.is_couple_member(couple_id));

-- BATTLESHIP_GAMES: sadece kendi couple'ının oyunu
create policy "read couple battleship_games"
  on public.battleship_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple battleship_games"
  on public.battleship_games for insert
  with check (public.is_couple_member(couple_id));

create policy "update couple battleship_games"
  on public.battleship_games for update
  using (public.is_couple_member(couple_id));


-- 3) REALTIME
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.reversi_games;
alter publication supabase_realtime add table public.battleship_games;
