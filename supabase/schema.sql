-- =====================================================================
--  Çiftler Uygulaması — Veritabanı Şeması (Supabase / Postgres)
--
--  KULLANIM: Supabase Dashboard > SQL Editor > New query > yapıştır > Run
--  Bu dosya sıfırdan kurulum içindir. Tamamını tek seferde çalıştır.
--
--  Sıra önemli:
--    1) Tablolar
--    2) Yardımcı fonksiyonlar
--    3) Trigger'lar
--    4) RPC (davet kodu üret / kullan)
--    5) RLS politikaları
--    6) Realtime
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- Kullanıcı profili (auth.users'a 1-1 bağlı)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Ortak oda: bir çift = bir couple
create table public.couples (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Couple üyeleri (her couple'da tam 2 satır olacak)
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id   uuid not null references auth.users(id)     on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- Davet kodları (8 haneli, karışan harfler çıkarılmış alfabe)
create table public.invites (
  code       text primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by    uuid references auth.users(id),
  couple_id  uuid references public.couples(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at    timestamptz
);

-- Örnek feature tablosu: NOTLAR
-- (draw / games tabloları da birebir aynı desenle yazılacak: couple_id + RLS)
create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  author_id  uuid not null references auth.users(id)     on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ÇİZİM: ortak tuvaldeki kalıcı çizgiler
-- (canlı akış broadcast ile gidiyor, burada sadece tamamlanan çizgi saklanıyor)
create table public.strokes (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  author_id  uuid not null references auth.users(id)     on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- XOX: couple başına tek aktif oyun satırı (yeni oyun = aynı satırın üzerine yazılır)
-- Kimin O olduğu ayrıca tutulmuyor: couple'da 2 kişi var, x_user_id olmayan O'dur.
create table public.xox_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  board      jsonb not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  x_user_id  uuid not null references auth.users(id),
  sira       uuid references auth.users(id),
  kazanan    text,
  updated_at timestamptz not null default now()
);

-- KELİME DÜELLOSU: aynı harflerden süreli tur, kim daha çok kelime yazar
-- cevaplar: { "<user_id>": ["KELIME1", "KELIME2", ...] } — her oyuncu kendi anahtarına yazar
create table public.duello_games (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  harfler    jsonb not null,
  bitis      timestamptz not null,
  cevaplar   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2) YARDIMCI FONKSİYONLAR
--    (security definer -> RLS özyinelemesini kırar)
-- ---------------------------------------------------------------------

-- Giriş yapan kullanıcı bu couple'ın üyesi mi?
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from couple_members
    where couple_id = p_couple_id
      and user_id = auth.uid()
  );
$$;

-- Verilen kullanıcı benim partnerim mi? (aynı couple'da mıyız?)
create or replace function public.is_partner(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from couple_members me
    join couple_members them on them.couple_id = me.couple_id
    where me.user_id = auth.uid()
      and them.user_id = p_user_id
      and them.user_id <> me.user_id
  );
$$;


-- ---------------------------------------------------------------------
-- 3) TRIGGER'LAR
-- ---------------------------------------------------------------------

-- Yeni kullanıcı kaydolunca otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bir couple'a en fazla 2 kişi girebilsin
create or replace function public.enforce_couple_size()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_couple_size
  before insert on couple_members
  for each row execute function public.enforce_couple_size();


-- ---------------------------------------------------------------------
-- 4a) DAVET KODU ÜRET
--     Frontend'den:  supabase.rpc('generate_invite')
--     Döner: 'K7MP2XQ4' gibi 8 haneli kod
--     Gösterirken 4+4 böl:  code.slice(0,4) + '-' + code.slice(4)
-- ---------------------------------------------------------------------
create or replace function public.generate_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Karışan karakterler (I, L, O, U) çıkarıldı -> 32 karakter
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code     text;
  v_try      int := 0;
begin
  -- zaten eşleşmiş kullanıcı yeni davet üretemesin
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'ALREADY_MATCHED';
  end if;

  -- kullanıcının eski, kullanılmamış kodlarını iptal et
  -- (her zaman tek geçerli kodu olsun)
  delete from invites
   where created_by = auth.uid()
     and used_at is null;

  loop
    v_try := v_try + 1;
    if v_try > 10 then
      raise exception 'CODE_GENERATION_FAILED';
    end if;

    -- 8 haneli rastgele kod üret
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;

    begin
      insert into invites (code, created_by) values (v_code, auth.uid());
      return v_code;                      -- başarılı, çık
    exception when unique_violation then
      -- çakıştı, döngü tekrar dener
    end;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 4b) DAVET KODU İLE EŞLEŞ  (tek transaction'da, atomik)
--     Frontend'den:  supabase.rpc('redeem_invite', { p_code: 'K7MP2XQ4' })
--     Döner: oluşan couple_id
--     Tire/boşluk/küçük harf sorun değil, fonksiyon kendi temizliyor.
-- ---------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite    invites;
  v_couple_id uuid;
  v_code      text;
begin
  -- gelen kodu normalize et: tire/boşluk sil, büyük harfe çevir
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  -- kodu kilitle (aynı anda 2 kişi kullanamasın)
  select * into v_invite from invites where code = v_code for update;

  if v_invite is null then
    raise exception 'INVALID_CODE';
  end if;
  if v_invite.used_at is not null then
    raise exception 'CODE_ALREADY_USED';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'CODE_EXPIRED';
  end if;
  if v_invite.created_by = auth.uid() then
    raise exception 'CANNOT_MATCH_SELF';
  end if;

  -- tek-couple modeli: iki taraf da halihazırda eşleşmemiş olmalı
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception 'ALREADY_MATCHED';
  end if;
  if exists (select 1 from couple_members where user_id = v_invite.created_by) then
    raise exception 'INVITER_ALREADY_MATCHED';
  end if;

  insert into couples default values returning id into v_couple_id;

  insert into couple_members (couple_id, user_id) values
    (v_couple_id, v_invite.created_by),
    (v_couple_id, auth.uid());

  update invites
     set used_by = auth.uid(), used_at = now(), couple_id = v_couple_id
   where code = v_code;

  return v_couple_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4c) KELİME DÜELLOSU: KELİMELERİ GÖNDER (atomik merge)
--     Frontend'den:  supabase.rpc('submit_duello_words', { p_couple_id, p_kelimeler })
--     İki oyuncu da aynı anda gönderirse birbirinin anahtarını ezmesin diye
--     düz update yerine bu fonksiyon kullanılıyor.
-- ---------------------------------------------------------------------
create or replace function public.submit_duello_words(p_couple_id uuid, p_kelimeler jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_COUPLE_MEMBER';
  end if;

  update duello_games
     set cevaplar   = coalesce(cevaplar, '{}'::jsonb) || jsonb_build_object(auth.uid()::text, p_kelimeler),
         updated_at = now()
   where couple_id = p_couple_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5) RLS (Row Level Security) — asıl güvenlik burada
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.invites        enable row level security;
alter table public.notes          enable row level security;
alter table public.strokes        enable row level security;
alter table public.xox_games      enable row level security;
alter table public.duello_games   enable row level security;

-- PROFILES: kendi profilini + partnerinin profilini gör
create policy "read own or partner profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_partner(id));

create policy "insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- COUPLES: sadece üyesi olduğun couple'ı gör
create policy "read own couple"
  on public.couples for select
  using (public.is_couple_member(id));

-- COUPLE_MEMBERS: üyesi olduğun couple'ın üyelerini gör
create policy "read own couple members"
  on public.couple_members for select
  using (public.is_couple_member(couple_id));

-- INVITES: sadece kendi ürettiğin davetleri gör/yönet
-- (kod kullanımı redeem_invite RPC üzerinden olduğu için
--  karşı tarafın bu tabloyu görmesine gerek yok)
create policy "manage own invites"
  on public.invites for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- NOTES: sadece kendi couple'ının notları
create policy "read couple notes"
  on public.notes for select
  using (public.is_couple_member(couple_id));

create policy "insert couple notes"
  on public.notes for insert
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

create policy "delete own notes"
  on public.notes for delete
  using (author_id = auth.uid());

-- STROKES: sadece kendi couple'ının çizgileri
create policy "read couple strokes"
  on public.strokes for select
  using (public.is_couple_member(couple_id));

create policy "insert couple strokes"
  on public.strokes for insert
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

create policy "delete couple strokes"
  on public.strokes for delete
  using (public.is_couple_member(couple_id));

-- XOX_GAMES: sadece kendi couple'ının oyunu
create policy "read couple xox_games"
  on public.xox_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple xox_games"
  on public.xox_games for insert
  with check (public.is_couple_member(couple_id) and x_user_id = auth.uid());

create policy "update couple xox_games"
  on public.xox_games for update
  using (public.is_couple_member(couple_id));

-- DUELLO_GAMES: sadece kendi couple'ının turu
-- (kelime gönderimi RLS'i bypass eden submit_duello_words RPC'si üzerinden;
--  düz update politikası sadece "yeni tur başlat" upsert'i için gerekli)
create policy "read couple duello_games"
  on public.duello_games for select
  using (public.is_couple_member(couple_id));

create policy "insert couple duello_games"
  on public.duello_games for insert
  with check (public.is_couple_member(couple_id));

create policy "update couple duello_games"
  on public.duello_games for update
  using (public.is_couple_member(couple_id));


-- ---------------------------------------------------------------------
-- 6) REALTIME (anlık senkron için)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.strokes;
alter publication supabase_realtime add table public.xox_games;
alter publication supabase_realtime add table public.duello_games;