import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const ADAY_SAYISI = 5;
// aynı sorunun art arda gelmemesi için hafızada tutulan son tur sayısı
const HATIRLANAN_SORU_SAYISI = 15;

// son turlarda çıkan soruları hariç tutarak rastgele N seçenek üretir;
// havuz tükenirse (çok küçük soru bankası) tekrara izin verir.
function rastgeleUye(uyeler) {
  return uyeler[Math.floor(Math.random() * uyeler.length)];
}

function rastgeleSorular(havuz, haricSorular = []) {
  const haric = new Set(haricSorular);
  const aday = havuz.filter((s) => !haric.has(s));
  const kopya = [...(aday.length >= ADAY_SAYISI ? aday : havuz)];
  const secilen = [];
  for (let i = 0; i < ADAY_SAYISI && kopya.length; i++) {
    secilen.push(kopya.splice(Math.floor(Math.random() * kopya.length), 1)[0]);
  }
  return secilen;
}

export default function SiseCevirmecePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const [tur, setTur] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [soruHavuzu, setSoruHavuzu] = useState([]);
  const [seciyorMu, setSeciyorMu] = useState(false);
  const [adaylar, setAdaylar] = useState(null);
  const [ozelSoru, setOzelSoru] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const benHedefMiyim = !!(tur && tur.hedef_id === user.id);

  /* ================= yükle ================= */

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('sise_tur')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Tur yüklenemedi. Sayfayı yenile.');
        else setTur(data);
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  useEffect(() => {
    let iptal = false;
    supabase
      .from('sise_sorulari')
      .select('metin')
      .then(({ data, error }) => {
        if (iptal || error) return;
        setSoruHavuzu((data ?? []).map((s) => s.metin));
      });
    return () => { iptal = true; };
  }, []);

  /* ================= realtime ================= */

  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`sise:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sise_tur', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => { setTur(yeni); setSeciyorMu(false); })
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  /* ================= aksiyonlar ================= */

  function secimeBasla() {
    setHata(null);
    setAdaylar(rastgeleSorular(soruHavuzu, tur?.son_sorular ?? []));
    setSeciyorMu(true);
  }

  function yenile() {
    setAdaylar(rastgeleSorular(soruHavuzu, tur?.son_sorular ?? []));
  }

  async function soruSec(metin) {
    if (!uyeler.length) return;
    setHata(null);

    const hedef = rastgeleUye(uyeler);
    const sonSorular = [...(tur?.son_sorular ?? []), metin].slice(-HATIRLANAN_SORU_SAYISI);

    const { data, error } = await supabase
      .from('sise_tur')
      .upsert({
        couple_id: coupleId,
        soru_metin: metin,
        hedef_id: hedef.id,
        son_sorular: sonSorular,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) { setHata('Soru kaydedilemedi.'); return; }
    setTur(data);
    setSeciyorMu(false);
  }

  async function ozelSoruGonder() {
    const metin = ozelSoru.trim();
    if (!metin) return;

    setGonderiliyor(true);
    setHata(null);

    const { error } = await supabase
      .from('sise_sorulari')
      .insert({ metin, created_by: user.id });

    setGonderiliyor(false);

    // aynı soru zaten bankadaysa (unique ihlali) sorun değil, yine de kullan
    if (error && error.code !== '23505') { setHata('Soru eklenemedi.'); return; }

    setSoruHavuzu((h) => (h.includes(metin) ? h : [...h, metin]));
    setOzelSoru('');
    await soruSec(metin);
  }

  return (
    <>
      <header className="flex items-center gap-space-sm">
        <button
          onClick={() => navigate('/oyunlar')}
          aria-label="Oyunlara dön"
          className="w-10 h-10 rounded-full bg-surface-card shadow-sm flex items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">Şişe Çevirmece</p>
          <h1 className="text-headline-md text-on-surface">Şişe kime dönecek?</h1>
        </div>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !tur && !seciyorMu && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz tur yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Şişeyi çevir, rastgele biriniz hedef olur ve çıkan soruyu sesli cevaplar.
          </p>
          <button
            onClick={secimeBasla}
            disabled={soruHavuzu.length === 0}
            className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md disabled:opacity-50"
          >
            Şişeyi Çevir
          </button>
        </div>
      )}

      {!yukleniyor && tur && !seciyorMu && (
        <>
          <div className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
            <p className="text-label-eyebrow text-primary uppercase tracking-widest">
              {benHedefMiyim ? 'Sıra sende!' : `Sıra ${partner?.display_name || 'partnerinde'}`}
            </p>
            <h3 className="text-headline-sm text-on-surface mt-2">{tur.soru_metin}</h3>
          </div>

          <div className="text-center">
            <button
              onClick={secimeBasla}
              disabled={soruHavuzu.length === 0}
              className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md disabled:opacity-50"
            >
              Şişeyi Tekrar Çevir
            </button>
          </div>
        </>
      )}

      {seciyorMu && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-text-muted">Bir soru seç ya da beğenmezsen yenile.</p>
            <button
              onClick={yenile}
              aria-label="Soruları yenile"
              className="w-9 h-9 rounded-full bg-surface-card shadow-sm flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>

          <div className="flex flex-col gap-space-sm">
            {(adaylar ?? []).map((s) => (
              <button
                key={s}
                onClick={() => soruSec(s)}
                className="w-full py-3 px-space-md rounded-xl bg-surface-card text-left text-on-surface text-body-base shadow-sm hover:shadow-md transition-all"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
            <p className="text-label-eyebrow text-text-muted uppercase">Ya da kendi sorunu yaz</p>
            <div className="flex items-center gap-space-sm">
              <input
                placeholder="Kendi sorunu yaz…"
                value={ozelSoru}
                onChange={(e) => setOzelSoru(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ozelSoruGonder()}
                className="flex-1 h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
              />
              <button
                onClick={ozelSoruGonder}
                disabled={gonderiliyor || !ozelSoru.trim()}
                className="px-space-lg h-11 rounded-lg bg-primary text-on-primary text-label-button disabled:opacity-50"
              >
                Kullan
              </button>
            </div>
            <p className="text-[11px] text-text-faint">Yazdığın soru ortak bankaya eklenir, başkaları da kullanabilir.</p>
          </div>

          {tur && (
            <div className="text-center">
              <button onClick={() => setSeciyorMu(false)} className="px-space-lg py-2 rounded-full bg-surface-card text-on-surface-variant text-label-tab shadow-sm">
                Vazgeç
              </button>
            </div>
          )}
        </>
      )}

      {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}
    </>
  );
}
