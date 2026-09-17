import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconBack, IconCheck } from '../../components/Icons';

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
          <p className="eyebrow">Bunu Bilir misin</p>
          <h1>Partnerini ne kadar tanıyorsun?</h1>
        </div>
      </header>

      {yukleniyor && <p className="muted">Yükleniyor…</p>}

      {!yukleniyor && !tur && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
          <h3>Henüz soru yok</h3>
          <p className="muted" style={{ marginTop: 'var(--s2)', marginBottom: 'var(--s4)' }}>
            Rastgele biriniz hedef olur, diğeri onun hakkında tahmin eder.
          </p>
          <button className="btn btn--primary" onClick={yeniSoruBaslat}>Soru sor</button>
        </div>
      )}

      {tur && soru && (
        <>
          <div className="card" style={{ padding: 'var(--s5)', marginBottom: 'var(--s4)' }}>
            <p className="eyebrow">
              {benHedefMiyim ? 'Senin hakkında' : `${partner?.display_name || 'Partnerin'} hakkında`}
            </p>
            <h3>{soru.metin}</h3>
          </div>

          {/* ---- Hedef, henüz cevaplamamış ---- */}
          {benHedefMiyim && hedefCevap == null && (
            <div className="row" style={{ gap: 'var(--s2)' }}>
              <input
                placeholder="Gerçek cevabın…"
                value={girdiCevap}
                onChange={(e) => setGirdiCevap(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && cevabimiKaydet()}
                style={{ flex: 1 }}
              />
              <button className="btn btn--soft" onClick={cevabimiKaydet}>Kaydet</button>
            </div>
          )}

          {/* ---- Tahmin eden, hedef henüz cevaplamamışsa bekliyor ---- */}
          {!benHedefMiyim && hedefCevap == null && (
            <p className="muted">
              {partner?.display_name || 'Partnerin'} önce kendi cevabını versin, bekleniyor…
            </p>
          )}

          {/* ---- Tahmin eden, cevap var ve henüz tahmin etmemiş ---- */}
          {!benHedefMiyim && hedefCevap != null && !tur.tahmin_eden_id && (
            <div className="row" style={{ gap: 'var(--s2)' }}>
              <input
                placeholder="Tahminin…"
                value={girdiTahmin}
                onChange={(e) => setGirdiTahmin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tahminiGonder()}
                style={{ flex: 1 }}
              />
              <button className="btn btn--soft" onClick={tahminiGonder}>Tahmin et</button>
            </div>
          )}

          {/* ---- Hedef, cevap var ama partner henüz tahmin etmemiş ---- */}
          {benHedefMiyim && hedefCevap != null && !tur.tahmin_eden_id && (
            <p className="muted">
              {partner?.display_name || 'Partnerin'} tahmin ediyor…
            </p>
          )}

          {/* ---- İfşa ---- */}
          {ifsaEdildi && (
            <div className="card" style={{ padding: 'var(--s5)', marginTop: 'var(--s3)' }}>
              <p className="faint" style={{ marginBottom: 'var(--s2)' }}>
                <strong>{tur.tahmin_eden_id === user.id ? 'Tahminin' : `${partner?.display_name || 'Partnerin'}'in tahmini`}:</strong>{' '}
                {tur.tahmin}
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCheck style={{ width: 16, height: 16, color: 'var(--green)' }} />
                <strong>Gerçek cevap:</strong> {hedefCevap}
              </p>
              <p className="faint" style={{ marginTop: 'var(--s2)' }}>
                Doğru bilip bilmediğine siz karar verin.
              </p>
            </div>
          )}

          {hata && (
            <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 'var(--s3)' }}>
              {hata}
            </p>
          )}

          {ifsaEdildi && (
            <div style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
              <button className="btn btn--primary" onClick={yeniSoruBaslat}>Yeni soru</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
