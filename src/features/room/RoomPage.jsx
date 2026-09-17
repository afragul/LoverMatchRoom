import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { Bond } from '../../components/Bond';

export default function RoomPage() {
  const { signOut } = useAuth();
  const {
    coupleId, isimler, ben, odaAdi, odaIsmi, odaIsmiKaydet,
    baslangic, baslangicKaydet, gunSayisi, partnerAktif, partnerSayfa, partner,
  } = useCouple();

  const partnerBuradaMi = partnerSayfa === '/oda';

  const [istatistik, setIstatistik] = useState({ not: 0 });
  const [duzenle, setDuzenle] = useState(false);
  const [taslakIsim, setTaslakIsim] = useState('');
  const [taslakTarih, setTaslakTarih] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState(null);

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

      <section className="grid grid-cols-2 gap-space-sm">
        <Kutu deger={gunSayisi !== null ? gunSayisi : '—'} etiket="birlikte geçen gün" ton="bg-tertiary-fixed" />
        <Kutu deger={istatistik.not} etiket="bırakılan not" ton="bg-secondary-fixed" />
      </section>

      <button onClick={signOut} className="text-text-muted text-label-tab">Çıkış yap</button>

      {duzenle && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={() => setDuzenle(false)}>
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
