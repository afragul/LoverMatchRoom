-- =====================================================================
--  MESAJLAR (Chat)
--  Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- =====================================================================

-- Couple içi mesajlaşma. Diğer feature tablolarıyla (notes, anilar) aynı
-- desen: couple_id + is_couple_member() RLS. Silme/düzenleme yok (bilinçli) —
-- gönderilen mesaj kalıcı, "unsend" gibi bir gereksinim yok şimdilik.
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  sender_id  uuid not null references auth.users(id)     on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Sadece yeni satır ekleniyor (insert-only), delete/update olmadığı için
-- replica identity full gerekmiyor (notes/strokes'un aksine).

alter table public.messages enable row level security;

create policy "read couple messages"
  on public.messages for select
  using (public.is_couple_member(couple_id));

create policy "insert couple messages"
  on public.messages for insert
  with check (public.is_couple_member(couple_id) and sender_id = auth.uid());

alter publication supabase_realtime add table public.messages;
