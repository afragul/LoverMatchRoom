import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const RENKLER = ['kirmizi', 'sari', 'yesil', 'mavi'];
const RENK_HEX = { kirmizi: '#E31E24', sari: '#FFC800', yesil: '#0E9648', mavi: '#0B63CE' };
const RENK_ADI = { kirmizi: 'Kırmızı', sari: 'Sarı', yesil: 'Yeşil', mavi: 'Mavi' };

function desteOlustur() {
  const kartlar = [];
  for (const renk of RENKLER) {
    kartlar.push({ renk, tip: 'sayi', deger: 0 });
    for (let d = 1; d <= 9; d++) {
      kartlar.push({ renk, tip: 'sayi', deger: d });
      kartlar.push({ renk, tip: 'sayi', deger: d });
    }
    for (let i = 0; i < 2; i++) {
      kartlar.push({ renk, tip: 'atla' });
      kartlar.push({ renk, tip: 'ters' });
      kartlar.push({ renk, tip: 'ikicek' });
    }
  }
  for (let i = 0; i < 4; i++) {
    kartlar.push({ renk: null, tip: 'joker' });
    kartlar.push({ renk: null, tip: 'jokerdortcek' });
  }
  return kartlar;
}

function karistir(dizi) {
  const d = [...dizi];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function kartEtiket(kart) {
  if (kart.tip === 'sayi') return String(kart.deger);
  if (kart.tip === 'atla') return '⦸';
  if (kart.tip === 'ters') return '⇄';
  if (kart.tip === 'ikicek') return '+2';
  if (kart.tip === 'joker') return '★';
  if (kart.tip === 'jokerdortcek') return '+4';
  return '?';
}

function oynanabilirMi(kart, ustKart, gecerliRenk) {
  if (kart.tip === 'joker' || kart.tip === 'jokerdortcek') return true;
  if (kart.renk === gecerliRenk) return true;
  if (kart.tip === ustKart.tip) return kart.tip === 'sayi' ? kart.deger === ustKart.deger : true;
  return false;
}

function yeniOyunHazirla(oyuncu1Id, oyuncu2Id) {
  let tamDeste, ilkKart;
  do {
    tamDeste = karistir(desteOlustur());
    ilkKart = tamDeste[0];
  } while (ilkKart.tip !== 'sayi');

  return {
    deste: tamDeste.slice(15),
    atilanlar: [ilkKart],
    eller: { [oyuncu1Id]: tamDeste.slice(1, 8), [oyuncu2Id]: tamDeste.slice(8, 15) },
    gecerli_renk: ilkKart.renk,
  };
}

function KartGorseli({ kart, kucuk, onClick, devreDisi, vurgu }) {
  const renkHex = kart.renk ? RENK_HEX[kart.renk] : '#1A1A1A';
  const acikZeminMi = kart.renk === 'sari';
  return (
    <button
      onClick={onClick}
      disabled={devreDisi}
      className={
        'flex-shrink-0 rounded-lg flex items-center justify-center font-extrabold transition-transform ' +
        (kucuk ? 'w-9 h-14 text-sm' : 'w-14 h-20 text-xl')
      }
      style={{
        background: renkHex,
        color: acikZeminMi ? '#241a00' : '#fff',
        textShadow: acikZeminMi ? 'none' : '0 1px 2px rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.55)',
        boxShadow: vurgu
          ? '0 0 0 2px #fff, 0 0 0 4px var(--color-primary)'
          : '0 2px 6px rgba(0,0,0,0.25)',
        opacity: devreDisi ? 0.35 : 1,
        transform: vurgu ? 'translateY(-4px)' : 'none',
      }}
    >
      {kartEtiket(kart)}
    </button>
  );
}

function ElFani({ kartlar, ustKart, gecerliRenk, benimSiramMi, onOyna }) {
  const n = kartlar.length;
  const genislik = 56;
  const ortaIndex = (n - 1) / 2;
  const araSayisi = Math.max(n - 1, 1);
  const araBosluk = n > 1 ? Math.min(32, (300 - genislik) / araSayisi) : 0;
  const maksAci = Math.min(50, n * 7);

  return (
    <div className="relative mx-auto" style={{ height: 108, width: '100%', maxWidth: 340 }}>
      {kartlar.map((kart, i) => {
        const oran = n > 1 ? (i - ortaIndex) / ortaIndex : 0;
        const aci = oran * (maksAci / 2);
        const dusey = Math.abs(oran) * 14;
        const yatay = (i - ortaIndex) * araBosluk;
        const devreDisi = !benimSiramMi || !oynanabilirMi(kart, ustKart, gecerliRenk);
        return (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: '50%',
              transform: `translateX(${yatay - genislik / 2}px) translateY(${dusey}px) rotate(${aci}deg)`,
              transformOrigin: 'bottom center',
              zIndex: devreDisi ? i : i + 100,
            }}
          >
            <KartGorseli kart={kart} onClick={() => onOyna(i)} devreDisi={devreDisi} />
          </div>
        );
      })}
    </div>
  );
}

