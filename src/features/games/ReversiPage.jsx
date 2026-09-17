import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const BOYUT = 8;
const SIYAH_HEX = '#1A1A1A';
const BEYAZ_HEX = '#FFFFFF';
const TAHTA_HEX = '#0E7A43';

const YONLER = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function baslangicTahtasi() {
  const tahta = Array(BOYUT * BOYUT).fill(null);
  tahta[3 * BOYUT + 3] = 'beyaz';
  tahta[3 * BOYUT + 4] = 'siyah';
  tahta[4 * BOYUT + 3] = 'siyah';
  tahta[4 * BOYUT + 4] = 'beyaz';
  return tahta;
}

function ceviler(tahta, r, c, renk) {
  if (tahta[r * BOYUT + c]) return [];
  const rakip = renk === 'siyah' ? 'beyaz' : 'siyah';
  const sonuc = [];
  for (const [dr, dc] of YONLER) {
    const aday = [];
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < BOYUT && cc >= 0 && cc < BOYUT && tahta[rr * BOYUT + cc] === rakip) {
      aday.push(rr * BOYUT + cc);
      rr += dr; cc += dc;
    }
    if (aday.length > 0 && rr >= 0 && rr < BOYUT && cc >= 0 && cc < BOYUT && tahta[rr * BOYUT + cc] === renk) {
      sonuc.push(...aday);
    }
  }
  return sonuc;
}

function gecerliHamleler(tahta, renk) {
  const hamleler = [];
  for (let i = 0; i < tahta.length; i++) {
    if (!tahta[i] && ceviler(tahta, Math.floor(i / BOYUT), i % BOYUT, renk).length > 0) hamleler.push(i);
  }
  return hamleler;
}

export default function ReversiPage() {
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
      .from('reversi_games')
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
      .channel(`reversi:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reversi_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  const baslat = useCallback(async () => {
    setHata(null);
    const { data, error } = await supabase
      .from('reversi_games')
      .upsert({
        couple_id: coupleId,
        board: baslangicTahtasi(),
        siyah_id: user.id,
        sira: user.id,
        kazanan: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Oyun başlatılamadı.');
    else setOyun(data);
  }, [coupleId, user]);

  async function hamleYap(index) {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;
    const benimRenk = oyun.siyah_id === user.id ? 'siyah' : 'beyaz';
    const r = Math.floor(index / BOYUT), c = index % BOYUT;
    const donecekler = ceviler(oyun.board, r, c, benimRenk);
    if (donecekler.length === 0) return;

    const yeniTahta = oyun.board.slice();
    yeniTahta[index] = benimRenk;
    donecekler.forEach((i) => { yeniTahta[i] = benimRenk; });

    const rakipRenk = benimRenk === 'siyah' ? 'beyaz' : 'siyah';
    const beyazId = oyun.siyah_id === user.id ? partner?.id : user.id;

    let siradaki;
    let kazanan = null;
    if (gecerliHamleler(yeniTahta, rakipRenk).length > 0) {
      siradaki = benimRenk === 'siyah' ? beyazId : oyun.siyah_id;
    } else if (gecerliHamleler(yeniTahta, benimRenk).length > 0) {
      siradaki = user.id;
    } else {
      siradaki = null;
      const siyahSayi = yeniTahta.filter((v) => v === 'siyah').length;
      const beyazSayi = yeniTahta.filter((v) => v === 'beyaz').length;
      kazanan = siyahSayi === beyazSayi ? 'berabere' : (siyahSayi > beyazSayi ? oyun.siyah_id : beyazId);
    }

    const guncel = { board: yeniTahta, sira: siradaki, kazanan, updated_at: new Date().toISOString() };
    setOyun((o) => ({ ...o, ...guncel }));

    const { error } = await supabase
      .from('reversi_games')
      .update(guncel)
      .eq('couple_id', coupleId);

    if (error) { setHata('Hamle kaydedilemedi.'); return; }

    if (kazanan) {
      const kazananId = kazanan === 'berabere' ? null : kazanan;
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'reversi', kazanan_id: kazananId });
    }
  }

  const benimRenk = oyun ? (oyun.siyah_id === user.id ? 'siyah' : 'beyaz') : null;
  const benimSiramMi = !!(oyun && !oyun.kazanan && oyun.sira === user.id);

  const gecerliHucreler = useMemo(() => {
    if (!benimSiramMi || !oyun) return new Set();
    return new Set(gecerliHamleler(oyun.board, benimRenk));
  }, [oyun, benimSiramMi, benimRenk]);

  const siyahSayi = oyun?.board?.filter((v) => v === 'siyah').length ?? 0;
  const beyazSayi = oyun?.board?.filter((v) => v === 'beyaz').length ?? 0;
  const benimSayi = benimRenk === 'siyah' ? siyahSayi : beyazSayi;
  const partnerSayi = benimRenk === 'siyah' ? beyazSayi : siyahSayi;

  let durumMetni = '';
  if (oyun?.kazanan === 'berabere') durumMetni = 'Berabere.';
  else if (oyun?.kazanan === user.id) durumMetni = 'Kazandın!';
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
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Revers</p>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz oyun yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Rakip taşları arana alıp kendi rengine çevir. Tahta dolduğunda en çok taşı olan kazanır.
            Başlatan siyah olur, ilk hamle onundur.
          </p>
          <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Oyunu başlat
          </button>
        </div>
      )}

      {oyun && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <span className="text-headline-sm text-on-surface">Sen</span>
              <span className="text-label-tab text-text-muted">{benimSayi} taş</span>
            </div>
            <span className="text-body-sm text-text-muted text-center flex-1">{durumMetni}</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-headline-sm text-primary">{partner?.display_name || 'Partnerin'}</span>
              <span className="text-label-tab text-primary font-bold">{partnerSayi} taş</span>
            </div>
          </div>

          <div
            className="mx-auto grid w-full max-w-[336px] aspect-square gap-[2px] p-1.5 rounded-xl shadow-md"
            style={{ background: TAHTA_HEX, gridTemplateColumns: `repeat(${BOYUT}, 1fr)` }}
          >
            {oyun.board.map((deger, i) => {
              const gecerliMi = gecerliHucreler.has(i);
              return (
                <button
                  key={i}
                  onClick={() => hamleYap(i)}
                  disabled={!gecerliMi}
                  className="aspect-square rounded-sm flex items-center justify-center disabled:cursor-default"
                  style={{ background: 'rgba(0,0,0,0.08)' }}
                >
                  {deger && (
                    <span
                      className="rounded-full"
                      style={{
                        width: '78%',
                        height: '78%',
                        background: deger === 'siyah' ? SIYAH_HEX : BEYAZ_HEX,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        border: deger === 'beyaz' ? '1px solid rgba(0,0,0,0.15)' : 'none',
                      }}
                    />
                  )}
                  {!deger && gecerliMi && (
                    <span className="rounded-full" style={{ width: '28%', height: '28%', background: 'rgba(255,255,255,0.55)' }} />
                  )}
                </button>
              );
            })}
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
