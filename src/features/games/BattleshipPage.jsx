import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const BOYUT = 8;
const GEMI_UZUNLUKLARI = [4, 3, 3, 2, 2];
const BENIM_GEMI_HEX = '#0B63CE';
const ISABET_HEX = '#E31E24';
const TAHTA_HEX = '#0B4DA6';
const BATIK_HEX = '#9AA3AE';
const IZGARA_SABLON = `repeat(${BOYUT}, 1fr)`;

function tekGemiYerlestir(uzunluk, doluSet) {
  for (let deneme = 0; deneme < 300; deneme++) {
    const yatayMi = Math.random() < 0.5;
    const satir = Math.floor(Math.random() * BOYUT);
    const sutun = Math.floor(Math.random() * BOYUT);
    const hucreler = [];
    let uygun = true;
    for (let i = 0; i < uzunluk; i++) {
      const rr = yatayMi ? satir : satir + i;
      const cc = yatayMi ? sutun + i : sutun;
      if (rr >= BOYUT || cc >= BOYUT || doluSet.has(rr * BOYUT + cc)) { uygun = false; break; }
      hucreler.push(rr * BOYUT + cc);
    }
    if (uygun) return hucreler;
  }
  return null;
}

function rastgeleTaslak() {
  const dolu = new Set();
  const gemiler = [];
  for (let id = 0; id < GEMI_UZUNLUKLARI.length; id++) {
    const hucreler = tekGemiYerlestir(GEMI_UZUNLUKLARI[id], dolu);
    if (!hucreler) return rastgeleTaslak();
    hucreler.forEach((h) => dolu.add(h));
    gemiler.push({ id, uzunluk: GEMI_UZUNLUKLARI[id], hucreler });
  }
  return gemiler;
}

function gemiYonu(hucreler) {
  if (!hucreler || hucreler.length < 2) return 'yatay';
  return hucreler[1] - hucreler[0] === 1 ? 'yatay' : 'dikey';
}

function hesaplaHucreler(hedefIndex, uzunluk, yon) {
  if (hedefIndex == null) return null;
  const r = Math.floor(hedefIndex / BOYUT), c = hedefIndex % BOYUT;
  const hucreler = [];
  for (let i = 0; i < uzunluk; i++) {
    const rr = yon === 'yatay' ? r : r + i;
    const cc = yon === 'yatay' ? c + i : c;
    if (rr >= BOYUT || cc >= BOYUT) return null;
    hucreler.push(rr * BOYUT + cc);
  }
  return hucreler;
}

function GemiHologram({ hucreler, renk, interaktif, suruklemeAktif, onDragStart, onDragEnd }) {
  if (!hucreler || hucreler.length === 0) return null;
  const satirlar = hucreler.map((h) => Math.floor(h / BOYUT));
  const sutunlar = hucreler.map((h) => h % BOYUT);
  const rMin = Math.min(...satirlar), rMax = Math.max(...satirlar);
  const cMin = Math.min(...sutunlar), cMax = Math.max(...sutunlar);
  const yatayMi = rMin === rMax;
  return (
    <div
      draggable={!!interaktif}
      onDragStart={interaktif ? onDragStart : undefined}
      onDragEnd={interaktif ? onDragEnd : undefined}
      className="flex items-center justify-center rounded-full"
      style={{
        gridRow: `${rMin + 1} / ${rMax + 2}`,
        gridColumn: `${cMin + 1} / ${cMax + 2}`,
        margin: 3,
        background: `linear-gradient(${yatayMi ? '90deg' : '180deg'}, ${renk}70, ${renk}30)`,
        border: `1.5px solid ${renk}`,
        boxShadow: `0 0 10px ${renk}aa, inset 0 0 10px ${renk}55`,
        pointerEvents: interaktif ? (suruklemeAktif ? 'none' : 'auto') : 'none',
        cursor: interaktif ? 'grab' : 'default',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ color: renk, fontSize: 16, opacity: 0.95, transform: yatayMi ? 'none' : 'rotate(90deg)' }}
      >
        sailing
      </span>
    </div>
  );
}

