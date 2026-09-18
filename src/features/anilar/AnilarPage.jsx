import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

// Supabase Storage anahtarları Türkçe karakter/boşluk kabul etmiyor —
// orijinal dosya adı yerine güvenli, üretilmiş bir ad kullan.
function guvenliDosyaAdi(dosya) {
  const uzanti = (dosya.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`;
}

const KATEGORILER = [
  { deger: 'ozel', etiket: 'Özel Gün' },
  { deger: 'tatil', etiket: 'Tatil' },
  { deger: 'yildonumu', etiket: 'Yıldönümü' },
];

const FILTRELER = [
  { deger: 'tumu', etiket: 'Tümü' },
  { deger: 'tatil', etiket: 'Tatiller' },
  { deger: 'ozel', etiket: 'Özel Günler' },
  { deger: 'yildonumu', etiket: 'Yıldönümleri' },
  { deger: 'favori', etiket: '⭐ Favoriler' },
];

function bugun() {
  return new Date().toISOString().slice(0, 10);
}

export default function AnilarPage() {
  const { user } = useAuth();
  const { coupleId, gunSayisi } = useCouple();

  const [anilar, setAnilar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [filtre, setFiltre] = useState('tumu');

  const [formAcik, setFormAcik] = useState(false);
  const [baslik, setBaslik] = useState('');
  const [hikaye, setHikaye] = useState('');
  const [tarih, setTarih] = useState(bugun());
  const [kategori, setKategori] = useState('ozel');
  const [dosya, setDosya] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('anilar')
      .select('*')
      .eq('couple_id', coupleId)
      .order('tarih', { ascending: false })
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Anılar yüklenemedi.');
        else setAnilar(data ?? []);
        setYukleniyor(false);
      });

    const kanal = supabase
      .channel(`anilar:${coupleId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'anilar', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setAnilar((e) => (e.some((a) => a.id === yeni.id) ? e : [yeni, ...e].sort((a, b) => (a.tarih < b.tarih ? 1 : -1)))))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'anilar', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setAnilar((e) => e.map((a) => (a.id === yeni.id ? yeni : a))))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'anilar', filter: `couple_id=eq.${coupleId}` },
        ({ old }) => setAnilar((e) => e.filter((a) => a.id !== old.id)))
      .subscribe();

    return () => { iptal = true; supabase.removeChannel(kanal); };
  }, [coupleId]);

  function formSifirla() {
    setBaslik(''); setHikaye(''); setTarih(bugun()); setKategori('ozel'); setDosya(null);
  }

  async function ekle() {
    const t = baslik.trim();
    if (!t || !tarih) return;

    setKaydediliyor(true);
    setHata(null);

    let fotograf_url = null;
    if (dosya) {
      const yol = `${coupleId}/${guvenliDosyaAdi(dosya)}`;
      const { error: yuklemeHatasi } = await supabase.storage.from('anilar').upload(yol, dosya);
      if (yuklemeHatasi) {
        console.error('Anı fotoğrafı yükleme hatası:', yuklemeHatasi);
        setHata(`Fotoğraf yüklenemedi: ${yuklemeHatasi.message}`);
        setKaydediliyor(false);
        return;
      }
      fotograf_url = supabase.storage.from('anilar').getPublicUrl(yol).data.publicUrl;
    }

    const { data, error } = await supabase
      .from('anilar')
      .insert({
        couple_id: coupleId, author_id: user.id, baslik: t,
        hikaye: hikaye.trim() || null, tarih, kategori, fotograf_url,
      })
      .select()
      .single();

    setKaydediliyor(false);

    if (error) { setHata('Anı kaydedilemedi.'); return; }

    setAnilar((e) => [data, ...e].sort((a, b) => (a.tarih < b.tarih ? 1 : -1)));
    formSifirla();
    setFormAcik(false);
  }

  async function favoriToggle(a) {
    const guncel = !a.favori;
    setAnilar((e) => e.map((x) => (x.id === a.id ? { ...x, favori: guncel } : x)));
    await supabase.from('anilar').update({ favori: guncel }).eq('id', a.id);
  }

  async function sil(id) {
    setAnilar((e) => e.filter((a) => a.id !== id));
    const { error } = await supabase.from('anilar').delete().eq('id', id);
    if (error) setHata('Anı silinemedi.');
  }

  const filtrelenmis = anilar.filter((a) => {
    if (filtre === 'tumu') return true;
    if (filtre === 'favori') return a.favori;
    return a.kategori === filtre;
  });

  const fotoSayisi = anilar.filter((a) => a.fotograf_url).length;
  const ozelTarihSayisi = anilar.filter((a) => a.kategori === 'ozel' || a.kategori === 'yildonumu').length;

  const tarihFormatla = (iso) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <header className="space-y-1">
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Özel Arşiv</p>
        <h1 className="text-headline-lg-mobile text-on-surface">Bizim Anılarımız 📸</h1>
        <p className="text-body-medium text-text-muted">
          Birlikte geçirdiğiniz her anın dijital sandığı.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <div className="bg-surface-card rounded-xl p-space-sm text-center shadow-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">photo_library</span>
          <div className="text-headline-sm text-primary mt-1">{fotoSayisi}</div>
          <span className="text-label-eyebrow text-text-muted">Fotoğraf</span>
        </div>
        <div className="bg-surface-card rounded-xl p-space-sm text-center shadow-sm">
          <span className="material-symbols-outlined text-brown-earth text-[20px]">event</span>
          <div className="text-headline-sm text-brown-earth mt-1">{ozelTarihSayisi}</div>
          <span className="text-label-eyebrow text-text-muted">Özel Tarih</span>
        </div>
        <div className="bg-surface-card rounded-xl p-space-sm text-center shadow-sm">
          <span className="material-symbols-outlined text-mint-vibrant text-[20px]">favorite</span>
          <div className="text-headline-sm text-mint-vibrant mt-1">{gunSayisi ?? '—'}</div>
          <span className="text-label-eyebrow text-text-muted">Mutlu Gün</span>
        </div>
      </section>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-space-md px-space-md">
        {FILTRELER.map((f) => (
          <button
            key={f.deger}
            onClick={() => setFiltre(f.deger)}
            className={
              'px-3.5 py-1.5 rounded-full text-label-tab whitespace-nowrap transition-all ' +
              (filtre === f.deger ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-card text-on-surface-variant')
            }
          >
            {f.etiket}
          </button>
        ))}
      </div>

      <button
        onClick={() => setFormAcik(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary-dark text-on-primary text-label-button shadow-md active:scale-[0.98] transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
        Yeni Anı Ekle
      </button>

      {hata && <div className="bg-surface-card rounded-xl p-space-md text-primary text-body-sm">{hata}</div>}

      {yukleniyor ? (
        <p className="text-body-sm text-text-muted">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz anı yok</h3>
          <p className="text-body-sm text-text-muted mt-1">İlk anınızı yukarıdaki butondan ekleyin.</p>
        </div>
      ) : (
        <div className="space-y-space-lg">
          {filtrelenmis.map((a) => (
            <article key={a.id} className="bg-surface-card rounded-2xl shadow-sm overflow-hidden">
              {a.fotograf_url && (
                <img src={a.fotograf_url} alt={a.baslik} className="w-full h-48 object-cover" />
              )}
              <div className="p-space-lg space-y-space-sm">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-primary text-label-eyebrow uppercase">
                    {KATEGORILER.find((k) => k.deger === a.kategori)?.etiket ?? a.kategori}
                  </span>
                  <button onClick={() => favoriToggle(a)} aria-label="Favori" className="text-primary">
                    <span className="material-symbols-outlined text-[22px]" style={a.favori ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      star
                    </span>
                  </button>
                </div>

                <h2 className="text-headline-sm text-on-surface">{a.baslik}</h2>
                <p className="text-body-sm text-text-muted">{tarihFormatla(a.tarih)}</p>
                {a.hikaye && <p className="text-body-base text-on-surface-variant leading-relaxed">{a.hikaye}</p>}

                {a.author_id === user.id && (
                  <button onClick={() => sil(a.id)} className="text-text-faint text-label-tab">Sil</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {formAcik && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 backdrop-blur-sm" onClick={() => setFormAcik(false)}>
          <div className="w-full bg-surface-card rounded-t-3xl p-space-xl space-y-space-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">Yeni Anı Ekle</h2>
              <button onClick={() => setFormAcik(false)} aria-label="Kapat" className="text-text-muted">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Anı Başlığı</label>
              <input
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                placeholder="Örn: İlk El Ele Tutuşmamız"
                className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              <div>
                <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Tarih</label>
                <input
                  type="date"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
                />
              </div>
              <div>
                <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Kategori</label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
                >
                  {KATEGORILER.map((k) => <option key={k.deger} value={k.deger}>{k.etiket}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Anının Hikayesi</label>
              <textarea
                rows={3}
                value={hikaye}
                onChange={(e) => setHikaye(e.target.value)}
                placeholder="O an hissettiklerin, küçük detaylar…"
                className="w-full p-space-md rounded-lg bg-surface-soft text-on-surface outline-none resize-none"
              />
            </div>

            <label className="block p-space-lg rounded-xl bg-surface-soft text-center cursor-pointer">
              <span className="material-symbols-outlined text-[32px] text-primary block mb-1">cloud_upload</span>
              <span className="text-label-tab text-on-surface block">
                {dosya ? dosya.name : 'Fotoğrafı Buraya Bırak veya Seç'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setDosya(e.target.files?.[0] ?? null)} />
            </label>

            <button
              onClick={ekle}
              disabled={kaydediliyor || !baslik.trim()}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-primary text-label-button shadow-md"
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Anıyı Kaydet ✨'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
