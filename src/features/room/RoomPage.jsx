import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { Bond } from '../../components/Bond';

export default function RoomPage() {
  const { signOut } = useAuth();
  const {
    coupleId, isimler, odaAdi, odaIsmi, odaIsmiKaydet,
    baslangic, baslangicKaydet, gunSayisi, partnerAktif, partner,
  } = useCouple();

  const [istatistik, setIstatistik] = useState({ not: 0 });
  const [duzenle, setDuzenle] = useState(false);
  const [taslakIsim, setTaslakIsim] = useState('');
  const [taslakTarih, setTaslakTarih] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

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
    setDuzenle(true);
  }

  async function kaydet() {
    setKaydediliyor(true);
    await odaIsmiKaydet(taslakIsim);
    await baslangicKaydet(taslakTarih || null);
    setKaydediliyor(false);
    setDuzenle(false);
  }

  return (
    <>
      <section className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
        <div className="grid place-items-center mb-space-md">
          <Bond isimler={isimler} boyut={80} canli={partnerAktif} />
        </div>

        <h1 className="text-headline-md text-on-surface">{odaAdi}</h1>

        <div className="flex justify-center mt-space-sm">
          <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-body-sm font-semibold ' + (partnerAktif ? 'bg-mint-soft text-mint-vibrant' : 'bg-surface-soft text-text-muted')}>
            <span className={'w-2 h-2 rounded-full ' + (partnerAktif ? 'bg-mint-vibrant animate-pulse' : 'bg-text-faint')} />
            {partnerAktif ? `${partner?.display_name || 'Partnerin'} şu an burada` : 'Şu an sen buradasın'}
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

      {baslangic === null && (
        <div className="bg-surface-card rounded-xl p-space-lg shadow-sm">
          <h3 className="text-headline-sm text-on-surface">Başlangıç tarihi eksik</h3>
          <p className="text-body-sm text-text-muted mt-1">Gün sayacının doğru çalışması için tarihi girin.</p>
          <button onClick={duzenlemeyiAc} className="mt-space-sm px-space-md py-2 rounded-full bg-surface-soft text-primary text-label-tab">
            Tarihi gir
          </button>
        </div>
      )}

      <section className="space-y-space-sm">
        <p className="text-label-eyebrow text-text-muted uppercase tracking-widest">Buradan git</p>
        <Gecis yol="/notlar" ad="Notlar" alt={`${istatistik.not} not`} ikon="edit_note" ton="bg-secondary-fixed text-primary" />
        <Gecis yol="/ciz" ad="Birlikte Çiz" alt="Ortak tuval" ikon="palette" ton="bg-mint-soft text-mint-vibrant" />
        <Gecis yol="/oyunlar" ad="Oyunlar" alt="Sıra tabanlı" ikon="sports_esports" ton="bg-tertiary-fixed text-brown-earth" />
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

function Gecis({ yol, ad, alt, ikon, ton }) {
  return (
    <Link to={yol} className="bg-surface-card rounded-xl p-space-md shadow-sm flex items-center gap-space-md">
      <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + ton}>
        <span className="material-symbols-outlined text-[20px]">{ikon}</span>
      </div>
      <div className="flex-1">
        <h3 className="text-headline-sm text-on-surface">{ad}</h3>
        <p className="text-text-faint text-body-sm">{alt}</p>
      </div>
      <span className="material-symbols-outlined text-text-faint text-[18px]">arrow_forward</span>
    </Link>
  );
}