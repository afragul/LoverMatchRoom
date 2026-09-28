-- =====================================================================
--  Ortak Şarkı: kalp sayfasına Spotify/YouTube linki
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- =====================================================================

alter table public.couples
  add column sarki_url text;
