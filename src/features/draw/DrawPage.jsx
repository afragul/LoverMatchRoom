import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconUndo, IconRedo, IconTrash, IconCheck } from '../../components/Icons';

const RENKLER = [
  '#23181A', '#D24558', '#FDA6AB', '#FAC977', '#61A07D', '#5D300E', '#7FA8D9',
];
const KALINLIKLAR = [2, 5, 10, 18];

// Noktaları 0-1 arası oran olarak saklıyoruz: telefonda çizilen şey
// bilgisayarda da aynı yere denk gelsin.
const TUVAL_ORAN = 0.78;   // yükseklik / genişlik

export default function DrawPage() {
  const { user } = useAuth();
  const { coupleId, partnerAktif, partner } = useCouple();

  const canvasRef   = useRef(null);
  const sarmalRef   = useRef(null);
  const kanalRef    = useRef(null);

  const cizgilerRef = useRef([]);      // kaydedilmiş çizgiler [{id, sahip, data}]
  const aktifRef    = useRef(null);    // benim o an çizdiğim
  const partnerRef  = useRef(null);    // partnerin o an çizdiği (canlı, geçici)
  const sonYayinRef = useRef(0);

  const [renk, setRenk]           = useState(RENKLER[0]);
  const [kalinlik, setKalinlik]   = useState(5);
  const [geriYigin, setGeriYigin] = useState([]);
  const [sayac, setSayac]         = useState(0);   // yeniden çizim tetikleyici
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata]           = useState(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  const tazele = () => setSayac((s) => s + 1);

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
    for (const s of cizgilerRef.current) cizgiCiz(ctx, s.data, g, y);
    cizgiCiz(ctx, partnerRef.current, g, y);
    cizgiCiz(ctx, aktifRef.current, g, y);
  }, []);

  useEffect(() => { ciz(); }, [sayac, ciz]);

  /* ================= ölçekleme ================= */

  const olcekle = useCallback(() => {
    const c = canvasRef.current;
    const sarmal = sarmalRef.current;
    if (!c || !sarmal) return;

    const genislik  = sarmal.clientWidth;
    const yukseklik = Math.round(genislik * TUVAL_ORAN);
    const dpr = window.devicePixelRatio || 1;

    c.style.width  = genislik + 'px';
    c.style.height = yukseklik + 'px';
    c.width  = genislik * dpr;
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

  /* ================= kayıtlı çizgileri yükle ================= */

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('strokes')
      .select('id, author_id, data')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) {
          setHata('Tuval yüklenemedi. Sayfayı yenile.');
        } else {
          cizgilerRef.current = (data ?? []).map((s) => ({
            id: s.id, sahip: s.author_id, data: s.data,
          }));
          tazele();
        }
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  /* ================= realtime ================= */

  useEffect(() => {
    if (!coupleId || !user) return;

    const kanal = supabase
      .channel(`tuval:${coupleId}`)

      // partnerin eli hareket ederken — veritabanına yazmadan, sadece görüntü
      .on('broadcast', { event: 'akis' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        partnerRef.current = payload.cizgi;
        tazele();
      })
      .on('broadcast', { event: 'akis-bitti' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        partnerRef.current = null;
        tazele();
      })

      // kalıcı kayıtlar
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'strokes', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => {
          if (cizgilerRef.current.some((s) => s.id === yeni.id)) return;
          cizgilerRef.current.push({ id: yeni.id, sahip: yeni.author_id, data: yeni.data });
          if (yeni.author_id !== user.id) partnerRef.current = null;
          tazele();
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'strokes', filter: `couple_id=eq.${coupleId}` },
        ({ old }) => {
          cizgilerRef.current = cizgilerRef.current.filter((s) => s.id !== old.id);
          tazele();
        })
      .subscribe();

    kanalRef.current = kanal;
    return () => { supabase.removeChannel(kanal); kanalRef.current = null; };
  }, [coupleId, user]);

  function yayinla(event, payload) {
    kanalRef.current?.send({
      type: 'broadcast', event, payload: { kim: user.id, ...payload },
    });
  }

  /* ================= giriş olayları ================= */

  function konum(e) {
    const k = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return {
      x: (p.clientX - k.left) / k.width,
      y: (p.clientY - k.top) / k.height,
    };
  }

  function basla(e) {
    e.preventDefault();
    setKaydedildi(false);
    aktifRef.current = { renk, kalinlik, noktalar: [konum(e)] };
  }

  function surukle(e) {
    if (!aktifRef.current) return;
    e.preventDefault();
    aktifRef.current.noktalar.push(konum(e));
    tazele();

    // canlı akış — saniyede ~20 kez, ağı boğmadan
    const simdi = Date.now();
    if (simdi - sonYayinRef.current > 50) {
      sonYayinRef.current = simdi;
      yayinla('akis', { cizgi: aktifRef.current });
    }
  }

  async function bitir() {
    const cizgi = aktifRef.current;
    aktifRef.current = null;
    if (!cizgi || cizgi.noktalar.length < 2) { tazele(); return; }

    yayinla('akis-bitti', {});

    // önce ekranda göster, sonra kaydet (akıcı hissettirir)
    const gecici = { id: 'gecici-' + crypto.randomUUID(), sahip: user.id, data: cizgi };
    cizgilerRef.current.push(gecici);
    setGeriYigin([]);
    tazele();

    const { data, error } = await supabase
      .from('strokes')
      .insert({ couple_id: coupleId, author_id: user.id, data: cizgi })
      .select('id')
      .single();

    if (error) {
      // kaydedilemediyse ekrandan da kaldır — yanlış izlenim vermesin
      cizgilerRef.current = cizgilerRef.current.filter((s) => s.id !== gecici.id);
      setHata('Çizgi kaydedilemedi. Bağlantını kontrol et.');
      tazele();
      return;
    }

    gecici.id = data.id;   // geçici id'yi gerçeğiyle değiştir
  }

  /* ================= araçlar ================= */

  async function geriAl() {
    const i = cizgilerRef.current.map((s) => s.sahip).lastIndexOf(user.id);
    if (i < 0) return;

    const [cikan] = cizgilerRef.current.splice(i, 1);
    setGeriYigin((y) => [...y, cikan]);
    tazele();

    await supabase.from('strokes').delete().eq('id', cikan.id);
  }

  async function ileriAl() {
    if (geriYigin.length === 0) return;
    const geri = geriYigin[geriYigin.length - 1];
    setGeriYigin((y) => y.slice(0, -1));

    const { data, error } = await supabase
      .from('strokes')
      .insert({ couple_id: coupleId, author_id: user.id, data: geri.data })
      .select('id')
      .single();

    if (error) { setHata('Geri getirilemedi.'); return; }

    cizgilerRef.current.push({ id: data.id, sahip: user.id, data: geri.data });
    tazele();
  }

  async function temizle() {
    if (cizgilerRef.current.length === 0) return;
    if (!window.confirm('Tuvaldeki her şey silinecek. Devam edilsin mi?')) return;

    cizgilerRef.current = [];
    setGeriYigin([]);
    tazele();

    await supabase.from('strokes').delete().eq('couple_id', coupleId);
  }

  function kaydet() {
    const c = canvasRef.current;
    const g = document.createElement('canvas');
    g.width = c.width; g.height = c.height;
    const ctx = g.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, g.width, g.height);
    ctx.drawImage(c, 0, 0);

    const a = document.createElement('a');
    a.download = `tuval-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = g.toDataURL('image/png');
    a.click();

    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 2200);
  }

  const benimVar = cizgilerRef.current.some((s) => s.sahip === user.id);
  const bosDegil = cizgilerRef.current.length > 0;

  return (
    <>
      <header className="row" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <p className="eyebrow">Birlikte Çiz</p>
          <h1>Tuval</h1>
        </div>
        <div className="spacer" />
        <span className={'badge ' + (partnerAktif ? 'badge--live' : 'badge--away')}>
          <span className="dot" />
          {partnerAktif ? 'Bağlı' : 'Yalnızsın'}
        </span>
      </header>

      {/* araç çubuğu */}
      <div
        className="card"
        style={{ padding: 'var(--s2)', marginBottom: 'var(--s3)', display: 'flex', gap: 'var(--s1)' }}
      >
        <Arac onClick={geriAl}  disabled={!benimVar}             etiket="Geri al"><IconUndo /></Arac>
        <Arac onClick={ileriAl} disabled={geriYigin.length === 0} etiket="İleri al"><IconRedo /></Arac>
        <Arac onClick={temizle} disabled={!bosDegil}              etiket="Tuvali temizle"><IconTrash /></Arac>
        <Arac onClick={kaydet}  disabled={!bosDegil} vurgu        etiket="Görsel olarak indir">
          {kaydedildi ? <IconCheck /> : <span style={{ fontSize: 13, fontWeight: 700 }}>İndir</span>}
        </Arac>
      </div>

      {/* tuval */}
      <div
        ref={sarmalRef}
        className="card"
        style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-md)', position: 'relative' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={basla}
          onMouseMove={surukle}
          onMouseUp={bitir}
          onMouseLeave={bitir}
          onTouchStart={basla}
          onTouchMove={surukle}
          onTouchEnd={bitir}
        />

        {yukleniyor && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'var(--surface)', color: 'var(--text-faint)', fontSize: 13,
            }}
          >
            Tuval yükleniyor…
          </div>
        )}

        {!yukleniyor && !bosDegil && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              pointerEvents: 'none', color: 'var(--text-faint)', fontSize: 13,
            }}
          >
            Buraya çizmeye başla
          </div>
        )}
      </div>

      {/* renk + kalınlık */}
      <div className="card" style={{ marginTop: 'var(--s3)', padding: 'var(--s4)' }}>
        <div className="row" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
          {RENKLER.map((r) => (
            <button
              key={r}
              onClick={() => setRenk(r)}
              aria-label={`Renk ${r}`}
              style={{
                width: 30, height: 30, borderRadius: '50%', background: r, cursor: 'pointer',
                border: r === renk ? '2px solid var(--text)' : '2px solid transparent',
                outline: r === renk ? '2px solid var(--surface)' : 'none',
                outlineOffset: -4,
                transform: r === renk ? 'scale(1.12)' : 'none',
                transition: 'transform 0.18s var(--ease)',
              }}
            />
          ))}
        </div>

        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
          {KALINLIKLAR.map((k) => (
            <button
              key={k}
              onClick={() => setKalinlik(k)}
              aria-label={`Fırça ${k}`}
              style={{
                flex: 1, height: 40, borderRadius: 'var(--r-sm)', cursor: 'pointer', border: 'none',
                background: k === kalinlik ? 'var(--surface-soft)' : 'transparent',
                display: 'grid', placeItems: 'center',
                transition: 'background 0.2s var(--ease)',
              }}
            >
              <span style={{ width: k + 6, height: k + 6, borderRadius: '50%', background: renk, display: 'block' }} />
            </button>
          ))}
        </div>
      </div>

      {hata && (
        <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 'var(--s3)', textAlign: 'center' }}>
          {hata}
        </p>
      )}

      <p className="faint" style={{ marginTop: 'var(--s3)', textAlign: 'center' }}>
        {partnerAktif
          ? `${partner?.display_name || 'Partnerin'} de aynı tuvalde.`
          : 'Tuval saklanıyor. İstediğin zaman geri dön.'}
      </p>
    </>
  );
}

function Arac({ children, etiket, vurgu, ...p }) {
  return (
    <button
      {...p}
      aria-label={etiket}
      title={etiket}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        flex: 1, height: 42, border: 'none', borderRadius: 'var(--r-sm)',
        background: vurgu ? 'var(--surface-soft)' : 'transparent',
        color: vurgu ? 'var(--primary)' : 'var(--text-muted)',
        display: 'grid', placeItems: 'center',
        cursor: p.disabled ? 'default' : 'pointer',
        opacity: p.disabled ? 0.35 : 1,
        transition: 'background 0.2s var(--ease)',
      }}
    >
      {children}
    </button>
  );
}