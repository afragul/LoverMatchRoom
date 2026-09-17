# Tasarım Sistemi

LoverMatchRoom'un görsel dilini tanımlar: renkler, tipografi, boşluk/yuvarlaklık
tokenları ve tekrar eden UI bileşenleri. Kaynak: [src/styles/theme.css](src/styles/theme.css).
Amaç, yeni ekran/bileşen eklerken aynı hissi (sıcak, yumuşak, mobil-öncelikli) korumak.

## İlkeler

- **Mobil-öncelikli, tek kolon.** Gövde `.shell` ile 480px genişliğe kilitlenir ve
  ortalanır; masaüstünde bile bir telefon ekranı gibi davranır.
- **Yumuşak ve sıcak.** Sert gölge/kontrast yok — ince gölgeler (`--shadow-sm/md/lg`),
  yuvarlak köşeler (12–24px) ve pastel tonlar hakim.
- **Türkçe ve samimi metin.** Buton/etiket metinleri gündelik Türkçe (`Günaydın`,
  `Burası henüz boş.`) — kuru sistem dili değil.
- **Dürüst boş durumlar.** Veri yoksa bunu gizlemek yerine söyle (bkz. Ana Sayfa'daki
  "Burası henüz boş." veya Anılar'daki "Henüz açılmadı" kartları).

## Renk

| Token | Değer | Kullanım |
|---|---|---|
| `--primary` | `#D24558` | Ana aksiyon rengi (butonlar, aktif sekme, odak) |
| `--primary-dark` | `#B33648` | `--primary` hover durumu |
| `--soft-pink` | `#FDA6AB` | İkincil vurgu, input odak halkası |
| `--accent` | `#FAC977` | Altın/sarı vurgu (rozetler, oyun ikonu zemini) |
| `--mint` | `#C6E9C8` | Yeşilimsi vurgu (çizim ikonu zemini) |
| `--green` | `#61A07D` | "Canlı/aktif" durum metni |
| `--brown` | `#5D300E` | İkon zemini üstü koyu metin, hairline tabanı |
| `--bg` | `#FFF9FA` | Sayfa arkaplanı |
| `--surface` | `#FFFFFF` | Kart/input yüzeyi |
| `--surface-soft` | `#FFF3F4` | İkincil yüzey (soft buton, pasif rozet) |
| `--text` / `--text-muted` / `--text-faint` | `#23181A` / `#7A6B6E` / `#A99A9D` | Metin hiyerarşisi |
| `--hairline` | `rgba(93,48,14,.08)` | İnce kenarlıklar |

Renk her zaman CSS custom property üzerinden kullanılır — hex kodu doğrudan
component içine yazma; yeni bir vurgu tonu gerekiyorsa `theme.css`'e token olarak ekle.

## Tipografi

- Font: **Plus Jakarta Sans** (Google Fonts, 400–800 ağırlık), sistem sans-serif fallback.
- Gövde: 15px / 1.55 satır yüksekliği.
- Başlıklar `font-weight: 800`, `letter-spacing: -0.02em`:
  - `h1` 28px — sayfa başlığı (genelde tek sayfada bir tane)
  - `h2` 22px
  - `h3` 17px / `font-weight: 700` — kart başlıkları
- `.eyebrow` — 11px, 700, uppercase, geniş harf aralığı, `--text-faint`: bir bölümün
  üstünde küçük etiket (`"Ana sayfa"`, `"Bugünün notu"`).
- `.muted` / `.faint` — ikincil metin (13px, `--text-faint`) için.

## Boşluk & Yuvarlaklık

8px tabanlı ölçek: `--s1..--s8` = 4, 8, 12, 16, 24, 32, 40, 56px.
Yuvarlaklık: `--r-sm 12px`, `--r-md 16px`, `--r-lg 20px`, `--r-xl 24px`, `--r-full 999px` (hap/daire).

Sabit piksel değeri yazmak yerine bu tokenları kullan; `style={{ gap: 'var(--s3)' }}`
gibi inline stillerde de aynı tokenlar geçerli (bkz. mevcut sayfalar).

## Bileşenler

### Kart — `.card`
Beyaz yüzey, `--r-xl` köşe, `--shadow-sm`. Varyant: `.card--flat` (gölgesiz, soft
arkaplan). Tıklanabilir kart için `.card-tap` ekle — hover'da 3px yukarı kalkar,
active'te küçülür. Genelde bir `<Link>` ya da `<button>` üzerine uygulanır.

### Buton — `.btn`
Taban sınıf + varyant zorunlu:
- `.btn--primary` — dolu, ana aksiyon (kayıt ol, gönder)
- `.btn--soft` — ikincil aksiyon, soft-pink zemin üstü primary metin
- `.btn--ghost` — üçüncül, şeffaf zemin, muted metin
- Boyut/genişlik eklentileri: `.btn--block` (tam genişlik), `.btn--sm`

Bir sayfada en fazla bir `.btn--primary` olmalı — birincil aksiyonu net tut.

### Rozet — `.badge`
Durum göstergesi, hap şekilli, küçük. Varyantlar: `.badge--live` (yeşil, partner
aktif), `.badge--away` (soft gri, pasif), `.badge--gold` (gün sayacı gibi kutlama
bilgisi). Canlı durumda içine `.dot` (7px nokta, `currentColor`) ekle.

### Alt gezinme — `.tabbar`
Ekranın altına sabit, ortalanmış, `max-width: 448px`, bulanık cam efektli
(`backdrop-filter: blur(20px)`) hap. İçindeki `.tab` linkleri ikon + 10px etiket;
aktif sekme `--primary` renginde ve `--surface-soft` zeminde. Yeni bir üst-düzey
bölüm eklerken `AppShell.jsx`'teki `SEKMELER` dizisine ekle, ikon `Icons.jsx`'e.

### FAB — `.fab`
56px yuvarlak, sağ altta (tabbar'ın üstünde, `bottom: 104px`), `--primary` zemin.
Sayfa içi tekil bir hızlı-aksiyon için (örn. yeni not/çizgi ekle).

### Sheet (alt panel) — `.sheet-backdrop` / `.sheet`
Mobilde alttan, ≥560px genişlikte ortadan açılan modal. Karartılmış/bulanık arkaplan
üstüne `slide-up` animasyonlu panel. Form veya onay akışları için `<dialog>` yerine
bunu kullan.

### İkonlar — `Icons.jsx`
Tek dosyada toplu tutulan 24×24 stroke ikon seti: `fill: none`, `stroke: currentColor`,
`strokeWidth: 1.8` (küçük aksiyon ikonları 2.2 kullanabilir, örn. `IconPlus`, `IconCheck`).
Yeni ikon eklerken bu `base` şablonunu kopyala — kalınlık ve stil tutarlılığı için.

## Sayfa iskeleti

Her sayfa aynı desende başlar:

```jsx
<header className="stack-2" style={{ marginBottom: 'var(--s5)' }}>
  <p className="eyebrow">Bölüm adı</p>
  <h1>Başlık</h1>
</header>
```

Düzen yardımcıları: `.stack` (dikey, 16px boşluk), `.stack-2` (dikey, 8px), `.row`
(yatay, ortalanmış, 12px), `.spacer` (flex: 1, sağa itmek için).

## Hareket

- Sayfa geçişi: `.page` üzerinde `rise` animasyonu (opacity + 10px yukarı, 0.45s).
- Sheet açılışı: `slide-up` (24px'den, 0.35s).
- Tüm geçişlerde `--ease: cubic-bezier(0.22, 1, 0.36, 1)` kullanılır — yeni animasyon
  eklerken de bu easing'i kullan, tutarlılık için.
- `prefers-reduced-motion: reduce` global olarak tüm animasyon/geçiş sürelerini
  0.01ms'ye indirir — özel animasyon eklerken bunu bypass etme.

## Yeni bir bileşen eklerken

1. Önce mevcut sınıflardan (`.card`, `.btn`, `.badge`, `.sheet`...) birinin
   karşıladığına emin ol — çoğu ihtiyaç zaten karşılanıyor.
2. Renk/boşluk/köşe için her zaman token kullan, ham değer yazma.
3. Türkçe, samimi metin tonu koru; boş/hata durumlarını dürüstçe yaz.
4. Mobilde (480px gövde genişliği) test et — bu tasarım masaüstü için genişlemez,
   ortalanmış tek kolon olarak kalır.