export default function BattleshipPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, partner } = useCouple();

  const [oyun, setOyun] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [taslak, setTaslak] = useState(null);
  const [taslakOyunId, setTaslakOyunId] = useState(null);
  const [suruklemeAktif, setSuruklemeAktif] = useState(false);
  const [surukOnizleme, setSurukOnizleme] = useState(null);
  const suruklenenRef = useRef(null);

  if (oyun && !oyun.hazir?.[user.id] && taslakOyunId !== oyun.created_at) {
    setTaslak(rastgeleTaslak());
    setTaslakOyunId(oyun.created_at);
  }

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('battleship_games')
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
      .channel(`battleship:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'battleship_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  const baslat = useCallback(async () => {
    setHata(null);
    const simdi = new Date().toISOString();
    const { data, error } = await supabase
      .from('battleship_games')
      .upsert({
        couple_id: coupleId,
        gemiler: {},
        hazir: {},
        atislar: {},
        sira: null,
        kazanan: null,
        created_at: simdi,
        updated_at: simdi,
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) setHata('Oyun başlatılamadı.');
    else setOyun(data);
  }, [coupleId]);

  function karistir() {
    setTaslak(rastgeleTaslak());
  }

  function otomatikTamamla() {
    setTaslak((t) => {
      const dolu = new Set(t.filter((g) => g.hucreler).flatMap((g) => g.hucreler));
      return t.map((g) => {
        if (g.hucreler) return g;
        const hucreler = tekGemiYerlestir(g.uzunluk, dolu);
        if (!hucreler) return g;
        hucreler.forEach((h) => dolu.add(h));
        return { ...g, hucreler };
      });
    });
  }

  function paletSuruklemeBaslat(e, gemi) {
    if (gemi.hucreler) return;
    suruklenenRef.current = { gemiId: gemi.id, kaynak: 'palet', orijinalHucreler: null };
    setSuruklemeAktif(true);
    e.dataTransfer.effectAllowed = 'move';
  }

  function gemiSuruklemeBaslat(e, gemi) {
    suruklenenRef.current = {
      gemiId: gemi.id,
      kaynak: 'tahta',
      orijinalHucreler: gemi.hucreler,
      baslangicX: e.clientX,
      baslangicY: e.clientY,
    };
    setSuruklemeAktif(true);
    e.dataTransfer.effectAllowed = 'move';
    setTaslak((t) => t.map((g) => (g.id === gemi.id ? { ...g, hucreler: null } : g)));
  }

  function suruklemeBitti(e) {
    const s = suruklenenRef.current;
    if (s) {
      if (s.kaynak === 'tahta') {
        const dx = e.clientX - (s.baslangicX ?? e.clientX);
        const dy = e.clientY - (s.baslangicY ?? e.clientY);
        const tiklamaMi = Math.hypot(dx, dy) < 5;

        if (tiklamaMi) {
          const suankiYon = gemiYonu(s.orijinalHucreler);
          const yeniYon = suankiYon === 'yatay' ? 'dikey' : 'yatay';
          const yeniHucreler = hesaplaHucreler(s.orijinalHucreler[0], s.orijinalHucreler.length, yeniYon);
          setTaslak((t) => {
            const dolu = new Set(t.filter((g) => g.id !== s.gemiId && g.hucreler).flatMap((g) => g.hucreler));
            const gecerliMi = yeniHucreler && yeniHucreler.every((h) => !dolu.has(h));
            return t.map((g) => (g.id === s.gemiId ? { ...g, hucreler: gecerliMi ? yeniHucreler : s.orijinalHucreler } : g));
          });
        } else {
          setTaslak((t) => t.map((g) => (g.id === s.gemiId ? { ...g, hucreler: s.orijinalHucreler } : g)));
        }
      }
      suruklenenRef.current = null;
    }
    setSuruklemeAktif(false);
    setSurukOnizleme(null);
  }

  function hucreUzerindeSuruklen(e, index) {
    e.preventDefault();
    const s = suruklenenRef.current;
    if (!s || !taslak) return;
    const gemi = taslak.find((g) => g.id === s.gemiId);
    if (!gemi) return;
    const kullanilacakYon = s.kaynak === 'tahta' ? gemiYonu(s.orijinalHucreler) : 'yatay';
    setSurukOnizleme({ hedefIndex: index, uzunluk: gemi.uzunluk, yon: kullanilacakYon });
  }

  function hucreyeBirak(e, index) {
    e.preventDefault();
    const s = suruklenenRef.current;
    if (!s) return;
    const gemi = taslak.find((g) => g.id === s.gemiId);
    if (!gemi) return;
    const kullanilacakYon = s.kaynak === 'tahta' ? gemiYonu(s.orijinalHucreler) : 'yatay';
    const yeniHucreler = hesaplaHucreler(index, gemi.uzunluk, kullanilacakYon);

    setTaslak((t) => {
      const dolu = new Set(t.filter((g) => g.id !== s.gemiId && g.hucreler).flatMap((g) => g.hucreler));
      const gecerliMi = yeniHucreler && yeniHucreler.every((h) => !dolu.has(h));
      return t.map((g) => {
        if (g.id !== s.gemiId) return g;
        if (gecerliMi) return { ...g, hucreler: yeniHucreler };
        return { ...g, hucreler: s.kaynak === 'tahta' ? s.orijinalHucreler : null };
      });
    });

    suruklenenRef.current = null;
    setSuruklemeAktif(false);
    setSurukOnizleme(null);
  }

  async function hazirim() {
    if (!oyun || !taslak || !taslak.every((g) => g.hucreler)) return;
    const gemiGruplari = taslak.map((g) => g.hucreler);
    const partnerHazirMi = !!oyun.hazir?.[partner?.id];

    const guncel = {
      gemiler: { ...oyun.gemiler, [user.id]: gemiGruplari },
      hazir: { ...oyun.hazir, [user.id]: true },
      ...(partnerHazirMi ? { sira: Math.random() < 0.5 ? user.id : partner.id } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('battleship_games')
      .update(guncel)
      .eq('couple_id', coupleId)
      .select()
      .single();

    if (error) { setHata('Kaydedilemedi.'); return; }
    setOyun(data);
  }

  async function atisYap(index) {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;
    const partnerId = partner?.id;
    const benimAtislarim = oyun.atislar?.[user.id] ?? [];
    if (benimAtislarim.includes(index)) return;

    const partnerGemiHucreleri = (oyun.gemiler?.[partnerId] ?? []).flat();
    const yeniAtislar = [...benimAtislarim, index];
    const tumGemilerVuruldu = partnerGemiHucreleri.length > 0 && partnerGemiHucreleri.every((c) => yeniAtislar.includes(c));

    const guncel = {
      atislar: { ...oyun.atislar, [user.id]: yeniAtislar },
      sira: tumGemilerVuruldu ? null : partnerId,
      kazanan: tumGemilerVuruldu ? user.id : null,
      updated_at: new Date().toISOString(),
    };

    setOyun((o) => ({ ...o, ...guncel }));

    const { error } = await supabase
      .from('battleship_games')
      .update(guncel)
      .eq('couple_id', coupleId);

    if (error) { setHata('Atış kaydedilemedi.'); return; }

    if (tumGemilerVuruldu) {
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'amiralbatti', kazanan_id: user.id });
    }
  }

  const benimHazirMi = !!oyun?.hazir?.[user.id];
  const partnerHazirMi = !!oyun?.hazir?.[partner?.id];
  const benimSiramMi = !!(oyun && !oyun.kazanan && oyun.sira === user.id);
  const benimGemiGruplari = oyun?.gemiler?.[user.id] ?? [];
  const partnerGemiGruplari = oyun?.gemiler?.[partner?.id] ?? [];
  const benimGemiHucreleri = benimGemiGruplari.flat();
  const partnerGemiHucreleri = partnerGemiGruplari.flat();
  const benimAtislarim = oyun?.atislar?.[user.id] ?? [];
  const partnerAtislar = oyun?.atislar?.[partner?.id] ?? [];
  const sonPartnerAtisi = partnerAtislar.length > 0 ? partnerAtislar[partnerAtislar.length - 1] : null;
  const sonPartnerAtisiVarMi = sonPartnerAtisi != null;
  const sonPartnerAtisiIsabetMi = sonPartnerAtisiVarMi && benimGemiHucreleri.includes(sonPartnerAtisi);
  const partnerBatanGemiler = partnerGemiGruplari.filter((hucreler) => hucreler.every((h) => benimAtislarim.includes(h)));

  let durumMetni = '';
  if (oyun?.kazanan === user.id) durumMetni = 'Kazandın! Filosu battı.';
  else if (oyun?.kazanan) durumMetni = `${partner?.display_name || 'Partnerin'} kazandı.`;
  else if (benimSiramMi) durumMetni = 'Sıra sende, ateş et!';
  else if (benimHazirMi && partnerHazirMi) durumMetni = `${partner?.display_name || 'Partnerin'} nişan alıyor…`;

  const onizlemeHucreler = surukOnizleme ? hesaplaHucreler(surukOnizleme.hedefIndex, surukOnizleme.uzunluk, surukOnizleme.yon) : null;
  const onizlemeGecerliMi = onizlemeHucreler && taslak
    ? onizlemeHucreler.every((h) => !taslak.some((g) => g.hucreler?.includes(h)))
    : false;
  const tumuYerlesmisMi = !!taslak && taslak.every((g) => g.hucreler);

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
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Amiral Battı</p>
      </header>

      {yukleniyor && <p className="text-body-sm text-text-muted">Yükleniyor…</p>}

      {!yukleniyor && !oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Henüz oyun yok</h3>
          <p className="text-body-sm text-text-muted mt-2 mb-space-md">
            Önce filonu diz, sonra sırayla partnerinin sularına ateş edin. Bütün gemilerini önce batıran kazanır.
          </p>
          <button onClick={baslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Oyunu başlat
          </button>
        </div>
      )}

      {oyun && !benimHazirMi && taslak && (
        <>
          <p className="text-body-sm text-text-muted text-center">
            Gemiler otomatik dizildi. İstersen bir gemiyi tutup tahtada sürükle, bırak;
            hafifçe tıklarsan döner. Paletteki bir gemiyi tahtaya sürüklersen yerleşir.
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {taslak.map((g) => (
              <button
                key={g.id}
                draggable={!g.hucreler}
                onDragStart={(e) => paletSuruklemeBaslat(e, g)}
                onDragEnd={suruklemeBitti}
                disabled={!!g.hucreler}
                style={{
                  background: g.hucreler ? 'var(--color-surface-container-high)' : 'var(--color-surface-container)',
                  color: g.hucreler ? 'var(--color-text-faint)' : 'var(--color-on-surface)',
                  cursor: g.hucreler ? 'default' : 'grab',
                }}
                className="px-3 py-2 rounded-lg text-label-tab font-bold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">sailing</span>
                {g.uzunluk}
              </button>
            ))}
          </div>

          <div
            className="mx-auto grid w-full max-w-[320px] aspect-square gap-[2px] p-1.5 rounded-xl shadow-sm"
            style={{ background: 'var(--color-surface-container-high)', gridTemplateColumns: IZGARA_SABLON, gridTemplateRows: IZGARA_SABLON }}
          >
            {Array.from({ length: BOYUT * BOYUT }).map((_, i) => (
              <button
                key={i}
                onDragOver={(e) => hucreUzerindeSuruklen(e, i)}
                onDrop={(e) => hucreyeBirak(e, i)}
                className="rounded-sm"
                style={{ background: 'rgba(11,99,206,0.08)' }}
              />
            ))}

            {taslak.filter((g) => g.hucreler).map((g) => (
              <GemiHologram
                key={g.id}
                hucreler={g.hucreler}
                renk={BENIM_GEMI_HEX}
                interaktif
                suruklemeAktif={suruklemeAktif}
                onDragStart={(e) => gemiSuruklemeBaslat(e, g)}
                onDragEnd={suruklemeBitti}
              />
            ))}

            {onizlemeHucreler && onizlemeHucreler.map((h) => (
              <div
                key={`onizleme-${h}`}
                className="pointer-events-none rounded-sm"
                style={{
                  gridRow: Math.floor(h / BOYUT) + 1,
                  gridColumn: (h % BOYUT) + 1,
                  background: onizlemeGecerliMi ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-space-sm">
            <button onClick={karistir} className="px-space-lg py-2 rounded-full bg-surface-card shadow-sm text-label-button text-on-surface-variant">
              Karıştır
            </button>
            <button
              onClick={otomatikTamamla}
              disabled={tumuYerlesmisMi}
              className="px-space-lg py-2 rounded-full bg-surface-card shadow-sm text-label-button text-on-surface-variant disabled:opacity-40"
            >
              Otomatik doldur
            </button>
            <button
              onClick={hazirim}
              disabled={!tumuYerlesmisMi}
              className="px-space-lg py-2 rounded-full bg-primary text-on-primary text-label-button shadow-md disabled:opacity-40"
            >
              Hazırım
            </button>
          </div>
        </>
      )}

      {oyun && benimHazirMi && !partnerHazirMi && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Gemilerin hazır</h3>
          <p className="text-body-sm text-text-muted mt-2">
            {partner?.display_name || 'Partnerin'} filosunu diziyor…
          </p>
        </div>
      )}

      {oyun && benimHazirMi && partnerHazirMi && (
        <>
          <p className="text-body-sm text-text-muted text-center">{durumMetni}</p>

          <div>
            <p className="text-label-eyebrow text-text-muted uppercase text-center mb-1">
              {partner?.display_name || 'Partnerin'} Suları
            </p>

            {partnerBatanGemiler.length > 0 && (
              <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                {partnerBatanGemiler.map((hucreler, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 rounded-lg text-label-tab font-bold flex items-center gap-1"
                    style={{ background: ISABET_HEX, color: '#fff' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">sailing</span>
                    {hucreler.length}
                  </div>
                ))}
              </div>
            )}

            <div
              className="mx-auto grid w-full max-w-[320px] aspect-square gap-[2px] p-1.5 rounded-xl shadow-md"
              style={{ background: TAHTA_HEX, gridTemplateColumns: IZGARA_SABLON, gridTemplateRows: IZGARA_SABLON }}
            >
              {Array.from({ length: BOYUT * BOYUT }).map((_, i) => {
                const atildiMi = benimAtislarim.includes(i);
                const isabetMi = atildiMi && partnerGemiHucreleri.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => atisYap(i)}
                    disabled={!benimSiramMi || atildiMi}
                    className="rounded-sm disabled:cursor-default"
                    style={{ background: isabetMi ? ISABET_HEX : atildiMi ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }}
                  />
                );
              })}

              {!!oyun.kazanan && partnerGemiGruplari.map((hucreler, i) => (
                <GemiHologram key={`reveal-${i}`} hucreler={hucreler} renk={ISABET_HEX} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center mb-1">
              <p className="text-label-eyebrow text-text-muted uppercase">Senin Filon</p>
              {sonPartnerAtisiVarMi && (
                <p className="text-label-eyebrow uppercase ml-2" style={{ color: sonPartnerAtisiIsabetMi ? ISABET_HEX : 'var(--color-text-faint)' }}>
                  · {sonPartnerAtisiIsabetMi ? 'İsabet aldın!' : 'Partnerin ıskaladı'}
                </p>
              )}
            </div>
            <div
              className="mx-auto grid w-full max-w-[320px] aspect-square gap-[2px] p-1.5 rounded-xl shadow-sm"
              style={{ background: 'var(--color-surface-container-high)', gridTemplateColumns: IZGARA_SABLON, gridTemplateRows: IZGARA_SABLON }}
            >
              {Array.from({ length: BOYUT * BOYUT }).map((_, i) => (
                <div key={i} className="rounded-sm" />
              ))}

              {benimGemiGruplari.map((hucreler, i) => {
                const battiMi = hucreler.every((h) => partnerAtislar.includes(h));
                return <GemiHologram key={i} hucreler={hucreler} renk={battiMi ? BATIK_HEX : BENIM_GEMI_HEX} />;
              })}

              {Array.from({ length: BOYUT * BOYUT }).map((_, i) => {
                if (!partnerAtislar.includes(i) || !benimGemiHucreleri.includes(i)) return null;
                return (
                  <span
                    key={`isaret-${i}`}
                    className="material-symbols-outlined pointer-events-none flex items-center justify-center"
                    style={{ gridRow: Math.floor(i / BOYUT) + 1, gridColumn: (i % BOYUT) + 1, fontSize: 14, color: '#fff' }}
                  >
                    close
                  </span>
                );
              })}
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
