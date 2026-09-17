import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const HARF_SAYISI = 9;
const SÜRE_SN = 90;

// Türkçe Scrabble harf dağılımına yakın ağırlıklar — sesli harfler daha sık.
const HARF_HAVUZU = [
  ['A', 12], ['B', 2], ['C', 2], ['Ç', 2], ['D', 2], ['E', 8], ['F', 1], ['G', 1],
  ['Ğ', 1], ['H', 1], ['I', 4], ['İ', 7], ['J', 1], ['K', 7], ['L', 7], ['M', 4],
  ['N', 5], ['O', 3], ['Ö', 1], ['P', 1], ['R', 6], ['S', 3], ['Ş', 2], ['T', 5],
  ['U', 3], ['Ü', 2], ['V', 1], ['Y', 2], ['Z', 2],
];

function rastgeleHarfler(adet) {
  const toplam = HARF_HAVUZU.reduce((s, [, a]) => s + a, 0);
  const sonuc = [];
  for (let i = 0; i < adet; i++) {
    let r = Math.random() * toplam;
    for (const [harf, agirlik] of HARF_HAVUZU) {
      if (r < agirlik) { sonuc.push(harf); break; }
      r -= agirlik;
    }
  }
  return sonuc;
}

function yapilabilirMi(kelime, havuz) {
  const sayim = {};
  for (const h of havuz) sayim[h] = (sayim[h] || 0) + 1;
  for (const h of kelime) {
    if (!sayim[h]) return false;
    sayim[h]--;
  }
  return true;
}

