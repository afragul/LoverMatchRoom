import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const SORULAR = [
  { id: 'renk',            metin: 'En sevdiğin renk?' },
  { id: 'yemek',           metin: 'En sevdiğin yemek?' },
  { id: 'film-turu',       metin: 'En sevdiğin film türü?' },
  { id: 'tatil',           metin: 'Hayalindeki tatil yeri?' },
  { id: 'hobi',            metin: 'Boş vakitte en çok ne yapmayı seversin?' },
  { id: 'korku',           metin: 'En büyük korkun?' },
  { id: 'cocukluk-meslek', metin: 'Çocukken olmak istediğin meslek?' },
  { id: 'muzik',           metin: 'En sevdiğin müzik türü?' },
  { id: 'hayvan',          metin: 'Bir hayvan olsan ne olurdun?' },
  { id: 'superguc',        metin: 'Hangi süper gücü isterdin?' },
  { id: 'mutluluk',        metin: 'Seni en çok ne mutlu eder?' },
  { id: 'ilk-randevu',     metin: 'Hayalindeki ilk randevu nasıl olurdu?' },
];

function soruBul(id) {
  return SORULAR.find((s) => s.id === id) ?? null;
}

export default function BilirMisinPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const turRef = useRef(null);
  const oncekiAnahtarRef = useRef(null);

  const [tur, setTur]             = useState(null);
  const [hedefCevap, setHedefCevap] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata]           = useState(null);

  const [girdiCevap, setGirdiCevap]   = useState('');
  const [girdiTahmin, setGirdiTahmin] = useState('');

  useEffect(() => { turRef.current = tur; }, [tur]);

  const benHedefMiyim = !!(tur && tur.hedef_id === user.id);
  const soru = tur ? soruBul(tur.soru_id) : null;
  const ifsaEdildi = !!(tur && tur.tahmin_eden_id && hedefCevap != null);

  const turHedefId = tur?.hedef_id;
  const turSoruId  = tur?.soru_id;

  /* ================= yükle ================= */

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('bilirmisin_tur')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Tur yüklenemedi. Sayfayı yenile.');
        else { setTur(data); if (data) oncekiAnahtarRef.current = data.soru_id + '|' + data.hedef_id; }
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  /* ================= hedefin cevabını getir ================= */

  useEffect(() => {
    if (!turHedefId || !turSoruId) return;
    let iptal = false;

    supabase
      .from('bilirmisin_profil')
      .select('cevap')
      .eq('couple_id', coupleId)
      .eq('user_id', turHedefId)
      .eq('soru_id', turSoruId)
      .maybeSingle()
      .then(({ data }) => { if (!iptal) setHedefCevap(data?.cevap ?? null); });

    return () => { iptal = true; };
  }, [coupleId, turHedefId, turSoruId]);

  /* ================= realtime ================= */

  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`bilirmisin:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bilirmisin_tur', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setTur(yeni))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bilirmisin_profil', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => {
          const guncelTur = turRef.current;
          if (guncelTur && yeni.user_id === guncelTur.hedef_id && yeni.soru_id === guncelTur.soru_id) {
            setHedefCevap(yeni.cevap);
          }
        })
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  /* ================= yeni tur algılama ================= */

  useEffect(() => {
    if (!tur) return;
    const anahtar = tur.soru_id + '|' + tur.hedef_id;
    if (anahtar === oncekiAnahtarRef.current) return;
    oncekiAnahtarRef.current = anahtar;
    setGirdiCevap('');
    setGirdiTahmin('');
    setHata(null);
  }, [tur]);

  /* ================= aksiyonlar ================= */

  async function yeniSoruBaslat() {
    setHata(null);
    if (uyeler.length !== 2) return;

    const soruSecim = SORULAR[Math.floor(Math.random() * SORULAR.length)];
    const hedefSecim = uyeler[Math.floor(Math.random() * uyeler.length)];

    const { data, error } = await supabase
      .from('bilirmisin_tur')
      .upsert({
        couple_id: coupleId,
        soru_id: soruSecim.id,
        hedef_id: hedefSecim.id,
        tahmin: null,
        tahmin_eden_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) { setHata('Soru başlatılamadı.'); return; }
    setTur(data);
  }

  async function cevabimiKaydet() {
    const cevap = girdiCevap.trim();
    if (!cevap) return;

    const { error } = await supabase
      .from('bilirmisin_profil')
      .upsert({
        couple_id: coupleId, user_id: user.id, soru_id: tur.soru_id,
        cevap, updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id,user_id,soru_id' });

    if (error) { setHata('Cevap kaydedilemedi.'); return; }
    setHedefCevap(cevap);
    setGirdiCevap('');
  }

  async function tahminiGonder() {
    const metin = girdiTahmin.trim();
    if (!metin) return;

    const { data, error } = await supabase
      .from('bilirmisin_tur')
      .update({ tahmin: metin, tahmin_eden_id: user.id, updated_at: new Date().toISOString() })
      .eq('couple_id', coupleId)
      .select()
      .single();

    if (error) { setHata('Tahmin gönderilemedi.'); return; }
    setTur(data);
    setGirdiTahmin('');
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
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">Bunu Bilir misin</p>
          <h1 className="text-headline-md text-on-surface">Partnerini ne kadar tanıyorsun?</h1>
        </div>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !tur && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz soru yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Rastgele biriniz hedef olur, diğeri onun hakkında tahmin eder.
          </p>
          <button onClick={yeniSoruBaslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Soru sor
          </button>
        </div>
      )}

      {tur && soru && (
        <>
          <div className="bg-surface-card rounded-xl p-space-lg shadow-sm">
            <p className="text-label-eyebrow text-primary uppercase tracking-widest">
              {benHedefMiyim ? 'Senin hakkında' : `${partner?.display_name || 'Partnerin'} hakkında`}
            </p>
            <h3 className="text-headline-sm text-on-surface mt-1">{soru.metin}</h3>
          </div>

          {benHedefMiyim && hedefCevap == null && (
            <div className="flex items-center gap-space-sm">
              <input
                placeholder="Gerçek cevabın…"
                value={girdiCevap}
                onChange={(e) => setGirdiCevap(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && cevabimiKaydet()}
                className="flex-1 h-11 px-space-md rounded-lg bg-surface-card text-on-surface outline-none shadow-sm"
              />
              <button onClick={cevabimiKaydet} className="px-space-lg h-11 rounded-lg bg-surface-soft text-primary text-label-button">
                Kaydet
              </button>
            </div>
          )}

          {!benHedefMiyim && hedefCevap == null && (
            <p className="text-body-sm text-text-muted">
              {partner?.display_name || 'Partnerin'} önce kendi cevabını versin, bekleniyor…
            </p>
          )}

          {!benHedefMiyim && hedefCevap != null && !tur.tahmin_eden_id && (
            <div className="flex items-center gap-space-sm">
              <input
                placeholder="Tahminin…"
                value={girdiTahmin}
                onChange={(e) => setGirdiTahmin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tahminiGonder()}
                className="flex-1 h-11 px-space-md rounded-lg bg-surface-card text-on-surface outline-none shadow-sm"
              />
              <button onClick={tahminiGonder} className="px-space-lg h-11 rounded-lg bg-surface-soft text-primary text-label-button">
                Tahmin et
              </button>
            </div>
          )}

          {benHedefMiyim && hedefCevap != null && !tur.tahmin_eden_id && (
            <p className="text-body-sm text-text-muted">
              {partner?.display_name || 'Partnerin'} tahmin ediyor…
            </p>
          )}

          {ifsaEdildi && (
            <div className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-xs">
              <p className="text-text-faint text-body-sm">
                <strong className="text-on-surface-variant">
                  {tur.tahmin_eden_id === user.id ? 'Tahminin' : `${partner?.display_name || 'Partnerin'}'in tahmini`}:
                </strong>{' '}
                {tur.tahmin}
              </p>
              <p className="text-on-surface">
                <strong>Gerçek cevap:</strong> {hedefCevap}
              </p>
            </div>
          )}

          {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}

          {ifsaEdildi && (
            <div className="text-center">
              <button onClick={yeniSoruBaslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
                Yeni soru
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
