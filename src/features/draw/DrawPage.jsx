import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconUndo, IconRedo, IconTrash, IconCheck } from '../../components/Icons';

const RENKLER = [
  '#23181A', '#D24558', '#FDA6AB', '#FAC977', '#61A07D', '#5D300E', '#7FA8D9',
];
const KALINLIKLAR = [2, 5, 10, 18];

export default function DrawPage() {
  const { user } = useAuth();
  const { coupleId, partnerAktif, partner } = useCouple();

  const canvasRef = useRef(null);
  const kanalRef  = useRef(null);
  const cizgiRef  = useRef(null);     // o an çizilen çizgi
  const cizimlerRef = useRef([]);     // tüm çizgiler (benim + partnerin)

  const [renk, setRenk]       = useState(RENKLER[0]);
  const [kalinlik, setKalinlik] = useState(5);
  const [geriYigin, setGeriYigin] = useState([]);  // geri alınanlar (yalnız benimkiler)
  const [adet, setAdet]       = useState(0);       // yeniden çizim tetikleyici
  const [kaydedildi, setKaydedildi] = useState(false);

  /* ---------------- tuvali ölçekle ---------------- */
  const olcekle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const oran = window.devicePixelRatio || 1;
    const kutu = c.getBoundingClientRect();
    c.width  = kutu.width  * oran;
    c.height = kutu.height * oran;
    const ctx = c.getContext('2d');
    ctx.scale(oran, oran);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ciz();
  }, []);

  /* ---------------- tüm çizgileri yeniden çiz ---------------- */
  function ciz() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const oran = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, c.width / oran, c.height / oran);

    for (const cizgi of cizimlerRef.current) {
      if (cizgi.noktalar.length < 2) continue;
      ctx.strokeStyle = cizgi.renk;
      ctx.lineWidth = cizgi.kalinlik;
      ctx.beginPath();
      ctx.moveTo(cizgi.noktalar[0].x, cizgi.noktalar[0].y);
      for (const n of cizgi.noktalar.slice(1)) ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }
  }

  useEffect(() => { ciz(); }, [adet]);

  useEffect(() => {
    olcekle();
    window.addEventListener('resize', olcekle);
    return () => window.removeEventListener('resize', olcekle);
  }, [olcekle]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`cizim:${coupleId}`)
      .on('broadcast', { event: 'cizgi' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        cizimlerRef.current.push(payload.cizgi);
        setAdet((a) => a + 1);
      })
      .on('broadcast', { event: 'temizle' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        cizimlerRef.current = [];
        setGeriYigin([]);
        setAdet((a) => a + 1);
      })
      .on('broadcast', { event: 'geri' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        const i = cizimlerRef.current.map((c) => c.id).lastIndexOf(payload.cizgiId);
        if (i >= 0) {
          cizimlerRef.current.splice(i, 1);
          setAdet((a) => a + 1);
        }
      })
      .subscribe();

    kanalRef.current = kanal;
    return () => { supabase.removeChannel(kanal); kanalRef.current = null; };
  }, [coupleId, user]);

  function yayinla(event, payload) {
    kanalRef.current?.send({ type: 'broadcast', event, payload: { kim: user.id, ...payload } });
  }

  /* ---------------- çizim olayları ---------------- */
  function konum(e) {
    const kutu = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: p.clientX - kutu.left, y: p.clientY - kutu.top };
  }

  function basla(e) {
    e.preventDefault();
    setKaydedildi(false);
    cizgiRef.current = {
      id: crypto.randomUUID(),
      renk, kalinlik,
      noktalar: [konum(e)],
    };
  }

  function surukle(e) {
    if (!cizgiRef.current) return;
    e.preventDefault();
    cizgiRef.current.noktalar.push(konum(e));

    // anlık geri bildirim: sadece son parçayı çiz
    const ctx = canvasRef.current.getContext('2d');
    const n = cizgiRef.current.noktalar;
    if (n.length >= 2) {
      ctx.strokeStyle = cizgiRef.current.renk;
      ctx.lineWidth = cizgiRef.current.kalinlik;
      ctx.beginPath();
      ctx.moveTo(n[n.length - 2].x, n[n.length - 2].y);
      ctx.lineTo(n[n.length - 1].x, n[n.length - 1].y);
      ctx.stroke();
    }
  }

  function bitir() {
    const cizgi = cizgiRef.current;
    cizgiRef.current = null;
    if (!cizgi || cizgi.noktalar.length < 2) return;

    cizgi.sahip = user.id;
    cizimlerRef.current.push(cizgi);
    setGeriYigin([]);            // yeni çizgi -> ileri alma geçmişi sıfırlanır
    setAdet((a) => a + 1);
    yayinla('cizgi', { cizgi });
  }

  /* ---------------- araçlar ---------------- */
  function geriAl() {
    // yalnızca kendi çizgilerimi geri al
    const i = cizimlerRef.current.map((c) => c.sahip).lastIndexOf(user.id);
    if (i < 0) return;
    const [cikan] = cizimlerRef.current.splice(i, 1);
    setGeriYigin((y) => [...y, cikan]);
    setAdet((a) => a + 1);
    yayinla('geri', { cizgiId: cikan.id });
  }

  function ileriAl() {
    if (geriYigin.length === 0) return;
    const geri = geriYigin[geriYigin.length - 1];
    setGeriYigin((y) => y.slice(0, -1));
    cizimlerRef.current.push(geri);
    setAdet((a) => a + 1);
    yayinla('cizgi', { cizgi: geri });
  }

  function temizle() {
    cizimlerRef.current = [];
    setGeriYigin([]);
    setAdet((a) => a + 1);
    yayinla('temizle', {});
  }

  function kaydet() {
    const c = canvasRef.current;
    const gecici = document.createElement('canvas');
    gecici.width = c.width;
    gecici.height = c.height;
    const ctx = gecici.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, gecici.width, gecici.height);
    ctx.drawImage(c, 0, 0);

    const a = document.createElement('a');
    a.download = `cizim-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = gecici.toDataURL('image/png');
    a.click();

    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 2200);
  }

  const benimVar = cizimlerRef.current.some((c) => c.sahip === user.id);

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

      {/* ---------- Araç çubuğu ---------- */}
      <div
        className="card"
        style={{
          padding: 'var(--s2)', marginBottom: 'var(--s3)',
          display: 'flex', gap: 'var(--s1)', justifyContent: 'space-between',
        }}
      >
        <ToolButton onClick={geriAl} disabled={!benimVar} etiket="Geri al"><IconUndo /></ToolButton>
        <ToolButton onClick={ileriAl} disabled={geriYigin.length === 0} etiket="İleri al"><IconRedo /></ToolButton>
        <ToolButton onClick={temizle} disabled={cizimlerRef.current.length === 0} etiket="Tuvali temizle"><IconTrash /></ToolButton>
        <ToolButton onClick={kaydet} disabled={cizimlerRef.current.length === 0} etiket="Görsel olarak kaydet" vurgu>
          {kaydedildi ? <IconCheck /> : <span style={{ fontSize: 13, fontWeight: 700 }}>Kaydet</span>}
        </ToolButton>
      </div>

      {/* ---------- Tuval ---------- */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 380, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={basla}
          onMouseMove={surukle}
          onMouseUp={bitir}
          onMouseLeave={bitir}
          onTouchStart={basla}
          onTouchMove={surukle}
          onTouchEnd={bitir}
        />
      </div>

      {/* ---------- Renk ve kalınlık ---------- */}
      <div className="card" style={{ marginTop: 'var(--s3)', padding: 'var(--s4)' }}>
        <div className="row" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
          {RENKLER.map((r) => (
            <button
              key={r}
              onClick={() => setRenk(r)}
              aria-label={`Renk ${r}`}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: r, cursor: 'pointer',
                border: r === renk ? '2px solid var(--text)' : '2px solid transparent',
                outline: r === renk ? '2px solid var(--surface)' : 'none',
                outlineOffset: -4,
                transition: 'transform 0.18s var(--ease)',
                transform: r === renk ? 'scale(1.12)' : 'none',
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
                flex: 1, height: 40, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                border: 'none',
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

      <p className="faint" style={{ marginTop: 'var(--s3)', textAlign: 'center' }}>
        {partnerAktif
          ? `${partner?.display_name || 'Partnerin'} de aynı tuvalde.`
          : 'Çizdiklerin sayfa kapanınca kaybolur. Saklamak için kaydet.'}
      </p>
    </>
  );
}

function ToolButton({ children, etiket, vurgu, ...p }) {
  return (
    <button
      {...p}
      aria-label={etiket}
      title={etiket}
      style={{
        flex: 1, height: 42, border: 'none', borderRadius: 'var(--r-sm)',
        background: vurgu ? 'var(--surface-soft)' : 'transparent',
        color: vurgu ? 'var(--primary)' : 'var(--text-muted)',
        display: 'grid', placeItems: 'center',
        cursor: p.disabled ? 'default' : 'pointer',
        opacity: p.disabled ? 0.35 : 1,
        transition: 'background 0.2s var(--ease), transform 0.15s var(--ease)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}