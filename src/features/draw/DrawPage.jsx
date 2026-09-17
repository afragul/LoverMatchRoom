import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

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
  const [sohbet, setSohbet]       = useState([]);
  const [sohbetMetin, setSohbetMetin] = useState('');

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
      .on('broadcast', { event: 'sohbet' }, ({ payload }) => {
        setSohbet((s) => [...s, payload]);
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

  function sohbetGonder() {
    const metin = sohbetMetin.trim();
    if (!metin) return;
    setSohbetMetin('');
    kanalRef.current?.send({ type: 'broadcast', event: 'sohbet', payload: { kim: user.id, metin } });
  }

  const benimVar = cizgilerRef.current.some((s) => s.sahip === user.id);
  const bosDegil = cizgilerRef.current.length > 0;

  return (
    <>
      <div className="bg-surface-card rounded-xl p-space-md shadow-sm space-y-space-sm">
        <div className="flex items-center justify-between gap-space-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-label-eyebrow">CANLI TUVAL</span>
          </div>
          {partnerAktif && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mint-soft text-mint-vibrant">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-vibrant animate-pulse" />
              <span className="text-label-eyebrow text-brown-earth">{partner?.display_name || 'Partnerin'} de burada</span>
            </div>
          )}
        </div>
        <h1 className="text-headline-sm text-on-surface">Birlikte Çizim Odası 🎨</h1>
      </div>

      {/* araç çubuğu */}
      <div className="bg-surface-card rounded-xl p-space-sm shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Arac onClick={geriAl} disabled={!benimVar} etiket="Geri al">
          <span className="material-symbols-outlined text-[20px]">undo</span>
        </Arac>
        <Arac onClick={ileriAl} disabled={geriYigin.length === 0} etiket="İleri al">
          <span className="material-symbols-outlined text-[20px]">redo</span>
        </Arac>
        <Arac onClick={temizle} disabled={!bosDegil} etiket="Tuvali temizle">
          <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
        </Arac>
        <Arac onClick={kaydet} disabled={!bosDegil} vurgu etiket="Görsel olarak indir">
          <span className="material-symbols-outlined text-[20px]">
            {kaydedildi ? 'check_circle' : 'download'}
          </span>
        </Arac>
      </div>

      {/* tuval */}
      <div ref={sarmalRef} className="bg-surface-card rounded-xl shadow-md overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="block touch-none cursor-crosshair w-full"
          onMouseDown={basla}
          onMouseMove={surukle}
          onMouseUp={bitir}
          onMouseLeave={bitir}
          onTouchStart={basla}
          onTouchMove={surukle}
          onTouchEnd={bitir}
        />

        {yukleniyor && (
          <div className="absolute inset-0 grid place-items-center bg-surface text-text-faint text-body-sm">
            Tuval yükleniyor…
          </div>
        )}

        {!yukleniyor && !bosDegil && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none text-text-faint text-body-sm">
            Buraya çizmeye başla
          </div>
        )}
      </div>

      {/* renk + kalınlık */}
      <div className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-md">
        <div className="flex items-center gap-2 flex-wrap">
          {RENKLER.map((r) => (
            <button
              key={r}
              onClick={() => setRenk(r)}
              aria-label={`Renk ${r}`}
              className="w-8 h-8 rounded-full transition-transform"
              style={{
                background: r,
                boxShadow: r === renk ? '0 0 0 2px var(--color-surface-card), 0 0 0 4px var(--color-primary)' : 'none',
                transform: r === renk ? 'scale(1.1)' : 'none',
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {KALINLIKLAR.map((k) => (
            <button
              key={k}
              onClick={() => setKalinlik(k)}
              aria-label={`Fırça ${k}`}
              className={
                'flex-1 h-10 rounded-lg grid place-items-center transition-colors ' +
                (k === kalinlik ? 'bg-surface-soft' : 'bg-transparent')
              }
            >
              <span className="rounded-full block" style={{ width: k + 6, height: k + 6, background: renk }} />
            </button>
          ))}
        </div>
      </div>

      {hata && <p className="text-primary text-body-sm font-semibold text-center">{hata}</p>}

      {/* çizim sohbeti */}
      <div className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">forum</span>
          <h2 className="text-headline-sm text-on-surface">Çizim Sohbeti</h2>
        </div>

        {sohbet.length > 0 && (
          <div className="space-y-space-xs max-h-[160px] overflow-y-auto no-scrollbar pr-0.5">
            {sohbet.map((m, i) => (
              <div key={i} className={'flex ' + (m.kim === user.id ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'px-3 py-2 rounded-xl text-body-sm max-w-[80%] ' +
                    (m.kim === user.id ? 'bg-primary text-on-primary rounded-tr-none' : 'bg-surface-soft text-on-surface rounded-tl-none')
                  }
                >
                  {m.metin}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-space-xs">
          <input
            value={sohbetMetin}
            onChange={(e) => setSohbetMetin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sohbetGonder()}
            placeholder="Tatlı bir mesaj yaz…"
            className="flex-1 h-10 px-space-md rounded-full bg-surface-soft text-body-sm text-on-surface outline-none"
          />
          <button
            onClick={sohbetGonder}
            aria-label="Gönder"
            className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>

      <p className="text-body-sm text-text-faint text-center">
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
      className={
        'flex-1 h-10 rounded-lg grid place-items-center transition-colors flex-shrink-0 w-10 ' +
        (vurgu ? 'bg-surface-soft text-primary' : 'bg-transparent text-on-surface-variant') +
        (p.disabled ? ' opacity-35' : '')
      }
    >
      {children}
    </button>
  );
}