import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconPlus, IconTrash, IconClose } from '../../components/Icons';

/* Kartlara sıcak ama sessiz bir zemin ver — yazar ve sıraya göre değişsin,
   böylece pano tek düze görünmesin ama gürültü de olmasın. */
const ZEMINLER = ['#FFFFFF', '#FFF3F4', '#FFF8EC', '#F2F9F3'];

export default function NotesPage() {
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const [notlar, setNotlar]       = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata]           = useState(null);
  const [yaziyor, setYaziyor]     = useState(false);
  const [metin, setMetin]         = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const isimler = {};
  uyeler.forEach((u) => { isimler[u.id] = u.display_name || 'İsimsiz'; });

  /* ---------- yükle + canlı dinle ---------- */
  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('notes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Notlar yüklenemedi. Bağlantını kontrol et.');
        else setNotlar(data ?? []);
        setYukleniyor(false);
      });

    const kanal = supabase
      .channel(`notlar:${coupleId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) =>
          setNotlar((e) => (e.some((n) => n.id === yeni.id) ? e : [yeni, ...e])))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notes', filter: `couple_id=eq.${coupleId}` },
        ({ old }) => setNotlar((e) => e.filter((n) => n.id !== old.id)))
      .subscribe();

    return () => { iptal = true; supabase.removeChannel(kanal); };
  }, [coupleId]);

  /* ---------- yaz ---------- */
  async function gonder() {
    const temiz = metin.trim();
    if (!temiz) return;

    setGonderiliyor(true);
    setHata(null);

    const { data, error } = await supabase
      .from('notes')
      .insert({ couple_id: coupleId, author_id: user.id, body: temiz })
      .select()
      .single();

    setGonderiliyor(false);

    if (error) {
      setHata('Not kaydedilemedi. Tekrar dene.');
      return;
    }

    setNotlar((e) => (e.some((n) => n.id === data.id) ? e : [data, ...e]));
    setMetin('');
    setYaziyor(false);
  }

  async function sil(id) {
    setNotlar((e) => e.filter((n) => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) setHata('Not silinemedi.');
  }

  const tarih = (iso) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  return (
    <>
      <header className="stack-2" style={{ marginBottom: 'var(--s5)' }}>
        <p className="eyebrow">Notlar</p>
        <h1>Pano</h1>
        <p className="muted">
          {notlar.length > 0
            ? `${notlar.length} not · ${partner?.display_name || 'Partnerin'} ile ortak`
            : 'Buraya bıraktığınız her şey ikinizde de görünür.'}
        </p>
      </header>

      {hata && (
        <div className="card card--flat" style={{ marginBottom: 'var(--s4)', color: 'var(--primary)' }}>
          {hata}
        </div>
      )}

      {yukleniyor ? (
        <p className="muted">Yükleniyor…</p>
      ) : notlar.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
          <h3>Pano boş</h3>
          <p className="muted" style={{ marginTop: 'var(--s2)' }}>
            Sağ alttaki butondan ilk notu ekle.
          </p>
        </div>
      ) : (
        /* Masonry — CSS columns ile, kartlar kendi yüksekliğinde akar */
        <div style={{ columnCount: 2, columnGap: 'var(--s3)' }}>
          {notlar.map((n, i) => {
            const benim = n.author_id === user.id;
            return (
              <article
                key={n.id}
                className="card"
                style={{
                  background: ZEMINLER[i % ZEMINLER.length],
                  padding: 'var(--s4)',
                  marginBottom: 'var(--s3)',
                  breakInside: 'avoid',
                  display: 'inline-block',
                  width: '100%',
                  animation: 'rise 0.4s var(--ease) both',
                  animationDelay: `${Math.min(i, 8) * 30}ms`,
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'pre-wrap', letterSpacing: '-0.005em' }}>
                  {n.body}
                </p>

                <div className="row" style={{ marginTop: 'var(--s3)', gap: 'var(--s2)' }}>
                  <span className="faint" style={{ fontSize: 12 }}>
                    {benim ? 'Sen' : isimler[n.author_id] || 'Partner'} · {tarih(n.created_at)}
                  </span>
                  <div className="spacer" />
                  {benim && (
                    <button
                      onClick={() => sil(n.id)}
                      aria-label="Notu sil"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-faint)', padding: 2, display: 'grid',
                      }}
                    >
                      <IconTrash style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ---------- FAB ---------- */}
      <button className="fab" onClick={() => setYaziyor(true)} aria-label="Not ekle">
        <IconPlus />
      </button>

      {/* ---------- Yazma sayfası ---------- */}
      {yaziyor && (
        <div className="sheet-backdrop" onClick={() => setYaziyor(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 'var(--s4)' }}>
              <h2>Yeni not</h2>
              <div className="spacer" />
              <button
                onClick={() => setYaziyor(false)}
                aria-label="Kapat"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', display: 'grid' }}
              >
                <IconClose />
              </button>
            </div>

            <textarea
              autoFocus
              rows={5}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              placeholder="Aklından ne geçiyor?"
              style={{ resize: 'none', lineHeight: 1.6 }}
            />

            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 'var(--s4)' }}
              onClick={gonder}
              disabled={gonderiliyor || !metin.trim()}
            >
              {gonderiliyor ? 'Ekleniyor…' : 'Panoya ekle'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}