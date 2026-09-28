-- =====================================================================
--  Çiz ve Tahmin Et: kelime bankasını koddan veritabanına taşı
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
--  (schema.sql zaten dolu bir DB'de tekrar çalıştırılamaz, bu dosya
--   sadece eksik olan yeni parçaları içerir)
-- =====================================================================

-- 1) TABLO
-- ---------------------------------------------------------------------

-- Kelime bankası artık kodda değil burada — yeni kelime eklemek için
-- sadece bu tabloya satır eklemek yeterli, deploy gerekmez.
create table public.cizbil_kelimeler (
  id     bigint generated always as identity primary key,
  kelime text not null unique
);

-- Son turlarda çıkan kelimeleri hatırlayıp yeni seçenek üretirken
-- hariç tutabilmek için — art arda aynı kelimelerin gelmesini önler.
alter table public.cizbil_games
  add column son_kelimeler text[] not null default '{}';


-- 2) RLS
-- ---------------------------------------------------------------------

alter table public.cizbil_kelimeler enable row level security;

-- Herkese açık, couple'a özel olmayan paylaşılan oyun içeriği —
-- sadece giriş yapmış olmak yeterli.
create policy "read cizbil_kelimeler"
  on public.cizbil_kelimeler for select
  using (auth.uid() is not null);


-- 3) VERİ
-- ---------------------------------------------------------------------

insert into public.cizbil_kelimeler (kelime) values
  ('KEDİ'), ('KÖPEK'), ('GÜNEŞ'), ('EV'), ('ARABA'), ('AĞAÇ'), ('BALIK'), ('KALP'),
  ('ÇİÇEK'), ('BULUT'), ('YILDIZ'), ('KİTAP'), ('SAAT'), ('ŞEMSİYE'), ('DONDURMA'),
  ('PİZZA'), ('KAHVE'), ('BİSİKLET'), ('UÇAK'), ('GEMİ'), ('KELEBEK'), ('BALON'),
  ('ANAHTAR'), ('GÖZLÜK'), ('AYAKKABI'), ('ŞAPKA'), ('GİTAR'), ('TOP'), ('DENİZ'),
  ('DAĞ'), ('YILAN'), ('FİL'), ('ARI'), ('ÖRÜMCEK'), ('MERDİVEN'),
  -- daha zorlayıcı kelimeler — soyut kavramlar, meslekler, daha az sıradan nesneler
  ('SÜRPRİZ'), ('GÜVEN'), ('PİKNİK'), ('BALAYI'), ('NİŞAN'), ('GÖKKUŞAĞI'),
  ('UÇURTMA'), ('RÜZGARGÜLÜ'), ('DOKTOR'), ('AŞÇI'), ('POLİS'), ('ÖĞRETMEN'),
  ('PİLOT'), ('RESSAM'), ('ASTRONOT'), ('DEDEKTİF'), ('KORSAN'), ('ŞÖVALYE'),
  ('EJDERHA'), ('ROBOT'), ('UZAYLI'), ('HAYALET'), ('VAMPİR'), ('PENGUEN'),
  ('KANGURU'), ('ZÜRAFA'), ('TİMSAH'), ('AKREP'), ('SALYANGOZ'), ('VOLKAN'),
  ('BUZDAĞI'), ('ÇÖL'), ('ŞELALE'), ('MAĞARA'), ('LABİRENT'), ('PUSULA'),
  ('TELESKOP'), ('SATRANÇ'), ('DEĞİRMEN'), ('FENER'), ('MIKNATIS'), ('FIRIN'),
  ('KUM SAATI') 
on conflict (kelime) do nothing;
