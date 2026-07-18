import { useCouple } from '../../context/CoupleContext';

const OYUNLAR = [
  {
    ad: 'XOX',
    alt: 'Üç taşı yan yana getir',
    isaret: '⌗',
    ton: 'var(--soft-pink)',
    hazir: false,
  },
  {
    ad: 'Kelime Düellosu',
    alt: 'Aynı harflerden kim daha çok kelime çıkarır',
    isaret: 'Aa',
    ton: 'var(--accent)',
    hazir: false,
  },
  {
    ad: 'Çiz ve Tahmin Et',
    alt: 'Biri çizer, diğeri bilir',
    isaret: '✎',
    ton: 'var(--mint)',
    hazir: false,
  },
  {
    ad: 'Bunu Bilir misin',
    alt: 'Partnerin hakkında sorular',
    isaret: '?',
    ton: 'var(--surface-soft)',
    hazir: false,
  },
];

export default function GamesPage() {
  const { partnerAktif, partner } = useCouple();

  return (
    <>
      <header className="stack-2" style={{ marginBottom: 'var(--s5)' }}>
        <p className="eyebrow">Oyunlar</p>
        <h1>Sıra sende</h1>
        <p className="muted">
          {partnerAktif
            ? `${partner?.display_name || 'Partnerin'} şu an burada. İyi zamanlama.`
            : 'Hepsi sıra tabanlı. Aynı anda burada olmanız gerekmiyor.'}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
        {OYUNLAR.map((o) => (
          <button
            key={o.ad}
            className="card card-tap"
            disabled={!o.hazir}
            style={{
              padding: 'var(--s4)',
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              opacity: o.hazir ? 1 : 0.72,
              cursor: o.hazir ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                width: 44, height: 44, borderRadius: 'var(--r-sm)',
                background: o.ton, color: 'var(--brown)',
                display: 'grid', placeItems: 'center',
                fontSize: 19, fontWeight: 700,
                marginBottom: 'var(--s3)',
              }}
            >
              {o.isaret}
            </div>

            <h3>{o.ad}</h3>
            <p className="faint" style={{ marginTop: 2, flex: 1 }}>{o.alt}</p>

            {!o.hazir && (
              <span className="badge badge--away" style={{ marginTop: 'var(--s2)' }}>
                Yakında
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card card--flat" style={{ marginTop: 'var(--s5)' }}>
        <h3>Oyunlar hazırlanıyor</h3>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Tahta ve sıra bilgisi ikinizde anlık eşitlenecek. İlk olarak XOX geliyor.
        </p>
      </div>
    </>
  );
}