import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const HATA_METINLERI = {
  INVALID_CODE: 'Böyle bir kod yok. Karakterleri kontrol et.',
  CODE_ALREADY_USED: 'Bu kod kullanılmış. Yeni bir kod isteyin.',
  CODE_EXPIRED: 'Bu kodun süresi dolmuş. Yeni bir kod isteyin.',
  CANNOT_MATCH_SELF: 'Bu senin kendi kodun.',
  ALREADY_MATCHED: 'Zaten bir odadasın.',
  INVITER_ALREADY_MATCHED: 'Kodu üreten kişi başka bir odaya katılmış.',
  COUPLE_FULL: 'Bu oda dolu.',
  CODE_GENERATION_FAILED: 'Kod üretilemedi. Tekrar dene.',
};

function hataCevir(error) {
  const anahtar = Object.keys(HATA_METINLERI).find((k) => error.message.includes(k));
  return anahtar ? HATA_METINLERI[anahtar] : 'Bir şeyler ters gitti. Tekrar dene.';
}

const bicimle = (k) => (k?.length === 8 ? `${k.slice(0, 4)}-${k.slice(4)}` : k);

export default function MatchPage() {
  const { signOut } = useAuth();
  const { yenile } = useCouple();

  const [sekme, setSekme] = useState('uret');   // 'uret' | 'gir'
  const [kod, setKod]     = useState(null);
  const [girilen, setGirilen] = useState('');
  const [hata, setHata]   = useState(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [mesgul, setMesgul] = useState(false);

  async function kodUret() {
    setHata(null); setMesgul(true);
    const { data, error } = await supabase.rpc('generate_invite');
    if (error) setHata(hataCevir(error)); else setKod(data);
    setMesgul(false);
  }

  async function kodKullan() {
    setHata(null);
    const temiz = girilen.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (temiz.length !== 8) { setHata('Kod 8 karakter olmalı.'); return; }

    setMesgul(true);
    const { error } = await supabase.rpc('redeem_invite', { p_code: temiz });
    if (error) setHata(hataCevir(error)); else await yenile();
    setMesgul(false);
  }

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(bicimle(kod));
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      setHata('Kopyalanamadı. Kodu elle seçebilirsin.');
    }
  }

  return (
    <div className="min-h-screen bg-surface px-space-md pt-space-2xl pb-space-2xl">
      <div className="max-w-md mx-auto space-y-space-lg">
        <header className="space-y-1 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-primary">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            <span className="text-label-eyebrow uppercase tracking-widest">Birlikte Yeni Bir Başlangıç</span>
          </div>
          <h1 className="text-headline-lg-mobile text-on-surface pt-1">Partnerinle Odanı Birleştir</h1>
          <p className="text-body-medium text-text-muted">
            Biriniz kod üretir, diğeri girer. Oda sadece ikinize açılır.
          </p>
        </header>

        <div className="flex items-center gap-1 bg-surface-soft p-1 rounded-full">
          {[['uret', 'Kod üret'], ['gir', 'Kodum var']].map(([deger, etiket]) => (
            <button
              key={deger}
              onClick={() => { setSekme(deger); setHata(null); }}
              className={
                'flex-1 py-2.5 rounded-full text-label-tab transition-all ' +
                (sekme === deger ? 'bg-surface-card text-primary shadow-sm' : 'bg-transparent text-text-muted')
              }
            >
              {etiket}
            </button>
          ))}
        </div>

        {sekme === 'uret' ? (
          <div className="bg-surface-card rounded-2xl p-space-xl shadow-md text-center">
            {kod ? (
              <>
                <p className="text-label-eyebrow text-primary uppercase tracking-widest">Davet kodun</p>
                <p className="text-headline-lg text-primary my-space-md" style={{ letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}>
                  {bicimle(kod)}
                </p>

                <button
                  onClick={kopyala}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-soft text-primary text-label-button"
                >
                  <span className="material-symbols-outlined text-[18px]">{kopyalandi ? 'check' : 'content_copy'}</span>
                  {kopyalandi ? 'Kopyalandı' : 'Kodu kopyala'}
                </button>

                <p className="text-text-faint text-body-sm mt-space-md">
                  7 gün geçerli, tek kullanımlık. Karşı taraf kodu girdiğinde oda açılır.
                </p>

                <button onClick={kodUret} disabled={mesgul} className="text-text-muted text-label-tab mt-space-sm">
                  Yeni kod üret
                </button>
              </>
            ) : (
              <>
                <h3 className="text-headline-sm text-on-surface">Kodu sen üret</h3>
                <p className="text-body-sm text-text-muted my-space-sm">Kodu partnerine ilet, o girsin.</p>
                <button
                  onClick={kodUret}
                  disabled={mesgul}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-on-primary text-label-button shadow-md"
                >
                  {mesgul ? 'Üretiliyor…' : 'Kod üret'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl p-space-xl shadow-md">
            <h3 className="text-headline-sm text-on-surface">Kodu gir</h3>
            <p className="text-body-sm text-text-muted my-space-sm">Partnerinin ürettiği 8 karakterli kodu yaz.</p>

            <input
              value={girilen}
              maxLength={9}
              placeholder="K7MP-2XQ4"
              onChange={(e) => setGirilen(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && kodKullan()}
              className="w-full text-center text-headline-sm font-bold rounded-xl bg-surface-soft text-on-surface outline-none py-4"
              style={{ letterSpacing: '0.12em' }}
            />

            <button
              onClick={kodKullan}
              disabled={mesgul}
              className="w-full mt-space-md py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-on-primary text-label-button shadow-md"
            >
              {mesgul ? 'Kontrol ediliyor…' : 'Odaya katıl'}
            </button>
          </div>
        )}

        {hata && <p className="text-primary text-body-sm font-semibold text-center">{hata}</p>}

        <div className="text-center flex items-center justify-center gap-space-md">
          <Link to="/profil" className="text-text-muted text-label-tab">Hesap ayarları</Link>
          <button onClick={signOut} className="text-text-muted text-label-tab">Çıkış yap</button>
        </div>
      </div>
    </div>
  );
}