export default function DuelloPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const kanalRef = useRef(null);
  const oncekiBitisRef = useRef(null);
  const gonderildiRef = useRef(false);

  const [oyun, setOyun]           = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata]           = useState(null);

  const [kelimelerim, setKelimelerim] = useState([]);
  const [girdi, setGirdi]             = useState('');
  const [gonderildiMi, setGonderildiMi] = useState(false);
  const [partnerSayac, setPartnerSayac] = useState(0);
  const [kalan, setKalan]             = useState(0);

  /* ================= yükle + realtime ================= */

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('duello_games')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Tur yüklenemedi. Sayfayı yenile.');
        else setOyun(data);
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId || !user) return;

    const kanal = supabase
      .channel(`duello:${coupleId}`)
      .on('broadcast', { event: 'sayac' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        setPartnerSayac(payload.adet);
      })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'duello_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    kanalRef.current = kanal;
    return () => { supabase.removeChannel(kanal); kanalRef.current = null; };
  }, [coupleId, user]);

  /* ================= yeni tur algılama ================= */

  useEffect(() => {
    if (!oyun || oyun.bitis === oncekiBitisRef.current) return;
    oncekiBitisRef.current = oyun.bitis;
    gonderildiRef.current = false;
    setKelimelerim([]);
    setGirdi('');
    setGonderildiMi(false);
    setPartnerSayac(0);
    setHata(null);
  }, [oyun]);

  /* ================= tur başlat ================= */

  const baslat = useCallback(async () => {
    setHata(null);
    const { data, error } = await supabase
      .from('duello_games')
      .upsert({
        couple_id: coupleId,
        harfler: rastgeleHarfler(HARF_SAYISI),
        bitis: new Date(Date.now() + SÜRE_SN * 1000).toISOString(),
        cevaplar: {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Tur başlatılamadı.');
    else setOyun(data);
  }, [coupleId]);

  /* ================= kelime gönder (round bitince) ================= */

  const gonder = useCallback(() => {
    if (gonderildiRef.current) return;
    gonderildiRef.current = true;
    setGonderildiMi(true);

    supabase.rpc('submit_duello_words', {
      p_couple_id: coupleId,
      p_kelimeler: kelimelerim,
    }).then(({ error }) => { if (error) setHata('Kelimeler gönderilemedi.'); });
  }, [coupleId, kelimelerim]);

  /* ================= geri sayım ================= */

  useEffect(() => {
    if (!oyun || gonderildiMi) return;

    const tik = () => {
      const s = Math.max(0, Math.round((new Date(oyun.bitis).getTime() - Date.now()) / 1000));
      setKalan(s);
      if (s === 0) gonder();
    };
    tik();
    const id = setInterval(tik, 1000);
    return () => clearInterval(id);
  }, [oyun, gonderildiMi, gonder]);

  /* ================= kelime ekle ================= */

  function kelimeEkle() {
    setHata(null);
    const kelime = girdi.trim().toLocaleUpperCase('tr-TR');

    if (kelime.length < 2) { setHata('En az 2 harf olmalı.'); return; }
    if (kelimelerim.includes(kelime)) { setHata('Bu kelimeyi zaten ekledin.'); return; }
    if (!yapilabilirMi([...kelime], oyun.harfler)) { setHata('Bu harflerle yazılamıyor.'); return; }

    const yeni = [...kelimelerim, kelime];
    setKelimelerim(yeni);
    setGirdi('');

    kanalRef.current?.send({
      type: 'broadcast', event: 'sayac', payload: { kim: user.id, adet: yeni.length },
    });
  }

  /* ================= sonuç ================= */

  const ikisiDeGonderdiMi = !!(
    oyun && uyeler.length === 2 && uyeler.every((u) => oyun.cevaplar?.[u.id])
  );

  const benimKelimelerim   = oyun?.cevaplar?.[user.id] ?? [];
  const partnerKelimeleri  = partner ? oyun?.cevaplar?.[partner.id] ?? [] : [];
  const benimHarfSayisi    = benimKelimelerim.reduce((s, k) => s + k.length, 0);
  const partnerHarfSayisi  = partnerKelimeleri.reduce((s, k) => s + k.length, 0);

  let sonuc = null;
  if (ikisiDeGonderdiMi) {
    if (benimKelimelerim.length !== partnerKelimeleri.length) {
      sonuc = benimKelimelerim.length > partnerKelimeleri.length ? 'ben' : 'partner';
    } else if (benimHarfSayisi !== partnerHarfSayisi) {
      sonuc = benimHarfSayisi > partnerHarfSayisi ? 'ben' : 'partner';
    } else {
      sonuc = 'berabere';
    }
  }

  const benKucukMuyum = partner ? user.id < partner.id : true;
  const loglananRef = useRef(null);

  useEffect(() => {
    if (!ikisiDeGonderdiMi || !benKucukMuyum || !oyun) return;
    if (loglananRef.current === oyun.bitis) return;
    loglananRef.current = oyun.bitis;

    supabase.from('oyun_sonuclari').insert({
      couple_id: coupleId,
      oyun: 'duello',
      kazanan_id: sonuc === 'berabere' ? null : (sonuc === 'ben' ? user.id : partner?.id),
    });
  }, [ikisiDeGonderdiMi, benKucukMuyum, sonuc, oyun, coupleId, user.id, partner]);

  const dk = String(Math.floor(kalan / 60)).padStart(2, '0');
  const sn = String(kalan % 60).padStart(2, '0');

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
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">Kelime Düellosu</p>
          <h1 className="text-headline-md text-on-surface">Aynı harfler</h1>
        </div>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz tur yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            {HARF_SAYISI} harf, {SÜRE_SN} saniye. En çok kelimeyi kim yazar?
          </p>
          <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Turu başlat
          </button>
        </div>
      )}

      {oyun && !ikisiDeGonderdiMi && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-text-muted">
              {gonderildiMi
                ? `${partner?.display_name || 'Partnerin'} yazıyor… (${partnerSayac} kelime)`
                : 'Elindeki harflerden kelime yaz.'}
            </p>
            {!gonderildiMi && (
              <span className="font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{dk}:{sn}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-space-sm justify-center">
            {oyun.harfler.map((h, i) => (
              <div key={i} className="w-10 h-10 rounded-lg bg-surface-card shadow-sm grid place-items-center font-extrabold text-lg">
                {h}
              </div>
            ))}
          </div>

          {!gonderildiMi && (
            <div className="flex items-center gap-space-sm">
              <input
                placeholder="Kelime yaz…"
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && kelimeEkle()}
                className="flex-1 h-11 px-space-md rounded-lg bg-surface-card text-on-surface outline-none shadow-sm"
              />
              <button onClick={kelimeEkle} className="px-space-lg h-11 rounded-lg bg-surface-soft text-primary text-label-button">
                Ekle
              </button>
            </div>
          )}

          {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}

          <div className="flex flex-wrap gap-space-xs">
            {kelimelerim.map((k) => (
              <span key={k} className="px-2.5 py-1 rounded-full bg-surface-card text-body-sm text-on-surface shadow-sm">{k}</span>
            ))}
          </div>

          {!gonderildiMi && (
            <div className="text-center">
              <button onClick={gonder} className="px-space-lg py-2 rounded-full bg-surface-card text-on-surface-variant text-label-tab shadow-sm">
                Bitir ({kelimelerim.length} kelime)
              </button>
            </div>
          )}

          {gonderildiMi && (
            <p className="text-text-faint text-body-sm text-center flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-mint-vibrant">check_circle</span> Gönderildi
            </p>
          )}
        </>
      )}

      {ikisiDeGonderdiMi && (
        <>
          <div className="bg-surface-card rounded-xl p-space-lg text-center shadow-sm">
            <h3 className="text-headline-sm text-on-surface">
              {sonuc === 'berabere' && 'Berabere.'}
              {sonuc === 'ben' && 'Kazandın!'}
              {sonuc === 'partner' && `${partner?.display_name || 'Partnerin'} kazandı.`}
            </h3>
            <p className="text-text-faint text-body-sm mt-2">
              Kelimelerin gerçek olup olmadığını kontrol etmiyoruz — bunu ikinize bırakıyoruz.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <div className="bg-surface-card rounded-xl p-space-md shadow-sm">
              <h3 className="text-headline-sm text-on-surface">Sen</h3>
              <p className="text-text-faint text-body-sm mb-space-sm">{benimKelimelerim.length} kelime</p>
              <div className="flex flex-wrap gap-1">
                {benimKelimelerim.map((k) => <span key={k} className="px-2 py-0.5 rounded-full bg-surface-soft text-[13px]">{k}</span>)}
              </div>
            </div>
            <div className="bg-surface-card rounded-xl p-space-md shadow-sm">
              <h3 className="text-headline-sm text-on-surface">{partner?.display_name || 'Partnerin'}</h3>
              <p className="text-text-faint text-body-sm mb-space-sm">{partnerKelimeleri.length} kelime</p>
              <div className="flex flex-wrap gap-1">
                {partnerKelimeleri.map((k) => <span key={k} className="px-2 py-0.5 rounded-full bg-surface-soft text-[13px]">{k}</span>)}
              </div>
            </div>
          </div>

          <div className="text-center">
            <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
              Yeni tur
            </button>
          </div>
        </>
      )}
    </>
  );
}
