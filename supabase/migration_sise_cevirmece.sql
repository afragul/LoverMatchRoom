-- =====================================================================
--  Şişe Çevirmece: yeni oyun
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
--  (schema.sql zaten dolu bir DB'de tekrar çalıştırılamaz, bu dosya
--   sadece eksik olan yeni parçaları içerir)
-- =====================================================================

-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- Soru bankası: couple'a özel değil, TÜM kullanıcılar arasında paylaşılır.
-- Kod içinde değil burada tutulur — biri kendi sorusunu eklerse herkes
-- kullanabilir, deploy gerekmez.
create table public.sise_sorulari (
  id         bigint generated always as identity primary key,
  metin      text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Aktif tur: couple başına tek satır. Klasik oyunun dijital hali —
-- soru + rastgele seçilmiş hedef. Hedef soruyu sesli/yüz yüze cevaplar,
-- uygulama sadece soruyu ve kimin hedef olduğunu gösterir, cevap toplamaz.
-- son_sorular: bu couple'da yakın zamanda çıkan sorular — yeni seçenek
-- üretirken hariç tutulur, art arda aynı soruların gelmesini önler.
create table public.sise_tur (
  couple_id   uuid primary key references public.couples(id) on delete cascade,
  soru_metin  text not null,
  hedef_id    uuid not null references auth.users(id),
  son_sorular text[] not null default '{}',
  updated_at  timestamptz not null default now()
);


-- 2) RLS
-- ---------------------------------------------------------------------

alter table public.sise_sorulari enable row level security;
alter table public.sise_tur      enable row level security;

-- SİSE_SORULARI: herkese açık, couple'a özel olmayan paylaşılan içerik —
-- giriş yapmış herkes okuyabilir ve kendi sorusunu ekleyebilir.
create policy "read sise_sorulari"
  on public.sise_sorulari for select
  using (auth.uid() is not null);

create policy "insert sise_sorulari"
  on public.sise_sorulari for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- SİSE_TUR: sadece kendi couple'ının turu
create policy "read couple sise_tur"
  on public.sise_tur for select
  using (public.is_couple_member(couple_id));

create policy "insert couple sise_tur"
  on public.sise_tur for insert
  with check (public.is_couple_member(couple_id));

create policy "update couple sise_tur"
  on public.sise_tur for update
  using (public.is_couple_member(couple_id));


-- 3) REALTIME
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.sise_tur;


-- 4) VERİ — başlangıç soru bankası
-- ---------------------------------------------------------------------

insert into public.sise_sorulari (metin) values
  ('En unutamadığın anımız hangisi?'),
  ('İlk gördüğünde benim hakkımda ne düşünmüştün?'),
  ('Beni en çok ne zaman kıskanırsın?'),
  ('Birlikte gitmek istediğin ama hiç gidemediğimiz yer neresi?'),
  ('Benimle ilgili en çok neyi seviyorsun?'),
  ('Beraber yaşlanınca nasıl bir çift olacağımızı düşünüyorsun?'),
  ('En büyük hayalin ne, bana hiç anlattın mı?'),
  ('Bir günlüğüne benim yerime geçsen ilk ne yapardın?'),
  ('Sana göre mükemmel bir randevu nasıl olurdu?'),
  ('Beni ilk ne zaman sevdiğini fark ettin?'),
  ('Hangi alışkanlığımı değiştirmemi isterdin?'),
  ('En çok hangi konuda haklı çıktığımı itiraf edersin?'),
  ('Kıskançlık krizine girdiğin bir anı anlat.'),
  ('Bir süper gücün olsaydı ikimiz için ne yapardın?'),
  ('Beraber en çok güldüğümüz an hangisiydi?'),
  ('Aramızdaki en tatlı alışkanlığımız ne?'),
  ('Benimle tanışmadan önce hayatın nasıldı?'),
  ('Gelecekte birlikte yapmak istediğimiz bir şey söyle.'),
  ('En sevdiğin fiziksel özelliğim ne?'),
  ('Sana sürpriz yapsam en çok ne istersin?'),
  ('Bir hayvan olsaydım hangi hayvan olurdum sence?'),
  ('Beraber izlediğimiz en sevdiğin film/dizi hangisi?'),
  ('Kavga ettiğimizde barışmayı kim daha çok ister?'),
  ('Beni en çok ne zaman özlüyorsun?'),
  ('Aşkını nasıl tarif edersin?'),
  ('En garip alışkanlığım ne sence?'),
  ('Sana göre ilişki nasıl olmalı?'),
  ('Beraber bir şarkımız var mı, hangisi?'),
  ('Bugüne kadar sana yaptığım en tatlı sürpriz neydi?'),
  ('İlk öpüştüğümüz anı anlat.'),
  ('En sevdiğin lakabım ne?'),
  ('Sence 10 yıl sonra neredeyiz?'),
  ('Bir kelimeyle beni tanımla.'),
  ('En büyük korkularımdan biri ne biliyor musun?'),
  ('Beraber yapmayı en çok sevdiğimiz şey ne?'),
  ('Uyurken bir huyum var mı, ne?'),
  ('Sana verdiğim en güzel hediye neydi?'),
  ('Bir gün her şeyi unutsam beni nasıl hatırlatırdın?'),
  ('Aramızdaki en komik anıyı anlat.'),
  ('Sence beni en çok kim kıskanır?'),
  ('Küçük bir sır paylaş, hiç kimseye söylemediğin.'),
  ('En çok özlediğin an hangisiydi?'),
  ('Bana söylediğin en tatlı söz neydi?'),
  ('Bir aşk filminde olsaydık adı ne olurdu?'),
  ('En sevdiğin ortak anımız hangi mevsimde geçti?'),
  ('Beraber yolculuk yapsak nereye giderdik?'),
  ('Sana göre en romantik jest nedir?'),
  ('Beni ilk kez ne zaman "aşkım" diye çağırdın?'),
  ('Uzun bir yol yolculuğunda ne konuşuruz sence?'),
  ('Bir hediye alsam sürpriz mi olsun, yoksa söyleyeyim mi?'),
  ('Benimle evlenmeyi/birlikte yaşlanmayı hiç hayal ettin mi?')
on conflict (metin) do nothing;
