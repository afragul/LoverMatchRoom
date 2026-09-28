import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { Bond } from '../../components/Bond';

// Spotify/YouTube linkini gömülebilir player adresine çevirir; tanınmayan
// linkler için null döner (kaydetmeyi engellemez, sadece embed gösterilmez).
function sarkiEmbedBilgisi(url) {
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { tur: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };

  const sp = url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (sp) return { tur: 'spotify', embedUrl: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}` };

  return null;
}

export default function RoomPage() {
  const { signOut } = useAuth();
  const {
    coupleId, isimler, ben, odaAdi, odaIsmi, odaIsmiKaydet, sarkiUrl, sarkiKaydet,
    baslangic, baslangicKaydet, gunSayisi, partnerAktif, partnerSayfa, partner,
  } = useCouple();

  const partnerBuradaMi = partnerSayfa === '/oda';

  const [istatistik, setIstatistik] = useState({ not: 0 });
  const [duzenle, setDuzenle] = useState(false);
  const [taslakIsim, setTaslakIsim] = useState('');
  const [taslakTarih, setTaslakTarih] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState(null);

  const [sarkiDuzenle, setSarkiDuzenle] = useState(false);
  const [taslakSarki, setTaslakSarki] = useState('');
  const [sarkiKaydediliyor, setSarkiKaydediliyor] = useState(false);
  const [sarkiHata, setSarkiHata] = useState(null);

  const embedBilgisi = sarkiEmbedBilgisi(sarkiUrl);

  useEffect(() => {
    if (!coupleId) return;
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .then(({ count }) => setIstatistik({ not: count ?? 0 }));
  }, [coupleId]);

  function duzenlemeyiAc() {
    setTaslakIsim(odaIsmi ?? '');
    setTaslakTarih(baslangic ? new Date(baslangic).toISOString().slice(0, 10) : '');
    setHata(null);
    setDuzenle(true);
  }

  async function kaydet() {
    setKaydediliyor(true);
    setHata(null);

    const isimHatasi = await odaIsmiKaydet(taslakIsim);
    const tarihHatasi = await baslangicKaydet(taslakTarih || null);
    setKaydediliyor(false);

    if (isimHatasi || tarihHatasi) {
      setHata((isimHatasi || tarihHatasi).message || 'Kaydedilemedi.');
      return;
    }

    setDuzenle(false);
  }

  function sarkiDuzenlemeyiAc() {
    setTaslakSarki(sarkiUrl ?? '');
    setSarkiHata(null);
    setSarkiDuzenle(true);
  }

  async function sarkiKaydetTikla() {
    const temiz = taslakSarki.trim();
    if (!temiz) return;

    setSarkiKaydediliyor(true);
    setSarkiHata(null);

    const hataSonuc = await sarkiKaydet(temiz);
    setSarkiKaydediliyor(false);

    if (hataSonuc) { setSarkiHata(hataSonuc.message || 'Kaydedilemedi.'); return; }
    setSarkiDuzenle(false);
  }

  return (
    <>
      <section className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
        <div className="grid place-items-center mb-space-md">
          <Bond
            isimler={[ben?.display_name, partner?.display_name]}
            fotoUrlleri={[ben?.avatar_url, partner?.avatar_url]}
            boyut={80}
            partnerAktif={partnerAktif}
          />
        </div>

        <h1 className="text-headline-md text-on-surface">{odaAdi}</h1>

        <div className="flex justify-center mt-space-sm">
          <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-body-sm font-semibold ' + (partnerBuradaMi ? 'bg-mint-soft text-mint-vibrant' : 'bg-surface-soft text-text-muted')}>
            <span className={'w-2 h-2 rounded-full ' + (partnerBuradaMi ? 'bg-mint-vibrant animate-pulse' : 'bg-text-faint')} />
            {partnerBuradaMi ? `${partner?.display_name || 'Partnerin'} şu an burada` : 'Şu an sen buradasın'}
          </span>
        </div>

        <button onClick={duzenlemeyiAc} className="mt-space-md px-space-md py-2 rounded-full bg-surface-soft text-primary text-label-tab">
          Odayı düzenle
        </button>
      </section>

      <section className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
        <div className="flex items-center justify-between">
          <p className="text-label-eyebrow text-text-muted uppercase">Ortak Şarkımız 🎵</p>
          {sarkiUrl && !sarkiDuzenle && (
            <button onClick={sarkiDuzenlemeyiAc} className="text-primary text-label-tab">Değiştir</button>
          )}
        </div>

        {sarkiUrl && !sarkiDuzenle ? (
          embedBilgisi ? (
            <iframe
              key={embedBilgisi.embedUrl}
              src={embedBilgisi.embedUrl}
              title="Ortak şarkımız"
              className="w-full rounded-lg"
              style={{ height: embedBilgisi.tur === 'spotify' ? 152 : 200, border: 0 }}
              allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : (
            <p className="text-body-sm text-text-muted">
              Bu link tanınamadı. Spotify veya YouTube linki olmalı.
            </p>
          )
        ) : (
          <div className="space-y-space-sm">
            <input
              placeholder="Spotify veya YouTube linki yapıştır…"
              value={taslakSarki}
              onChange={(e) => setTaslakSarki(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sarkiKaydetTikla()}
              className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
            />
            {sarkiHata && <p className="text-primary text-body-sm font-semibold">{sarkiHata}</p>}
            <div className="flex items-center gap-space-sm">
              <button
                onClick={sarkiKaydetTikla}
                disabled={sarkiKaydediliyor || !taslakSarki.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-primary text-label-button shadow-md"
              >
                {sarkiKaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              {sarkiUrl && (
                <button
                  onClick={() => { setSarkiDuzenle(false); setSarkiHata(null); }}
                  className="px-space-lg py-2.5 rounded-xl bg-surface-soft text-on-surface-variant text-label-button"
                >
                  Vazgeç
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-space-sm">
        <Kutu deger={gunSayisi !== null ? gunSayisi : '—'} etiket="birlikte geçen gün" ton="bg-tertiary-fixed" />
        <Kutu deger={istatistik.not} etiket="bırakılan not" ton="bg-secondary-fixed" />
      </section>

      <button onClick={signOut} className="text-text-muted text-label-tab">Çıkış yap</button>

      {duzenle && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 backdrop-blur-sm" onClick={() => setDuzenle(false)}>
          <div className="w-full bg-surface-card rounded-t-3xl p-space-xl space-y-space-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-md text-on-surface">Odayı düzenle</h2>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase">Oda adı</label>
              <input
                value={taslakIsim}
                onChange={(e) => setTaslakIsim(e.target.value)}
                placeholder={isimler.join(' & ')}
                className="w-full mt-1.5 h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
              />
            </div>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase">Başlangıç tarihi</label>
              <input
                type="date"
                value={taslakTarih}
                onChange={(e) => setTaslakTarih(e.target.value)}
                className="w-full mt-1.5 h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
              />
              <p className="text-text-faint text-body-sm mt-1.5">Gün sayacı bu tarihten itibaren sayar.</p>
            </div>

            {hata && <p className="text-primary text-body-sm font-semibold">{hata}</p>}

            <button
              onClick={kaydet}
              disabled={kaydediliyor}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-on-primary text-label-button shadow-md"
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button onClick={() => setDuzenle(false)} className="w-full py-3 rounded-xl bg-surface-soft text-on-surface-variant text-label-button">
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Kutu({ deger, etiket, ton }) {
  return (
    <div className="bg-surface-card rounded-xl p-space-md shadow-sm">
      <div className={'w-7 h-1 rounded-full mb-space-sm ' + ton} />
      <div className="text-[30px] font-extrabold tracking-tight leading-none text-on-surface">{deger}</div>
      <p className="text-text-faint text-body-sm mt-1.5">{etiket}</p>
    </div>
  );
}
