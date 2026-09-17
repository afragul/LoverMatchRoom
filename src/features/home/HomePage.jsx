import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

function selamla() {
  const s = new Date().getHours();
  if (s < 6) return 'İyi geceler';
  if (s < 12) return 'Günaydın';
  if (s < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function sonrakiYildonumu(baslangic) {
  if (!baslangic) return null;
  const simdi = new Date();
  const baz = new Date(baslangic);

  let hedef = new Date(simdi.getFullYear(), baz.getMonth(), baz.getDate());
  if (hedef < simdi) hedef = new Date(simdi.getFullYear() + 1, baz.getMonth(), baz.getDate());

  const oncekiYildonumu = new Date(hedef.getFullYear() - 1, baz.getMonth(), baz.getDate());
  const toplamGun = Math.max(1, Math.round((hedef - oncekiYildonumu) / 86400000));
  const kalanGun = Math.max(0, Math.ceil((hedef - simdi) / 86400000));
  const yuzde = Math.min(100, Math.round(((toplamGun - kalanGun) / toplamGun) * 100));
  const yil = hedef.getFullYear() - baz.getFullYear();

  return { kalanGun, yuzde, yil, tarih: hedef };
}

const HISSETTIRENLER = [
  { tur: 'opucuk', etiket: 'Öpücük Yolla', emoji: '💋' },
  { tur: 'dusunuyorum', etiket: 'Seni Düşünüyorum', emoji: '💭' },
];

export default function HomePage() {
  const { user } = useAuth();
  const { coupleId, isimler, partner, partnerAktif, baslangic } = useCouple();

  const kanalRef = useRef(null);

  const [sonCizgi, setSonCizgi] = useState(null);
  const [xoxOyunu, setXoxOyunu] = useState(null);
  const [skor, setSkor] = useState(null);
  const [sonNotlar, setSonNotlar] = useState([]);
  const [gecenYilAnisi, setGecenYilAnisi] = useState(null);
  const [toast, setToast] = useState(null);

  const yildonumu = sonrakiYildonumu(baslangic);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase.from('strokes').select('author_id, created_at')
      .eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (!iptal) setSonCizgi(data ?? null); });

    supabase.from('xox_games').select('*').eq('couple_id', coupleId).maybeSingle()
      .then(({ data }) => { if (!iptal) setXoxOyunu(data ?? null); });

    supabase.from('oyun_sonuclari').select('kazanan_id').eq('couple_id', coupleId)
      .then(({ data }) => {
        if (iptal || !data) return;
        const sayim = {};
        for (const s of data) {
          const k = s.kazanan_id ?? 'berabere';
          sayim[k] = (sayim[k] ?? 0) + 1;
        }
        setSkor({ sayim, toplam: data.length });
      });

    supabase.from('notes').select('*').eq('couple_id', coupleId)
      .order('created_at', { ascending: false }).limit(2)
      .then(({ data }) => { if (!iptal) setSonNotlar(data ?? []); });

    supabase.from('anilar').select('id, baslik, tarih, fotograf_url').eq('couple_id', coupleId)
      .then(({ data }) => {
        if (iptal || !data) return;
        const bugun = new Date();
        const eslesen = data
          .filter((a) => {
            const t = new Date(a.tarih);
            return t.getMonth() === bugun.getMonth() && t.getDate() === bugun.getDate() && t.getFullYear() < bugun.getFullYear();
          })
          .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))[0];
        setGecenYilAnisi(eslesen ?? null);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId || !user) return;
    const kanal = supabase
      .channel(`pingler:${coupleId}`)
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        if (payload.kim === user.id) return;
        const h = HISSETTIRENLER.find((x) => x.tur === payload.tur);
        setToast(`${h?.emoji ?? '💛'} ${partner?.display_name || 'Partnerin'} sana ${h?.etiket.toLowerCase() ?? 'bir şey'} gönderdi!`);
        setTimeout(() => setToast(null), 3500);
      })
      .subscribe();
    kanalRef.current = kanal;
    return () => { supabase.removeChannel(kanal); kanalRef.current = null; };
  }, [coupleId, user, partner]);

  const hissettir = useCallback((tur) => {
    kanalRef.current?.send({ type: 'broadcast', event: 'ping', payload: { kim: user.id, tur } });
    const h = HISSETTIRENLER.find((x) => x.tur === tur);
    setToast(`${h.emoji} Gönderildi!`);
    setTimeout(() => setToast(null), 2000);
  }, [user]);

  const benimSkorum = skor?.sayim?.[user.id] ?? 0;
  const partnerSkoru = partner ? skor?.sayim?.[partner.id] ?? 0 : 0;
  const beraberlik = skor?.sayim?.berabere ?? 0;

  return (
    <>
      {/* ---------- Karşılama ---------- */}
      <section className="bg-surface-card rounded-xl p-space-md shadow-sm space-y-space-sm">
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">{selamla()}</p>
        <h1 className="text-headline-lg-mobile text-on-surface">{isimler.join(' & ')}</h1>
        <p className="text-body-sm text-text-muted">
          {partnerAktif ? `${partner?.display_name || 'Partnerin'} şu an burada.` : 'Şu an yalnızsın, ama yakında burada olur.'}
        </p>

        <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
          {HISSETTIRENLER.map((h) => (
            <button
              key={h.tur}
              onClick={() => hissettir(h.tur)}
              className="h-12 rounded-lg bg-surface-soft hover:bg-surface-container active:scale-[0.98] transition-all text-primary text-label-button flex items-center justify-center gap-1.5"
            >
              <span>{h.emoji}</span>
              <span>{h.etiket}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- Yıldönümü sayacı ---------- */}
      {yildonumu && (
        <section
          className="rounded-xl p-space-lg text-on-primary shadow-md space-y-space-sm"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-eyebrow uppercase tracking-wider bg-white/20 px-space-sm py-0.5 rounded-full">
              Yıldönümü sayacı
            </span>
            <span className="material-symbols-outlined text-[20px]">favorite</span>
          </div>
          <p className="text-body-sm opacity-90">
            {yildonumu.tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} — {yildonumu.yil}. yıl dönümünüz
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-display-xl-mobile font-extrabold">{yildonumu.kalanGun}</span>
            <span className="text-label-eyebrow uppercase opacity-80">gün kaldı</span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
            <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${yildonumu.yuzde}%` }} />
          </div>
        </section>
      )}

      {/* ---------- Canlı Çizim önizleme ---------- */}
      <Link to="/ciz" className="block bg-surface-card rounded-xl p-space-lg shadow-sm">
        <div className="flex items-center justify-between mb-space-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
            <h2 className="text-headline-sm text-on-surface">Canlı Çizim Tahtası</h2>
          </div>
          <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
        </div>
        <p className="text-body-sm text-text-muted">
          {sonCizgi
            ? `${sonCizgi.author_id === user.id ? 'Sen' : (partner?.display_name || 'Partnerin')} en son ${new Date(sonCizgi.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihinde çizdi.`
            : 'Tuval henüz boş — ilk çizgiyi sen çek.'}
        </p>
      </Link>

      {/* ---------- Günün Oyunu ---------- */}
      <Link to="/oyunlar" className="block bg-surface-card rounded-xl p-space-lg shadow-sm">
        <div className="flex items-center justify-between mb-space-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[20px]">sports_esports</span>
            <h2 className="text-headline-sm text-on-surface">Oyunlar</h2>
          </div>
          <span className="material-symbols-outlined text-primary text-[18px]">arrow_forward</span>
        </div>
        {skor && skor.toplam > 0 ? (
          <p className="text-body-sm text-text-muted">
            <strong className="text-on-surface">Sen {benimSkorum}</strong> – <strong className="text-on-surface">{partner?.display_name || 'Partnerin'} {partnerSkoru}</strong>
            {beraberlik > 0 && ` (${beraberlik} beraberlik)`} · {skor.toplam} maç
          </p>
        ) : xoxOyunu ? (
          <p className="text-body-sm text-text-muted">
            XOX'ta aktif bir tur var — {xoxOyunu.sira === user.id ? 'sıra sende!' : `${partner?.display_name || 'Partnerin'} oynuyor.`}
          </p>
        ) : (
          <p className="text-body-sm text-text-muted">Henüz oynanan maç yok — ilk turu başlat.</p>
        )}
      </Link>

      {/* ---------- 1 Yıl Önce Bugün ---------- */}
      {gecenYilAnisi && (
        <Link to="/anilar" className="block bg-surface-card rounded-xl overflow-hidden shadow-sm">
          {gecenYilAnisi.fotograf_url && (
            <img src={gecenYilAnisi.fotograf_url} alt={gecenYilAnisi.baslik} className="w-full h-40 object-cover" />
          )}
          <div className="p-space-md space-y-1">
            <span className="text-label-eyebrow text-primary uppercase tracking-wider">Bugün geçmişte</span>
            <h3 className="text-headline-sm text-on-surface">{gecenYilAnisi.baslik}</h3>
          </div>
        </Link>
      )}

      {/* ---------- Son Ortak Notlar ---------- */}
      {sonNotlar.length > 0 && (
        <section className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-on-surface">Son Ortak Notlar</h2>
            <Link to="/notlar" className="text-label-tab text-primary">Tümü</Link>
          </div>
          {sonNotlar.map((n) => (
            <div key={n.id} className="border-t border-hairline pt-space-sm first:border-0 first:pt-0">
              <p className="text-body-sm text-on-surface">
                <strong>{n.author_id === user.id ? 'Sen' : (partner?.display_name || 'Partnerin')}:</strong>{' '}
                {n.body.length > 90 ? n.body.slice(0, 90) + '…' : n.body}
              </p>
            </div>
          ))}
        </section>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-body-sm shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
