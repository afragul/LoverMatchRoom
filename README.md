# LoverMatchRoom

Çiftler için ortak dijital oda: davet koduyla eşleş, notlar bırak, birlikte çizim yap, yakında oyun oyna.

React + Vite ön yüzü ve Supabase (Postgres + Auth + Realtime) arka ucu ile çalışır. Arayüz tamamen Türkçe.

## Özellikler

- **Eşleşme** — bir kullanıcı 8 haneli davet kodu üretir, diğeri bu kodla katılır; bir çift (`couple`) en fazla 2 üyeden oluşur.
- **Ana sayfa** — çiftin ortak durumu ve partnerin aktif/pasif bilgisi.
- **Notlar** — çifte özel not bırakma.
- **Çiz** — gerçek zamanlı ortak çizim tahtası: partnerin çizgileri Supabase realtime broadcast ile anlık akar, tamamlanan çizgiler kalıcı olarak saklanır (undo/redo, renk/kalınlık seçimi, görsel indirme).
- **Oyunlar** — sırayla oynanan oyunlar için hazırlık ekranı (XOX, Kelime Düellosu, Çiz ve Tahmin Et, Bunu Bilir misin — henüz aktif değil).
- **Anılar** — planlanan fotoğraf/tarih arşivi (henüz veri katmanına bağlı değil).

## Proje yapısı

```
src/
  context/    AuthContext, CoupleContext — oturum ve çift durumu
  features/   auth, match, home, notes, draw, games, room
  components/ AppShell, Icons, Bond gibi paylaşılan UI parçaları
  lib/        Supabase istemcisi
supabase/
  schema.sql  Veritabanı şeması: tablolar, RLS politikaları, RPC fonksiyonları
```

## Kurulum

```bash
npm install
```

Proje kökünde bir `.env` dosyası oluşturup Supabase proje bilgilerini girin:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Supabase tarafında SQL Editor'den [supabase/schema.sql](supabase/schema.sql) dosyasını çalıştırın (tablolar, RLS ve davet kodu RPC'lerini kurar).

> Not: [DrawPage.jsx](src/features/draw/DrawPage.jsx) bir `strokes` tablosu kullanıyor; bu tablo henüz `schema.sql` içine eklenmemiş — çizim özelliğini kullanmadan önce bu tabloyu (couple_id, author_id, data, RLS ile) şemaya eklemeniz gerekir.

Geliştirme sunucusunu başlatın:

```bash
npm run dev
```

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — üretim derlemesi
- `npm run lint` — ESLint kontrolü
- `npm run preview` — üretim derlemesini yerelde önizle
