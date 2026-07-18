import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCouple } from '../../context/CoupleContext';
import { useAuth } from '../../context/AuthContext';
import { Bond } from '../../components/Bond';
import { IconNote, IconGame, IconBrush, IconArchive } from '../../components/Icons';

function selamla() {
  const s = new Date().getHours();
  if (s < 6)  return 'İyi geceler';
  if (s < 12) return 'Günaydın';
  if (s < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

const BOLUMLER = [
  { yol: '/notlar',  ad: 'Notlar',       alt: 'Birbirinize bıraktıklarınız', Ikon: IconNote,    ton: 'var(--soft-pink)' },
  { yol: '/oyunlar', ad: 'Oyunlar',      alt: 'Sıra tabanlı, iki kişilik',   Ikon: IconGame,    ton: 'var(--accent)' },
  { yol: '/ciz',     ad: 'Birlikte Çiz', alt: 'Aynı tuval, iki fırça',       Ikon: IconBrush,   ton: 'var(--mint)' },
  { yol: '/anilar',  ad: 'Anılar',       alt: 'Sakladığınız anlar',          Ikon: IconArchive, ton: 'var(--surface-soft)' },
];

export default function HomePage() {
  const { user } = useAuth();
  const { coupleId, isimler, gunSayisi, partnerAktif, partner } = useCouple();
  const [sonNot, setSonNot] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('notes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (iptal) return;
        setSonNot(data ?? null);
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  const notBenim = sonNot?.author_id === user?.id;

  return (
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      {/* ---------- Karşılama ---------- */}
      <header className="stack-2">
        <p className="eyebrow">{selamla()}</p>
        <h1>{isimler.join(' & ')}</h1>

        <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s1)' }}>
          {gunSayisi !== null && (
            <span className="badge badge--gold">{gunSayisi}. gün</span>
          )}
          <span className={'badge ' + (partnerAktif ? 'badge--live' : 'badge--away')}>
            <span className="dot" />
            {partnerAktif
              ? `${partner?.display_name || 'Partnerin'} burada`
              : 'Şu an burada değil'}
          </span>
        </div>
      </header>

      {/* ---------- Bugünün Notu ---------- */}
      <Link to="/notlar" className="card card-tap" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
        <div className="row" style={{ marginBottom: 'var(--s3)' }}>
          <span className="eyebrow">Bugünün notu</span>
          <div className="spacer" />
          <span className="faint">Tümü →</span>
        </div>

        {yukleniyor ? (
          <p className="muted">Yükleniyor…</p>
        ) : sonNot ? (
          <>
            <p style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.45, letterSpacing: '-0.01em' }}>
              {sonNot.body.length > 160 ? sonNot.body.slice(0, 160) + '…' : sonNot.body}
            </p>
            <p className="faint" style={{ marginTop: 'var(--s3)' }}>
              {notBenim ? 'Sen yazdın' : `${partner?.display_name || 'Partnerin'} yazdı`}
              {' · '}
              {new Date(sonNot.created_at).toLocaleDateString('tr-TR', {
                day: 'numeric', month: 'long',
              })}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 18, fontWeight: 600 }}>Burası henüz boş.</p>
            <p className="muted" style={{ marginTop: 4 }}>
              İlk notu yazın, buraya gelsin.
            </p>
          </>
        )}
      </Link>

      {/* ---------- Bölümler ---------- */}
      <section className="stack-2">
        <p className="eyebrow" style={{ marginBottom: 'var(--s1)' }}>Alanlarınız</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
          {BOLUMLER.map(({ yol, ad, alt, Ikon, ton }) => (
            <Link
              key={yol}
              to={yol}
              className="card card-tap"
              style={{
                padding: 'var(--s4)',
                textDecoration: 'none',
                color: 'inherit',
                minHeight: 132,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: 'var(--r-sm)',
                  background: ton, color: 'var(--brown)',
                  display: 'grid', placeItems: 'center',
                  marginBottom: 'var(--s3)',
                }}
              >
                <Ikon />
              </div>
              <h3>{ad}</h3>
              <p className="faint" style={{ marginTop: 2 }}>{alt}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Oda kısayolu ---------- */}
      <Link
        to="/oda"
        className="card card-tap"
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}
      >
        <Bond isimler={isimler} boyut={44} canli={partnerAktif} />
        <div style={{ marginLeft: 'var(--s3)' }}>
          <h3>Odanız</h3>
          <p className="faint">Ayarlar ve istatistikler</p>
        </div>
      </Link>
    </div>
  );
}