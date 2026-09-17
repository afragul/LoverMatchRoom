import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const OYUNLAR = [
  { ad: 'XOX', alt: 'Üç taşı yan yana getir', ikon: 'favorite', ton: 'bg-secondary-fixed text-primary', yol: '/oyunlar/xox' },
  { ad: 'Kelime Düellosu', alt: 'Aynı harflerden kim daha çok kelime çıkarır', ikon: 'spellcheck', ton: 'bg-tertiary-fixed text-brown-earth', yol: '/oyunlar/duello' },
  { ad: 'Çiz ve Tahmin Et', alt: 'Biri çizer, diğeri bilir', ikon: 'draw', ton: 'bg-mint-soft text-mint-vibrant', yol: '/oyunlar/cizbil' },
  { ad: 'Bunu Bilir misin', alt: 'Partnerin hakkında sorular', ikon: 'quiz', ton: 'bg-surface-soft text-primary', yol: '/oyunlar/bilirmisin' },
];

export default function GamesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coupleId, partnerSayfa, partner } = useCouple();
  const partnerBuradaMi = !!partnerSayfa?.startsWith('/oyunlar');

  const [sonuclar, setSonuclar] = useState([]);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('oyun_sonuclari')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (iptal) return;
        setSonuclar(data ?? []);
      });

    return () => { iptal = true; };
  }, [coupleId]);

  const benimSkorum = sonuclar.filter((s) => s.kazanan_id === user.id).length;
  const partnerSkoru = partner ? sonuclar.filter((s) => s.kazanan_id === partner.id).length : 0;
  const toplamMac = sonuclar.length;

  return (
    <>
      <header className="space-y-1">
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Oyunlar</p>
        <h1 className="text-headline-lg-mobile text-on-surface">Çift Oyunları Lobi 🎮</h1>
        {partnerBuradaMi && (
          <p className="text-body-medium text-text-muted">
            {partner?.display_name || 'Partnerin'} şu an burada. İyi zamanlama.
          </p>
        )}
      </header>

      {toplamMac > 0 && (
        <section className="bg-surface-card rounded-2xl p-space-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <span className="text-headline-sm text-on-surface">Sen</span>
              <span className="text-label-tab text-text-muted">{benimSkorum} Galibiyet</span>
            </div>
            <div className="flex flex-col items-center px-space-xs">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md">
                <span className="text-headline-sm italic">VS</span>
              </div>
              <div className="mt-2 px-2 py-0.5 rounded-full bg-surface-container text-brown-earth text-label-eyebrow whitespace-nowrap">
                {toplamMac} Toplam Maç
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-headline-sm text-primary">{partner?.display_name || 'Partnerin'}</span>
              <span className="text-label-tab text-primary font-bold">{partnerSkoru} Galibiyet</span>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-space-md">
        {OYUNLAR.map((o) => (
          <button
            key={o.ad}
            onClick={() => navigate(o.yol)}
            className="bg-surface-card rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col items-start text-left min-h-[150px]"
          >
            <div className={'w-10 h-10 rounded-xl flex items-center justify-center mb-space-sm ' + o.ton}>
              <span className="material-symbols-outlined text-[20px]">{o.ikon}</span>
            </div>
            <h3 className="text-headline-sm text-on-surface">{o.ad}</h3>
            <p className="text-body-sm text-text-muted mt-1 flex-1">{o.alt}</p>
          </button>
        ))}
      </div>
    </>
  );
}
