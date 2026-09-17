import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconBack } from '../../components/Icons';

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
  const { coupleId, partner } = useCouple();

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
  const turBitti          = !!(oyun && oyun.durum !== 'ciziliyor');

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

  useEffect(() => {
    olcekle();
    window.addEventListener('resize', olcekle);
    return () => window.removeEventListener('resize', olcekle);
  }, [olcekle]);

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
            .then(({ data, error }) => { if (!error) setOyun(data); });
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
    setTahminler([]);
    setGirdi('');
    setHata(null);
    tazele();
  }, [oyun, user.id]);

  function yayinla(event, payload) {
    kanalRef.current?.send({ type: 'broadcast', event, payload: { kim: user.id, ...payload } });
  }

  /* ================= tur başlat ================= */

  async function kelimeSec(kelime) {
    kelimemGizliRef.current = kelime;
    setKelimemGizli(kelime);
    bulunduIsaretRef.current = false;
    setSecenekler(null);

    const { data, error } = await supabase
      .from('cizbil_games')
      .upsert({
        couple_id: coupleId,
        cizen_id: user.id,
        durum: 'ciziliyor',
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
    setTahminler([]);
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
          <p className="eyebrow">Çiz ve Tahmin Et</p>
          <h1>Sırada kim çizecek?</h1>
        </div>
      </header>

      {yukleniyor && <p className="muted">Yükleniyor…</p>}

      {!yukleniyor && secenekler && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s6) var(--s5)' }}>
          <h3>Hangi kelimeyi çizmek istersin?</h3>
          <div className="stack" style={{ gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
            {secenekler.map((k) => (
              <button key={k} className="btn btn--soft btn--block" onClick={() => kelimeSec(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {!yukleniyor && !secenekler && (!oyun || turBitti) && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
          {oyun && turBitti && (
            <>
              <p className="eyebrow">Kelime</p>
              <h3 style={{ marginBottom: 'var(--s2)' }}>{oyun.kelime || '(kayboldu)'}</h3>
              <p className="muted" style={{ marginBottom: 'var(--s4)' }}>
                {oyun.durum === 'bulundu'
                  ? (oyun.cizen_id === user.id
                      ? `${partner?.display_name || 'Partnerin'} buldu!`
                      : 'Buldun!')
                  : 'Pes edildi.'}
              </p>
            </>
          )}
          {!oyun && (
            <p className="muted" style={{ marginBottom: 'var(--s4)' }}>
              Biri çizer, diğeri tahmin eder. Kelime karşı tarafa hiç gösterilmez.
            </p>
          )}
          <button className="btn btn--primary" onClick={() => setSecenekler(rastgele3Kelime())}>
            Ben çizeyim
          </button>
        </div>
      )}

      {!secenekler && oyun && !turBitti && (
        <>
          <p className="muted" style={{ marginBottom: 'var(--s4)' }}>
            {benimCizenOldugum
              ? (kelimemGizli
                  ? `Gizli kelimen: ${kelimemGizli}`
                  : 'Kelimeni kaybettin (sayfa yenilendi) — pes edip yeniden başlayabilirsin.')
              : `${partner?.display_name || 'Partnerin'} çiziyor, tahmin et.`}
          </p>

          <div ref={sarmalRef} style={{ width: '100%' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%', display: 'block', borderRadius: 'var(--r-md)',
                background: 'var(--surface)', boxShadow: 'var(--shadow-sm)',
                touchAction: 'none', cursor: benimCizenOldugum ? 'crosshair' : 'default',
              }}
              onPointerDown={basla}
              onPointerMove={surukle}
              onPointerUp={bitirCizgi}
              onPointerLeave={bitirCizgi}
            />
          </div>

          {benimCizenOldugum && (
            <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)', justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 'var(--s1)' }}>
                {RENKLER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRenk(r)}
                    aria-label={`Renk ${r}`}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: r,
                      border: renk === r ? '2px solid var(--text)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={vazgec}>Pes et</button>
            </div>
          )}

          {!benimCizenOldugum && (
            <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
              <input
                placeholder="Tahminini yaz…"
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tahminGonder()}
                style={{ flex: 1 }}
              />
              <button className="btn btn--soft" onClick={tahminGonder}>Gönder</button>
            </div>
          )}

          {tahminler.length > 0 && (
            <div className="stack" style={{ gap: 'var(--s1)', marginTop: 'var(--s4)' }}>
              {tahminler.map((t, i) => (
                <p key={i} className="faint">
                  <strong>{t.kim === user.id ? 'Sen' : (partner?.display_name || 'Partnerin')}:</strong> {t.metin}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {hata && (
        <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 'var(--s4)' }}>
          {hata}
        </p>
      )}
    </>
  );
}
