import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const N = 4; // dot sayısı (kenar başına) -> (N-1)x(N-1) kutu
const BENIM_RENK = '#0B63CE';
const PARTNER_RENK = '#E31E24';

function bosYatay() { return Array(N * (N - 1)).fill(null); }
function bosDikey() { return Array((N - 1) * N).fill(null); }
function bosKutular() { return Array((N - 1) * (N - 1)).fill(null); }

const IZGARA_SABLON = Array.from({ length: 2 * N - 1 }, (_, i) => (i % 2 === 0 ? '10px' : '1fr')).join(' ');

export default function DotsBoxesPage() {
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
      .from('dotsboxes_games')
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
      .channel(`dotsboxes:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dotsboxes_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  const baslat = useCallback(async () => {
    setHata(null);
    const { data, error } = await supabase
      .from('dotsboxes_games')
      .upsert({
        couple_id: coupleId,
        yatay: bosYatay(),
        dikey: bosDikey(),
        kutular: bosKutular(),
        sira: user.id,
        kazanan: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Oyun başlatılamadı.');
    else setOyun(data);
  }, [coupleId, user]);

  async function kenarCiz(tur, index) {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;
    if (oyun[tur][index]) return;

    const yeniYatay = tur === 'yatay' ? oyun.yatay.map((v, i) => (i === index ? user.id : v)) : oyun.yatay;
    const yeniDikey = tur === 'dikey' ? oyun.dikey.map((v, i) => (i === index ? user.id : v)) : oyun.dikey;
    const yeniKutular = [...oyun.kutular];

    const etkilenenler = [];
    if (tur === 'yatay') {
      const r = Math.floor(index / (N - 1));
      const c = index % (N - 1);
      if (r > 0) etkilenenler.push([r - 1, c]);
      if (r < N - 1) etkilenenler.push([r, c]);
    } else {
      const r = Math.floor(index / N);
      const c = index % N;
      if (c > 0) etkilenenler.push([r, c - 1]);
      if (c < N - 1) etkilenenler.push([r, c]);
    }

    let kutuAlindi = false;
    for (const [br, bc] of etkilenenler) {
      const bi = br * (N - 1) + bc;
      if (yeniKutular[bi]) continue;
      const ust = yeniYatay[br * (N - 1) + bc];
      const alt = yeniYatay[(br + 1) * (N - 1) + bc];
      const sol = yeniDikey[br * N + bc];
      const sag = yeniDikey[br * N + bc + 1];
      if (ust && alt && sol && sag) {
        yeniKutular[bi] = user.id;
        kutuAlindi = true;
      }
    }

    const tamamlandi = yeniYatay.every(Boolean) && yeniDikey.every(Boolean);
    let kazanan = null;
    if (tamamlandi) {
      const benimSayi = yeniKutular.filter((k) => k === user.id).length;
      const partnerSayi = yeniKutular.filter((k) => k === partner?.id).length;
      kazanan = benimSayi === partnerSayi ? 'berabere' : (benimSayi > partnerSayi ? user.id : partner?.id);
    }

    const guncel = {
      yatay: yeniYatay,
      dikey: yeniDikey,
      kutular: yeniKutular,
      sira: tamamlandi ? null : (kutuAlindi ? user.id : partner?.id),
      kazanan,
      updated_at: new Date().toISOString(),
    };

    setOyun((o) => ({ ...o, ...guncel }));

    const { error } = await supabase
      .from('dotsboxes_games')
      .update(guncel)
      .eq('couple_id', coupleId);

    if (error) { setHata('Hamle kaydedilemedi.'); return; }

    if (kazanan) {
      const kazananId = kazanan === 'berabere' ? null : kazanan;
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'dotsboxes', kazanan_id: kazananId });
    }
  }

  const benimSiramMi = !!(oyun && !oyun.kazanan && oyun.sira === user.id);
  const benimKutu = oyun?.kutular?.filter((k) => k === user.id).length ?? 0;
  const partnerKutu = oyun?.kutular?.filter((k) => k === partner?.id).length ?? 0;

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
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Kutu Doldurma</p>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz oyun yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Nokta aralarına çizgi çek, kutunun son kenarını tamamlayan onu kazanır ve tekrar oynar.
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
              <span className="text-label-tab text-text-muted">{benimKutu} kutu</span>
            </div>
            <span className="text-body-sm text-text-muted text-center flex-1">{durumMetni}</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-headline-sm text-primary">{partner?.display_name || 'Partnerin'}</span>
              <span className="text-label-tab text-primary font-bold">{partnerKutu} kutu</span>
            </div>
          </div>

          <div
            className="mx-auto grid aspect-square w-full max-w-[320px]"
            style={{ gridTemplateColumns: IZGARA_SABLON, gridTemplateRows: IZGARA_SABLON }}
          >
            {Array.from({ length: N }).map((_, r) =>
              Array.from({ length: N }).map((_, c) => (
                <div
                  key={`d-${r}-${c}`}
                  className="rounded-full bg-on-surface justify-self-center self-center"
                  style={{ gridRow: 2 * r + 1, gridColumn: 2 * c + 1, width: 8, height: 8 }}
                />
              ))
            )}

            {oyun.yatay.map((sahip, idx) => {
              const r = Math.floor(idx / (N - 1));
              const c = idx % (N - 1);
              const devreDisi = !benimSiramMi || !!sahip;
              return (
                <button
                  key={`y-${idx}`}
                  onClick={() => kenarCiz('yatay', idx)}
                  disabled={devreDisi}
                  aria-label="Yatay çizgi çiz"
                  className="self-center justify-self-stretch h-[6px] rounded-full transition-colors disabled:cursor-default"
                  style={{
                    gridRow: 2 * r + 1,
                    gridColumn: 2 * c + 2,
                    background: sahip ? (sahip === user.id ? BENIM_RENK : PARTNER_RENK) : 'var(--color-outline-variant)',
                    opacity: sahip ? 1 : benimSiramMi ? 0.6 : 0.3,
                  }}
                />
              );
            })}

            {oyun.dikey.map((sahip, idx) => {
              const r = Math.floor(idx / N);
              const c = idx % N;
              const devreDisi = !benimSiramMi || !!sahip;
              return (
                <button
                  key={`k-${idx}`}
                  onClick={() => kenarCiz('dikey', idx)}
                  disabled={devreDisi}
                  aria-label="Dikey çizgi çiz"
                  className="justify-self-center self-stretch w-[6px] rounded-full transition-colors disabled:cursor-default"
                  style={{
                    gridRow: 2 * r + 2,
                    gridColumn: 2 * c + 1,
                    background: sahip ? (sahip === user.id ? BENIM_RENK : PARTNER_RENK) : 'var(--color-outline-variant)',
                    opacity: sahip ? 1 : benimSiramMi ? 0.6 : 0.3,
                  }}
                />
              );
            })}

            {oyun.kutular.map((sahip, idx) => {
              const r = Math.floor(idx / (N - 1));
              const c = idx % (N - 1);
              const renk = sahip === user.id ? BENIM_RENK : sahip ? PARTNER_RENK : null;
              return (
                <div
                  key={`b-${idx}`}
                  className="rounded-md flex items-center justify-center"
                  style={{
                    gridRow: 2 * r + 2,
                    gridColumn: 2 * c + 2,
                    background: renk ? `${renk}26` : 'transparent',
                  }}
                >
                  {renk && (
                    <span className="material-symbols-outlined text-[18px]" style={{ color: renk }}>
                      favorite
                    </span>
                  )}
                </div>
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
