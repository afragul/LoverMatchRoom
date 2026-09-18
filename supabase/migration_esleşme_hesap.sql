-- =====================================================================
--  Eşleşmeyi kaldır + Hesabı sil
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- =====================================================================

-- EŞLEŞMEYİ KALDIR
-- couple_members'daki İKİ satırı da siler (her iki taraf da ayrılmış olur,
-- her ikisi de yeni kod üretip başka biriyle eşleşebilir). Couple'a bağlı
-- notlar/oyunlar/anılar KASITLI olarak silinmiyor — sadece artık hiç kimse
-- o couple'ın üyesi olmadığı için RLS (is_couple_member) sayesinde kimse
-- bu eski veriyi göremez, veri DB'de öylece kalır.
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  select couple_id into v_couple_id from couple_members where user_id = auth.uid();

  if v_couple_id is null then
    raise exception 'NOT_MATCHED';
  end if;

  delete from couple_members where couple_id = v_couple_id;
end;
$$;


-- HESABI SİL
-- Hâlâ eşleşikse hesap SİLİNMİYOR (STILL_MATCHED hatası) — paylaşılan couple
-- verisi (notlar/anılar dahil) bir kişiye değil ikisine ait olduğu için
-- yarısını tutmak mümkün değil; kullanıcı önce "eşleşmeyi kaldır" demek
-- zorunda.
--
-- Eşleşik değilse auth.users satırını siler (profiles/couple_members/notes/
-- strokes/anilar/bilirmisin_profil zaten "on delete cascade" ile otomatik
-- gider). Ama couple başına tek satır tutan oyun tablolarındaki bazı
-- sütunlar (x_user_id, sira, kazanan, cizen_id, hedef_id, tahmin_eden_id,
-- kirmizi_id, siyah_id, invites.used_by) CASCADE değil — daha önce
-- "eşleşmeyi kaldır" ile ayrıldığı eski couple'lardan (artık couple_members
--'da izi kalmadığı için hangi couple olduğunu bulamayız) kalan bu satırları
-- burada tek tek tarayıp temizliyoruz, yoksa auth.users silme işlemi FK
-- ihlaliyle patlar.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if exists (select 1 from couple_members where user_id = v_uid) then
    raise exception 'STILL_MATCHED';
  end if;

  delete from xox_games where x_user_id = v_uid or sira = v_uid;

  delete from cizbil_games where cizen_id = v_uid;

  delete from bilirmisin_tur where hedef_id = v_uid;
  update bilirmisin_tur set tahmin_eden_id = null where tahmin_eden_id = v_uid;

  update oyun_sonuclari set kazanan_id = null where kazanan_id = v_uid;

  update uno_games set sira = null where sira = v_uid;
  update uno_games set kazanan = null where kazanan = v_uid;

  update dotsboxes_games set sira = null where sira = v_uid;

  delete from connect4_games where kirmizi_id = v_uid;
  update connect4_games set sira = null where sira = v_uid;

  delete from reversi_games where siyah_id = v_uid;
  update reversi_games set sira = null where sira = v_uid;

  update battleship_games set sira = null where sira = v_uid;
  update battleship_games set kazanan = null where kazanan = v_uid;

  delete from invites where created_by = v_uid or used_by = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;
