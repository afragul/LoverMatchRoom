import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const KELIME_BANKASI = [
  'KEDİ', 'KÖPEK', 'GÜNEŞ', 'EV', 'ARABA', 'AĞAÇ', 'BALIK', 'KALP', 'ÇİÇEK', 'BULUT',
  'YILDIZ', 'KİTAP', 'SAAT', 'ŞEMSİYE', 'DONDURMA', 'PİZZA', 'KAHVE', 'BİSİKLET',
  'UÇAK', 'GEMİ', 'KELEBEK', 'BALON', 'ANAHTAR', 'GÖZLÜK', 'AYAKKABI', 'ŞAPKA',
  'GİTAR', 'TOP', 'DENİZ', 'DAĞ', 'YILAN', 'FİL', 'ARI', 'ÖRÜMCEK', 'MERDİVEN',
];

const RENKLER = ['#23181A', '#D24558', '#61A07D', '#7FA8D9', '#FAC977'];
const KALINLIK = 5;
const TUVAL_ORAN = 0.7;

function rastgele3Kelime() {
  const havuz = [...KELIME_BANKASI];
  const secilen = [];
  for (let i = 0; i < 3 && havuz.length; i++) {
    secilen.push(havuz.splice(Math.floor(Math.random() * havuz.length), 1)[0]);
  }
  return secilen;
}

function normale(s) {
  return (s || '').trim().toLocaleUpperCase('tr-TR');
}

