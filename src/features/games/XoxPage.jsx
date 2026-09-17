import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconBack } from '../../components/Icons';

const BOS_TAHTA = [null, null, null, null, null, null, null, null, null];

const HATLAR = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function sonucBul(tahta) {
  for (const [a, b, c] of HATLAR) {
    if (tahta[a] && tahta[a] === tahta[b] && tahta[a] === tahta[c]) return tahta[a];
  }
  return tahta.every(Boolean) ? 'berabere' : null;
}

export default function XoxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, partner } = useCouple();

  const [oyun, setOyun] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('xox_games')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Oyun yüklenemedi. Sayfayı yenile.');
        else setOyun(data);
        setYukleniyor(false);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`xox:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'xox_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  const baslat = useCallback(async () => {
    setHata(null);
    const { data, error } = await supabase
      .from('xox_games')
      .upsert({
        couple_id: coupleId,
        board: BOS_TAHTA,
        x_user_id: user.id,
        sira: user.id,
        kazanan: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Oyun başlatılamadı.');
    else setOyun(data);
  }, [coupleId, user]);

  async function hamleYap(i) {
    if (!oyun || oyun.kazanan) return;
    if (oyun.sira !== user.id) return;
    if (oyun.board[i]) return;

    const benimIsaret = oyun.x_user_id === user.id ? 'X' : 'O';
    const yeniTahta = oyun.board.slice();
    yeniTahta[i] = benimIsaret;

    const kazanan = sonucBul(yeniTahta);
    const guncel = {
      board: yeniTahta,
      kazanan,
      sira: kazanan ? null : partner?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    setOyun((o) => ({ ...o, ...guncel }));

    const { error } = await supabase
      .from('xox_games')
      .update(guncel)
      .eq('couple_id', coupleId);

    if (error) setHata('Hamle kaydedilemedi.');
  }

  const benimIsaret = oyun && oyun.x_user_id === user.id ? 'X' : 'O';
  const sıraBende = oyun && !oyun.kazanan && oyun.sira === user.id;

  let durumMetni = '';
  if (oyun?.kazanan === 'berabere') durumMetni = 'Berabere.';
  else if (oyun?.kazanan === benimIsaret) durumMetni = 'Kazandın!';
  else if (oyun?.kazanan) durumMetni = `${partner?.display_name || 'Partnerin'} kazandı.`;
  else if (sıraBende) durumMetni = 'Sıra sende.';
  else if (oyun) durumMetni = `${partner?.display_name || 'Partnerin'} oynuyor.`;

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
          <p className="eyebrow">XOX</p>
          <h1>Üç taşı</h1>
        </div>
      </header>

      {yukleniyor && <p className="muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
          <h3>Henüz oyun yok</h3>
          <p className="muted" style={{ marginTop: 'var(--s2)', marginBottom: 'var(--s4)' }}>
            Başlatan kişi X olur, ilk hamle onundur.
          </p>
          <button className="btn btn--primary" onClick={baslat}>Oyunu başlat</button>
        </div>
      )}

      {oyun && (
        <>
          <p className="muted" style={{ marginBottom: 'var(--s4)' }}>{durumMetni}</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--s2)',
              maxWidth: 360,
              margin: '0 auto',
            }}
          >
            {oyun.board.map((deger, i) => (
              <button
                key={i}
                className="card card-tap"
                onClick={() => hamleYap(i)}
                disabled={!sıraBende || !!deger}
                style={{
                  aspectRatio: '1 / 1',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 32,
                  fontWeight: 800,
                  color: deger === 'X' ? 'var(--primary)' : 'var(--accent)',
                  cursor: sıraBende && !deger ? 'pointer' : 'default',
                }}
              >
                {deger}
              </button>
            ))}
          </div>

          {oyun.kazanan && (
            <div style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
              <button className="btn btn--primary" onClick={baslat}>Yeniden başlat</button>
            </div>
          )}
        </>
      )}

      {hata && (
        <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 'var(--s4)' }}>
          {hata}
        </p>
      )}
    </>
  );
}
