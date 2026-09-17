import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconBack, IconCheck } from '../../components/Icons';

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

  const dk = String(Math.floor(kalan / 60)).padStart(2, '0');
  const sn = String(kalan % 60).padStart(2, '0');

  return (
    <>
      <header className="row" style={{ marginBottom: 'var(--s5)', gap: 'var(--s2)' }}>
        <button
          className="btn btn--ghost"
          onClick={() => navigate('/oyunlar')}
          style={{ width: 42, height: 42, padding: 0, display: 'grid', placeItems: 'center' }}
          aria-label="Oyunlara dön"
        >
          <IconBack />
        </button>
        <div>
          <p className="eyebrow">Kelime Düellosu</p>
          <h1>Aynı harfler</h1>
        </div>
      </header>

      {yukleniyor && <p className="muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
          <h3>Henüz tur yok</h3>
          <p className="muted" style={{ marginTop: 'var(--s2)', marginBottom: 'var(--s4)' }}>
            {HARF_SAYISI} harf, {SÜRE_SN} saniye. En çok kelimeyi kim yazar?
          </p>
          <button className="btn btn--primary" onClick={baslat}>Turu başlat</button>
        </div>
      )}

      {oyun && !ikisiDeGonderdiMi && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--s4)' }}>
            <p className="muted">
              {gonderildiMi
                ? `${partner?.display_name || 'Partnerin'} yazıyor… (${partnerSayac} kelime)`
                : 'Elindeki harflerden kelime yaz.'}
            </p>
            {!gonderildiMi && (
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {dk}:{sn}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)',
              justifyContent: 'center', marginBottom: 'var(--s5)',
            }}
          >
            {oyun.harfler.map((h, i) => (
              <div
                key={i}
                className="card"
                style={{
                  width: 40, height: 40, display: 'grid', placeItems: 'center',
                  fontWeight: 800, fontSize: 18,
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {!gonderildiMi && (
            <div className="row" style={{ gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
              <input
                placeholder="Kelime yaz…"
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && kelimeEkle()}
                style={{ flex: 1 }}
              />
              <button className="btn btn--soft" onClick={kelimeEkle}>Ekle</button>
            </div>
          )}

          {hata && (
            <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginBottom: 'var(--s3)' }}>
              {hata}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
            {kelimelerim.map((k) => (
              <span key={k} className="badge">{k}</span>
            ))}
          </div>

          {!gonderildiMi && (
            <div style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
              <button className="btn btn--ghost btn--sm" onClick={gonder}>
                Bitir ({kelimelerim.length} kelime)
              </button>
            </div>
          )}

          {gonderildiMi && (
            <p className="faint" style={{ marginTop: 'var(--s4)', textAlign: 'center' }}>
              <IconCheck style={{ width: 14, height: 14, verticalAlign: -2 }} /> Gönderildi
            </p>
          )}
        </>
      )}

      {ikisiDeGonderdiMi && (
        <>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--s5)', marginBottom: 'var(--s5)' }}>
            <h3>
              {sonuc === 'berabere' && 'Berabere.'}
              {sonuc === 'ben' && 'Kazandın!'}
              {sonuc === 'partner' && `${partner?.display_name || 'Partnerin'} kazandı.`}
            </h3>
            <p className="faint" style={{ marginTop: 'var(--s2)' }}>
              Kelimelerin gerçek olup olmadığını kontrol etmiyoruz — bunu ikinize bırakıyoruz.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
            <div className="card">
              <h3>Sen</h3>
              <p className="faint" style={{ marginBottom: 'var(--s3)' }}>{benimKelimelerim.length} kelime</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s1)' }}>
                {benimKelimelerim.map((k) => <span key={k} className="badge">{k}</span>)}
              </div>
            </div>
            <div className="card">
              <h3>{partner?.display_name || 'Partnerin'}</h3>
              <p className="faint" style={{ marginBottom: 'var(--s3)' }}>{partnerKelimeleri.length} kelime</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s1)' }}>
                {partnerKelimeleri.map((k) => <span key={k} className="badge">{k}</span>)}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
            <button className="btn btn--primary" onClick={baslat}>Yeni tur</button>
          </div>
        </>
      )}
    </>
  );
}