export default function UnoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const [oyun, setOyun] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [rengSeciyor, setRengSeciyor] = useState(false);
  const [bekleyenIndex, setBekleyenIndex] = useState(null);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('uno_games')
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
      .channel(`uno:${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'uno_games', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setOyun(yeni))
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  async function turuBaslat() {
    setHata(null);
    if (uyeler.length !== 2) return;
    const [a, b] = uyeler;
    const hazirlanan = yeniOyunHazirla(a.id, b.id);

    const { data, error } = await supabase
      .from('uno_games')
      .upsert({
        couple_id: coupleId,
        deste: hazirlanan.deste,
        atilanlar: hazirlanan.atilanlar,
        eller: hazirlanan.eller,
        gecerli_renk: hazirlanan.gecerli_renk,
        sira: Math.random() < 0.5 ? a.id : b.id,
        kazanan: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'couple_id' })
      .select()
      .single();

    if (error) { setHata('Oyun başlatılamadı.'); return; }
    setOyun(data);
  }

  async function kartOyna(index, seciliRenk) {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;
    const elim = oyun.eller[user.id] ?? [];
    const kart = elim[index];
    if (!kart) return;

    const ustKart = oyun.atilanlar[oyun.atilanlar.length - 1];
    if (!oynanabilirMi(kart, ustKart, oyun.gecerli_renk)) return;

    if ((kart.tip === 'joker' || kart.tip === 'jokerdortcek') && !seciliRenk) {
      setBekleyenIndex(index);
      setRengSeciyor(true);
      return;
    }

    const partnerId = uyeler.find((u) => u.id !== user.id)?.id;
    const yeniElim = elim.filter((_, i) => i !== index);
    let yeniAtilanlar = [...oyun.atilanlar, kart];
    let yeniDeste = [...oyun.deste];
    let partnerEli = [...(oyun.eller[partnerId] ?? [])];
    let siradaki = partnerId;

    function kartlarCek(adet) {
      for (let i = 0; i < adet; i++) {
        if (yeniDeste.length === 0) {
          const ustHaric = yeniAtilanlar.slice(0, -1);
          yeniDeste = karistir(ustHaric);
          yeniAtilanlar = yeniAtilanlar.slice(-1);
        }
        const cekilen = yeniDeste.pop();
        if (cekilen) partnerEli.push(cekilen);
      }
    }

    if (kart.tip === 'atla' || kart.tip === 'ters') {
      siradaki = user.id;
    } else if (kart.tip === 'ikicek') {
      kartlarCek(2);
      siradaki = user.id;
    } else if (kart.tip === 'jokerdortcek') {
      kartlarCek(4);
      siradaki = user.id;
    }

    const kazandiMi = yeniElim.length === 0;

    const { data, error } = await supabase
      .from('uno_games')
      .update({
        deste: yeniDeste,
        atilanlar: yeniAtilanlar,
        eller: { ...oyun.eller, [user.id]: yeniElim, [partnerId]: partnerEli },
        gecerli_renk: kart.renk ?? seciliRenk,
        sira: kazandiMi ? null : siradaki,
        kazanan: kazandiMi ? user.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq('couple_id', coupleId)
      .select()
      .single();

    setRengSeciyor(false);
    setBekleyenIndex(null);

    if (error) { setHata('Hamle kaydedilemedi.'); return; }
    setOyun(data);

    if (kazandiMi) {
      await supabase.from('oyun_sonuclari').insert({ couple_id: coupleId, oyun: 'uno', kazanan_id: user.id });
    }
  }

  async function kartCek() {
    if (!oyun || oyun.kazanan || oyun.sira !== user.id) return;

    let yeniDeste = [...oyun.deste];
    let yeniAtilanlar = [...oyun.atilanlar];
    if (yeniDeste.length === 0) {
      const ustHaric = yeniAtilanlar.slice(0, -1);
      yeniDeste = karistir(ustHaric);
      yeniAtilanlar = yeniAtilanlar.slice(-1);
    }
    const cekilen = yeniDeste.pop();
    const elim = [...(oyun.eller[user.id] ?? [])];
    if (cekilen) elim.push(cekilen);
    const partnerId = uyeler.find((u) => u.id !== user.id)?.id;

    const { data, error } = await supabase
      .from('uno_games')
      .update({
        deste: yeniDeste,
        atilanlar: yeniAtilanlar,
        eller: { ...oyun.eller, [user.id]: elim },
        sira: partnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('couple_id', coupleId)
      .select()
      .single();

    if (error) { setHata('Kart çekilemedi.'); return; }
    setOyun(data);
  }

  if (yukleniyor) {
    return <p className="text-body-sm text-text-muted">Yükleniyor…</p>;
  }

  const benimElim = oyun?.eller?.[user.id] ?? [];
  const partnerEli = partner ? oyun?.eller?.[partner.id] ?? [] : [];
  const ustKart = oyun?.atilanlar?.[oyun.atilanlar.length - 1];
  const benimSiramMi = !!(oyun && !oyun.kazanan && oyun.sira === user.id);

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
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">UNO</p>
      </header>

      {!oyun && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <p className="text-body-sm text-text-muted mb-space-md">
            Klasik UNO kuralları — 7'şer kart, renk/sayı eşleştir, önce eli bitiren kazanır.
            "Uno de" kuralı yok, tek elinizde bile rahatça oynayın.
          </p>
          <button onClick={turuBaslat} className="px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Oyunu Başlat
          </button>
        </div>
      )}

      {oyun && oyun.kazanan && (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center shadow-sm">
          <h3 className="text-headline-sm text-on-surface">
            {oyun.kazanan === user.id ? 'Kazandın! 🎉' : `${partner?.display_name || 'Partnerin'} kazandı.`}
          </h3>
          <button onClick={turuBaslat} className="mt-space-md px-space-xl py-2.5 rounded-full bg-primary text-on-primary text-label-button shadow-md">
            Yeni Oyun
          </button>
        </div>
      )}

      {oyun && !oyun.kazanan && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {partnerEli.map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-9 rounded border-2 border-white/25 flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg,#3a1f8a,#160c33)',
                    marginLeft: i === 0 ? 0 : -14,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    zIndex: i,
                  }}
                />
              ))}
            </div>
            <span className="text-label-eyebrow text-text-muted uppercase whitespace-nowrap">
              {partner?.display_name || 'Partnerin'} · {partnerEli.length} kart
            </span>
          </div>

          <p className="text-body-sm text-text-muted text-center">
            {benimSiramMi ? 'Sıra sende!' : `${partner?.display_name || 'Partnerin'} oynuyor…`}
          </p>

          <div className="flex items-center justify-center gap-space-lg">
            <button
              onClick={kartCek}
              disabled={!benimSiramMi}
              aria-label="Kart çek"
              className="relative w-14 h-20 flex-shrink-0 disabled:opacity-40"
            >
              <div className="absolute inset-0 rounded-lg bg-[#160c33] translate-x-1.5 translate-y-1.5" />
              <div className="absolute inset-0 rounded-lg bg-[#1f1148] translate-x-0.5 translate-y-0.5" />
              <div
                className="absolute inset-0 rounded-lg flex items-center justify-center border-2 border-white/25"
                style={{ background: 'linear-gradient(135deg,#3a1f8a,#160c33)', boxShadow: '0 3px 8px rgba(0,0,0,0.35)' }}
              >
                <span className="text-white font-extrabold italic text-sm tracking-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  UNO
                </span>
              </div>
              <span className="absolute -bottom-1.5 -right-1.5 bg-on-surface text-surface text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow">
                {oyun.deste.length}
              </span>
            </button>

            {ustKart && <KartGorseli kart={ustKart} />}

            <div className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-white/40" style={{ background: RENK_HEX[oyun.gecerli_renk] }} title={RENK_ADI[oyun.gecerli_renk]} />
          </div>

          <ElFani
            kartlar={benimElim}
            ustKart={ustKart}
            gecerliRenk={oyun.gecerli_renk}
            benimSiramMi={benimSiramMi}
            onOyna={kartOyna}
          />
          <p className="text-label-eyebrow text-text-muted uppercase text-center">{benimElim.length} kart · elin</p>
        </>
      )}

      {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}

      {rengSeciyor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setRengSeciyor(false); setBekleyenIndex(null); }}>
          <div className="bg-surface-card rounded-2xl p-space-xl space-y-space-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-headline-sm text-on-surface text-center">Renk seç</h3>
            <div className="grid grid-cols-2 gap-space-sm">
              {RENKLER.map((r) => (
                <button
                  key={r}
                  onClick={() => kartOyna(bekleyenIndex, r)}
                  className="w-24 h-16 rounded-xl text-on-primary font-bold"
                  style={{ background: RENK_HEX[r] }}
                >
                  {RENK_ADI[r]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
