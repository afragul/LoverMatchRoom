import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

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

    if (error) { setHata('Hamle kaydedilemedi.'); return; }

    if (kazanan) {
      const kazananId = kazanan === 'berabere' ? null : (kazanan === benimIsaret ? user.id : partner?.id);
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'xox', kazanan_id: kazananId });
    }
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
      <header className="flex items-center gap-space-sm">
        <button
          onClick={() => navigate('/oyunlar')}
          aria-label="Oyunlara dön"
          className="w-10 h-10 rounded-full bg-surface-card shadow-sm flex items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">XOX</p>
          <h1 className="text-headline-md text-on-surface">Üç taşı</h1>
        </div>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz oyun yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Başlatan kişi X olur, ilk hamle onundur.
          </p>
          <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Oyunu başlat
          </button>
        </div>
      )}

      {oyun && (
        <>
          <p className="text-body-sm text-text-muted">{durumMetni}</p>

          <div className="grid grid-cols-3 gap-space-sm max-w-[320px] mx-auto w-full">
            {oyun.board.map((deger, i) => (
              <button
                key={i}
                onClick={() => hamleYap(i)}
                disabled={!sıraBende || !!deger}
                className="aspect-square rounded-xl bg-surface-card shadow-sm grid place-items-center text-[32px] font-extrabold"
                style={{ color: deger === 'X' ? 'var(--color-primary)' : 'var(--color-tertiary)' }}
              >
                {deger}
              </button>
            ))}
          </div>

          {oyun.kazanan && (
            <div className="text-center">
              <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
                Yeniden başlat
              </button>
            </div>
          )}
        </>
      )}

      {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}
    </>
  );
}
