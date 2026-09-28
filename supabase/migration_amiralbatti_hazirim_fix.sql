-- =====================================================================
--  Amiral Battı: "Hazırım" düğmesini atomik hale getir
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
--
--  Bug: iki oyuncu da "Hazırım"a birbirine yakın zamanda basınca, düz
--  UPDATE kendi tarayıcısındaki (henüz partnerin realtime güncellemesini
--  almamış) eski `oyun` state'ine göre partnerHazirMi hesaplıyordu. İkisi
--  de partnerini "henüz hazır değil" sanıp `sira` alanını hiç yazmıyordu
--  — oyun ikisi de hazırken sırasız kilitli kalıyordu. submit_duello_words
--  ile aynı desen: tek transaction'lı atomik UPDATE, sıra ataması da
--  aynı fonksiyon içinde, DB'deki güncel satıra göre yapılıyor.
-- =====================================================================

create or replace function public.battleship_hazirim(p_couple_id uuid, p_gemiler jsonb)
returns public.battleship_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.battleship_games;
  v_hazir_sayisi int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_COUPLE_MEMBER';
  end if;

  update battleship_games
     set gemiler    = coalesce(gemiler, '{}'::jsonb) || jsonb_build_object(auth.uid()::text, p_gemiler),
         hazir      = coalesce(hazir, '{}'::jsonb) || jsonb_build_object(auth.uid()::text, true),
         updated_at = now()
   where couple_id = p_couple_id
   returning * into v_row;

  select count(*) into v_hazir_sayisi
    from jsonb_each(v_row.hazir) as h(key, value)
   where value::boolean;

  -- her iki taraf da hazır ve sıra henüz atanmamışsa, rastgele belirle
  if v_hazir_sayisi >= 2 and v_row.sira is null and v_row.kazanan is null then
    update battleship_games
       set sira = (select user_id from couple_members where couple_id = p_couple_id order by random() limit 1)
     where couple_id = p_couple_id
     returning * into v_row;
  end if;

  return v_row;
end;
$$;
