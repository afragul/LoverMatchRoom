import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const SUTUN = 7;
const SATIR = 6;
const KIRMIZI_HEX = '#E31E24';
const SARI_HEX = '#FFC800';
const TAHTA_HEX = '#0B4DA6';

function bosTahta() { return Array(SUTUN * SATIR).fill(null); }

function sonucBul(tahta) {
  const al = (r, c) => (r < 0 || r >= SATIR || c < 0 || c >= SUTUN ? null : tahta[r * SUTUN + c]);
  for (let r = 0; r < SATIR; r++) {
    for (let c = 0; c < SUTUN; c++) {
      const v = al(r, c);
      if (!v) continue;
      if (v === al(r, c + 1) && v === al(r, c + 2) && v === al(r, c + 3)) return v;
      if (v === al(r + 1, c) && v === al(r + 2, c) && v === al(r + 3, c)) return v;
      if (v === al(r + 1, c + 1) && v === al(r + 2, c + 2) && v === al(r + 3, c + 3)) return v;
      if (v === al(r + 1, c - 1) && v === al(r + 2, c - 2) && v === al(r + 3, c - 3)) return v;
    }
  }
  return tahta.every(Boolean) ? 'berabere' : null;
}

export default function Connect4Page() {
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
      .from('connect4_games')
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
      .channel(`connect4:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'connect4_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  const baslat = useCallback(async () => {
    setHata(null);
    const { data, error } = await supabase
      .from('connect4_games')
      .upsert({
        couple_id: coupleId,
        board: bosTahta(),
        kirmizi_id: user.id,
        sira: user.id,
        kazanan: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Oyun başlatılamadı.');
    else setOyun(data);
  }, [coupleId, user]);

  async function hamleYap(sutun) {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;

    let hedefSatir = -1;
    for (let r = SATIR - 1; r >= 0; r--) {
      if (!oyun.board[r * SUTUN + sutun]) { hedefSatir = r; break; }
    }
    if (hedefSatir === -1) return;

    const benimRenk = oyun.kirmizi_id === user.id ? 'kirmizi' : 'sari';
    const yeniTahta = oyun.board.slice();
    yeniTahta[hedefSatir * SUTUN + sutun] = benimRenk;

    const sonuc = sonucBul(yeniTahta);
    const guncel = {
      board: yeniTahta,
      kazanan: sonuc,
      sira: sonuc ? null : (partner?.id ?? null),
      updated_at: new Date().toISOString(),
    };

    setOyun((o) => ({ ...o, ...guncel }));

    const { error } = await supabase
      .from('connect4_games')
      .update(guncel)
      .eq('couple_id', coupleId);

    if (error) { setHata('Hamle kaydedilemedi.'); return; }

    if (sonuc) {
      const kazananId = sonuc === 'berabere' ? null : (sonuc === benimRenk ? user.id : partner?.id);
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'connect4', kazanan_id: kazananId });
    }
  }

  const benimRenk = oyun ? (oyun.kirmizi_id === user.id ? 'kirmizi' : 'sari') : null;
  const benimRenkHex = benimRenk === 'kirmizi' ? KIRMIZI_HEX : SARI_HEX;
  const benimSiramMi = !!(oyun && !oyun.kazanan && oyun.sira === user.id);

  let durumMetni = '';
  if (oyun?.kazanan === 'berabere') durumMetni = 'Berabere.';
  else if (oyun?.kazanan === benimRenk) durumMetni = 'Kazandın!';
  else if (oyun?.kazanan) durumMetni = `${partner?.display_name || 'Partnerin'} kazandı.`;
  else if (benimSiramMi) durumMetni = 'Sıra sende.';
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
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Dört Taş</p>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz oyun yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Sırayla sütuna taş bırak, önce 4'lü sıra yapan kazanır. Başlatan kırmızı olur.
          </p>
          <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Oyunu başlat
          </button>
        </div>
      )}

      {oyun && (
        <>
          <p className="text-body-sm text-text-muted text-center">{durumMetni}</p>

          <div className="mx-auto w-full max-w-[340px]">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {Array.from({ length: SUTUN }).map((_, c) => {
                const dolu = !!oyun.board[c];
                return (
                  <button
                    key={c}
                    onClick={() => hamleYap(c)}
                    disabled={!benimSiramMi || dolu}
                    aria-label={`${c + 1}. sütuna taş bırak`}
                    className="h-6 flex items-center justify-center disabled:opacity-15 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: benimRenkHex }}>
                      arrow_downward
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-7 gap-1.5 p-2 rounded-2xl shadow-md" style={{ background: TAHTA_HEX }}>
              {oyun.board.map((deger, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-full"
                  style={{
                    background: deger === 'kirmizi' ? KIRMIZI_HEX : deger === 'sari' ? SARI_HEX : 'rgba(255,255,255,0.9)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.25)',
                  }}
                />
              ))}
            </div>
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
