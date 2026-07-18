import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { Bond } from '../../components/Bond';
import { IconNote, IconGame, IconBrush } from '../../components/Icons';

export default function RoomPage() {
  const { signOut } = useAuth();
  const {
    coupleId, isimler, odaAdi, odaIsmi, odaIsmiKaydet,
    baslangic, baslangicKaydet, gunSayisi, partnerAktif, partner,
  } = useCouple();

  const [istatistik, setIstatistik] = useState({ not: 0 });
  const [duzenle, setDuzenle] = useState(false);
  const [taslakIsim, setTaslakIsim] = useState('');
  const [taslakTarih, setTaslakTarih] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (!coupleId) return;
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .then(({ count }) => setIstatistik({ not: count ?? 0 }));
  }, [coupleId]);

  function duzenlemeyiAc() {
    setTaslakIsim(odaIsmi ?? '');
    setTaslakTarih(baslangic ? new Date(baslangic).toISOString().slice(0, 10) : '');
    setDuzenle(true);
  }

  async function kaydet() {
    setKaydediliyor(true);
    await odaIsmiKaydet(taslakIsim);
    await baslangicKaydet(taslakTarih || null);
    setKaydediliyor(false);
    setDuzenle(false);
  }

  return (
    <>
      {/* ---------- Bağ ---------- */}
      <section
        className="card"
        style={{
          textAlign: 'center',
          padding: 'var(--s7) var(--s5) var(--s5)',
          marginBottom: 'var(--s4)',
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 'var(--s5)' }}>
          <Bond isimler={isimler} boyut={80} canli={partnerAktif} />
        </div>

        <h1 style={{ fontSize: 24 }}>{odaAdi}</h1>

        <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s3)' }}>
          <span className={'badge ' + (partnerAktif ? 'badge--live' : 'badge--away')}>
            <span className="dot" />
            {partnerAktif
              ? `${partner?.display_name || 'Partnerin'} şu an burada`
              : 'Şu an sen buradasın'}
          </span>
        </div>

        <button className="btn btn--soft btn--sm" style={{ marginTop: 'var(--s4)' }} onClick={duzenlemeyiAc}>
          Odayı düzenle
        </button>
      </section>

      {/* ---------- İstatistikler ---------- */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
        <Kutu
          deger={gunSayisi !== null ? gunSayisi : '—'}
          etiket="birlikte geçen gün"
          ton="var(--accent)"
        />
        <Kutu
          deger={istatistik.not}
          etiket="bırakılan not"
          ton="var(--soft-pink)"
        />
      </section>

      {baslangic === null && (
        <div className="card card--flat" style={{ marginBottom: 'var(--s4)' }}>
          <h3>Başlangıç tarihi eksik</h3>
          <p className="muted" style={{ marginTop: 'var(--s2)' }}>
            Gün sayacının doğru çalışması için tarihi girin.
          </p>
          <button className="btn btn--soft btn--sm" style={{ marginTop: 'var(--s3)' }} onClick={duzenlemeyiAc}>
            Tarihi gir
          </button>
        </div>
      )}

      {/* ---------- Geçişler ---------- */}
      <section className="stack-2" style={{ marginBottom: 'var(--s5)' }}>
        <p className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>Buradan git</p>
        <Gecis yol="/notlar"  ad="Notlar"       alt={`${istatistik.not} not`} Ikon={IconNote}  ton="var(--soft-pink)" />
        <Gecis yol="/ciz"     ad="Birlikte Çiz" alt="Ortak tuval"             Ikon={IconBrush} ton="var(--mint)" />
        <Gecis yol="/oyunlar" ad="Oyunlar"      alt="Sıra tabanlı"            Ikon={IconGame}  ton="var(--accent)" />
      </section>

      <button className="btn btn--ghost" onClick={signOut} style={{ marginBottom: 'var(--s5)' }}>
        Çıkış yap
      </button>

      {/* ---------- Düzenleme ---------- */}
      {duzenle && (
        <div className="sheet-backdrop" onClick={() => setDuzenle(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 'var(--s5)' }}>Odayı düzenle</h2>

            <label className="eyebrow">Oda adı</label>
            <input
              value={taslakIsim}
              onChange={(e) => setTaslakIsim(e.target.value)}
              placeholder={isimler.join(' & ')}
              style={{ marginTop: 'var(--s2)', marginBottom: 'var(--s4)' }}
            />

            <label className="eyebrow">Başlangıç tarihi</label>
            <input
              type="date"
              value={taslakTarih}
              onChange={(e) => setTaslakTarih(e.target.value)}
              style={{ marginTop: 'var(--s2)' }}
            />
            <p className="faint" style={{ marginTop: 'var(--s2)' }}>
              Gün sayacı bu tarihten itibaren sayar.
            </p>

            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 'var(--s5)' }}
              onClick={kaydet}
              disabled={kaydediliyor}
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              className="btn btn--ghost btn--block"
              style={{ marginTop: 'var(--s2)' }}
              onClick={() => setDuzenle(false)}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Kutu({ deger, etiket, ton }) {
  return (
    <div className="card" style={{ padding: 'var(--s4)' }}>
      <div style={{ width: 28, height: 4, borderRadius: 999, background: ton, marginBottom: 'var(--s3)' }} />
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {deger}
      </div>
      <p className="faint" style={{ marginTop: 6 }}>{etiket}</p>
    </div>
  );
}

function Gecis({ yol, ad, alt, Ikon, ton }) {
  return (
    <Link
      to={yol}
      className="card card-tap"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s4)',
        padding: 'var(--s4)', textDecoration: 'none', color: 'inherit',
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 'var(--r-sm)',
          background: ton, color: 'var(--brown)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Ikon />
      </div>
      <div style={{ flex: 1 }}>
        <h3>{ad}</h3>
        <p className="faint">{alt}</p>
      </div>
      <span className="faint">→</span>
    </Link>
  );
}