export default function CizBilPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const canvasRef = useRef(null);
  const sarmalRef = useRef(null);
  const kanalRef  = useRef(null);

  const cizgilerRef        = useRef([]);
  const aktifRef           = useRef(null);
  const canliRef           = useRef(null);
  const kelimemGizliRef    = useRef(null);
  const oncekiBaslangicRef = useRef(null);
  const bulunduIsaretRef   = useRef(false);
  const oyunRef            = useRef(null);
  const sonYayinRef        = useRef(0);

  const [oyun, setOyun]           = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata]           = useState(null);
  const [secenekler, setSecenekler] = useState(null);
  const [kelimemGizli, setKelimemGizli] = useState(null);
  const [renk, setRenk]           = useState(RENKLER[0]);
  const [tahminler, setTahminler] = useState([]);
  const [girdi, setGirdi]         = useState('');
  const [sayac, setSayac]         = useState(0);

  const tazele = () => setSayac((s) => s + 1);

  const benimCizenOldugum = !!(oyun && oyun.cizen_id === user.id);
  const kelimeSeciliyorMu = !!(oyun && oyun.durum === 'kelime_bekleniyor');
  const turBitti          = !!(oyun && (oyun.durum === 'bulundu' || oyun.durum === 'vazgecildi'));
  const cizimAktif        = !!(oyun && oyun.durum === 'ciziliyor');

  useEffect(() => { oyunRef.current = oyun; }, [oyun]);

  /* ================= çizim motoru ================= */

  function cizgiCiz(ctx, cizgi, g, y) {
    const n = cizgi?.noktalar;
    if (!n || n.length < 2) return;
    ctx.strokeStyle = cizgi.renk;
    ctx.lineWidth = cizgi.kalinlik;
    ctx.beginPath();
    ctx.moveTo(n[0].x * g, n[0].y * y);
    for (const p of n.slice(1)) ctx.lineTo(p.x * g, p.y * y);
    ctx.stroke();
  }

  const ciz = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const kutu = c.getBoundingClientRect();
    const g = kutu.width, y = kutu.height;
    ctx.clearRect(0, 0, g, y);
    for (const s of cizgilerRef.current) cizgiCiz(ctx, s, g, y);
    cizgiCiz(ctx, aktifRef.current, g, y);
    cizgiCiz(ctx, canliRef.current, g, y);
  }, []);

  useEffect(() => { ciz(); }, [sayac, ciz]);

  const olcekle = useCallback(() => {
    const c = canvasRef.current;
    const sarmal = sarmalRef.current;
    if (!c || !sarmal) return;
    const genislik = sarmal.clientWidth;
    const yukseklik = Math.round(genislik * TUVAL_ORAN);
    const dpr = window.devicePixelRatio || 1;
    c.style.width = genislik + 'px';
    c.style.height = yukseklik + 'px';
    c.width = genislik * dpr;
    c.height = yukseklik * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ciz();
  }, [ciz]);

  // Tuval sadece belirli bir oyun durumunda DOM'a giriyor (koşullu render) —
  // ilk yüklemede değil, her göründüğünde yeniden ölçeklenmesi lazım.
  const tuvalGorunurMu = cizimAktif;

  useEffect(() => {
    if (!tuvalGorunurMu) return;
    olcekle();
    window.addEventListener('resize', olcekle);
    return () => window.removeEventListener('resize', olcekle);
  }, [olcekle, tuvalGorunurMu]);

  /* ================= yükle ================= */

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('cizbil_games')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Oyun yüklenemedi. Sayfayı yenile.');
        else { setOyun(data); if (data) oncekiBaslangicRef.current = data.basladi; }
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  /* ================= realtime ================= */

  useEffect(() => {
    if (!coupleId || !user) return;

    const kanal = supabase
      .channel(`cizbil:${coupleId}`)
      .on('broadcast', { event: 'akis' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        canliRef.current = payload.cizgi;
        tazele();
      })
      .on('broadcast', { event: 'cizgi-bitti' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        if (payload.cizgi) cizgilerRef.current.push(payload.cizgi);
        canliRef.current = null;
        tazele();
      })
      .on('broadcast', { event: 'tahmin' }, ({ payload }) => {
        setTahminler((t) => [...t, payload]);

        const guncel = oyunRef.current;
        if (
          guncel?.cizen_id === user.id &&
          guncel.durum === 'ciziliyor' &&
          !bulunduIsaretRef.current &&
          kelimemGizliRef.current &&
          normale(payload.metin) === normale(kelimemGizliRef.current)
        ) {
          bulunduIsaretRef.current = true;
          supabase
            .from('cizbil_games')
            .update({
              durum: 'bulundu',
              kelime: kelimemGizliRef.current,
              updated_at: new Date().toISOString(),
            })
            .eq('couple_id', coupleId)
            .select()
            .single()
            .then(({ data, error }) => {
              if (error) return;
              setOyun(data);
              supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'cizbil', kazanan_id: payload.kim });
            });
        }
      })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cizbil_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    kanalRef.current = kanal;
    return () => { supabase.removeChannel(kanal); kanalRef.current = null; };
  }, [coupleId, user]);

  /* ================= yeni tur algılama ================= */

  useEffect(() => {
    if (!oyun || oyun.basladi === oncekiBaslangicRef.current) return;
    oncekiBaslangicRef.current = oyun.basladi;
    cizgilerRef.current = [];
    aktifRef.current = null;
    canliRef.current = null;
    bulunduIsaretRef.current = false;
    kelimemGizliRef.current = oyun.cizen_id === user.id ? kelimemGizliRef.current : null;
    setKelimemGizli(kelimemGizliRef.current);
    setSecenekler(null);
    setTahminler([]);
    setGirdi('');
    setHata(null);
    tazele();
  }, [oyun, user.id]);

  /* ================= atanan çizen için otomatik kelime seçenekleri ================= */

  useEffect(() => {
    if (
      oyun && oyun.durum === 'kelime_bekleniyor' &&
      oyun.cizen_id === user.id &&
      secenekler === null &&
      kelimemGizliRef.current === null
    ) {
      setSecenekler(rastgele3Kelime());
    }
  }, [oyun, user.id, secenekler]);

  function yayinla(event, payload) {
    kanalRef.current?.send({ type: 'broadcast', event, payload: { kim: user.id, ...payload } });
  }

  /* ================= tur başlat / sırayı devret ================= */

  function siradakiCizenId() {
    if (!oyun) {
      const rastgele = uyeler[Math.floor(Math.random() * uyeler.length)];
      return rastgele?.id ?? user.id;
    }
    const diger = uyeler.find((u) => u.id !== oyun.cizen_id);
    return diger?.id ?? oyun.cizen_id;
  }

  async function turuBaslat() {
    setHata(null);
    const cizenId = siradakiCizenId();

    const { data, error } = await supabase
      .from('cizbil_games')
      .upsert({
        couple_id: coupleId,
        cizen_id: cizenId,
        durum: 'kelime_bekleniyor',
        kelime: null,
        basladi: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) { setHata('Tur başlatılamadı.'); return; }
    oncekiBaslangicRef.current = data.basladi;
    cizgilerRef.current = [];
    aktifRef.current = null;
    canliRef.current = null;
    bulunduIsaretRef.current = false;
    kelimemGizliRef.current = null;
    setKelimemGizli(null);
    setSecenekler(null);
    setTahminler([]);
    setOyun(data);
  }

  async function kelimeSec(kelime) {
    kelimemGizliRef.current = kelime;
    setKelimemGizli(kelime);
    bulunduIsaretRef.current = false;
    setSecenekler(null);

    const { data, error } = await supabase
      .from('cizbil_games')
      .update({ durum: 'ciziliyor', updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
      .select()
      .single();

    if (error) { setHata('Kelime kaydedilemedi.'); return; }
    setOyun(data);
  }

  async function vazgec() {
    if (!benimCizenOldugum || turBitti) return;
    const { data, error } = await supabase
      .from('cizbil_games')
      .update({
        durum: 'vazgecildi',
        kelime: kelimemGizliRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('couple_id', coupleId)
      .select()
      .single();
    if (!error) setOyun(data);
  }

  /* ================= çizim girişleri (sadece çizen) ================= */

  function konum(e) {
    const k = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: (p.clientX - k.left) / k.width, y: (p.clientY - k.top) / k.height };
  }

  function basla(e) {
    if (!benimCizenOldugum || turBitti) return;
    e.preventDefault();
    aktifRef.current = { renk, kalinlik: KALINLIK, noktalar: [konum(e)] };
  }

  function surukle(e) {
    if (!aktifRef.current) return;
    e.preventDefault();
    aktifRef.current.noktalar.push(konum(e));
    tazele();

    const simdi = Date.now();
    if (simdi - sonYayinRef.current > 50) {
      sonYayinRef.current = simdi;
      yayinla('akis', { cizgi: aktifRef.current });
    }
  }

  function bitirCizgi() {
    const cizgi = aktifRef.current;
    aktifRef.current = null;
    if (!cizgi || cizgi.noktalar.length < 2) { tazele(); return; }
    cizgilerRef.current.push(cizgi);
    yayinla('cizgi-bitti', { cizgi });
    tazele();
  }

  /* ================= tahmin gönder ================= */

  function tahminGonder() {
    const metin = girdi.trim();
    if (!metin) return;
    setGirdi('');
    yayinla('tahmin', { metin });
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
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">Çiz ve Tahmin Et</p>
          <h1 className="text-headline-md text-on-surface">Sırada kim çizecek?</h1>
        </div>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <p className="text-body-sm text-text-muted mb-space-md">
            Biri çizer, diğeri tahmin eder. Kelime karşı tarafa hiç gösterilmez. Kim çizecek rastgele belirlenir, sonraki turlarda sırayla devreder.
          </p>
          <button
            onClick={turuBaslat}
            className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md"
          >
            Turu Başlat
          </button>
        </div>
      )}

      {!yukleniyor && turBitti && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <p className="text-label-eyebrow text-primary uppercase">Kelime</p>
          <h3 className="text-headline-sm text-on-surface mt-1 mb-space-sm">{oyun.kelime || '(kayboldu)'}</h3>
          <p className="text-body-sm text-text-muted mb-space-md">
            {oyun.durum === 'bulundu'
              ? (oyun.cizen_id === user.id
                  ? `${partner?.display_name || 'Partnerin'} buldu!`
                  : 'Buldun!')
              : 'Pes edildi.'}
          </p>
          <button
            onClick={turuBaslat}
            className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md"
          >
            Yeni Tur
          </button>
        </div>
      )}

      {!yukleniyor && kelimeSeciliyorMu && (
        benimCizenOldugum ? (
          <div className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
            <h3 className="text-headline-sm text-on-surface">Hangi kelimeyi çizmek istersin?</h3>
            <div className="flex flex-col gap-space-sm mt-space-md">
              {(secenekler ?? []).map((k) => (
                <button
                  key={k}
                  onClick={() => kelimeSec(k)}
                  className="w-full py-2.5 rounded-full bg-surface-soft text-primary text-label-button"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
            <p className="text-body-sm text-text-muted">
              Sıra {partner?.display_name || 'partnerinde'}, kelime seçiyor…
            </p>
          </div>
        )
      )}

      {cizimAktif && (
        <>
          <p className="text-body-sm text-text-muted">
            {benimCizenOldugum
              ? (kelimemGizli
                  ? `Gizli kelimen: ${kelimemGizli}`
                  : 'Kelimeni kaybettin (sayfa yenilendi) — pes edip yeniden başlayabilirsin.')
              : `${partner?.display_name || 'Partnerin'} çiziyor, tahmin et.`}
          </p>

          <div ref={sarmalRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full block rounded-xl bg-surface shadow-sm touch-none"
              style={{ cursor: benimCizenOldugum ? 'crosshair' : 'default' }}
              onPointerDown={basla}
              onPointerMove={surukle}
              onPointerUp={bitirCizgi}
              onPointerLeave={bitirCizgi}
            />
          </div>

          {benimCizenOldugum && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {RENKLER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRenk(r)}
                    aria-label={`Renk ${r}`}
                    className="w-7 h-7 rounded-full"
                    style={{ background: r, boxShadow: renk === r ? '0 0 0 2px var(--color-surface-card), 0 0 0 4px var(--color-primary)' : 'none' }}
                  />
                ))}
              </div>
              <button onClick={vazgec} className="px-space-md py-1.5 rounded-full bg-surface-card text-on-surface-variant text-label-tab shadow-sm">
                Pes et
              </button>
            </div>
          )}

          {!benimCizenOldugum && (
            <div className="flex items-center gap-space-sm">
              <input
                placeholder="Tahminini yaz…"
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tahminGonder()}
                className="flex-1 h-11 px-space-md rounded-lg bg-surface-card text-on-surface outline-none shadow-sm"
              />
              <button onClick={tahminGonder} className="px-space-lg h-11 rounded-lg bg-surface-soft text-primary text-label-button">
                Gönder
              </button>
            </div>
          )}

          {tahminler.length > 0 && (
            <div className="space-y-1">
              {tahminler.map((t, i) => (
                <p key={i} className="text-text-faint text-body-sm">
                  <strong className="text-on-surface-variant">{t.kim === user.id ? 'Sen' : (partner?.display_name || 'Partnerin')}:</strong> {t.metin}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}
    </>
  );
}
