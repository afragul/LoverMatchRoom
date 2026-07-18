import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';
import { IconCopy, IconCheck } from '../../components/Icons';

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
    <div className="shell shell--wide" style={{ paddingTop: 'var(--s7)' }}>
      <div className="page">
        <header style={{ marginBottom: 'var(--s6)' }}>
          <p className="eyebrow">Son adım</p>
          <h1 style={{ marginTop: 'var(--s2)' }}>Odanızı kurun</h1>
          <p className="muted" style={{ marginTop: 'var(--s3)' }}>
            Biriniz kod üretir, diğeri girer. Oda sadece ikinize açılır.
          </p>
        </header>

        {/* sekmeler */}
        <div
          className="row"
          style={{ gap: 'var(--s1)', background: 'var(--surface-soft)', padding: 4, borderRadius: 'var(--r-full)', marginBottom: 'var(--s4)' }}
        >
          {[['uret', 'Kod üret'], ['gir', 'Kodum var']].map(([deger, etiket]) => (
            <button
              key={deger}
              onClick={() => { setSekme(deger); setHata(null); }}
              style={{
                flex: 1, border: 'none', cursor: 'pointer',
                padding: '10px 0', borderRadius: 'var(--r-full)',
                fontSize: 13, fontWeight: 700,
                background: sekme === deger ? 'var(--surface)' : 'transparent',
                color: sekme === deger ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: sekme === deger ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.22s var(--ease)',
              }}
            >
              {etiket}
            </button>
          ))}
        </div>

        {sekme === 'uret' ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--s6) var(--s5)' }}>
            {kod ? (
              <>
                <p className="eyebrow">Davet kodun</p>
                <p
                  style={{
                    fontSize: 34, fontWeight: 800, letterSpacing: '0.08em',
                    margin: 'var(--s3) 0 var(--s4)', color: 'var(--primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {bicimle(kod)}
                </p>

                <button className="btn btn--soft btn--block" onClick={kopyala}>
                  {kopyalandi ? <IconCheck style={{ width: 18 }} /> : <IconCopy style={{ width: 18 }} />}
                  {kopyalandi ? 'Kopyalandı' : 'Kodu kopyala'}
                </button>

                <p className="faint" style={{ marginTop: 'var(--s4)' }}>
                  7 gün geçerli, tek kullanımlık. Karşı taraf kodu girdiğinde oda açılır.
                </p>

                <button className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--s2)' }} onClick={kodUret} disabled={mesgul}>
                  Yeni kod üret
                </button>
              </>
            ) : (
              <>
                <h3>Kodu sen üret</h3>
                <p className="muted" style={{ margin: 'var(--s2) 0 var(--s5)' }}>
                  Kodu partnerine ilet, o girsin.
                </p>
                <button className="btn btn--primary btn--block" onClick={kodUret} disabled={mesgul}>
                  {mesgul ? 'Üretiliyor…' : 'Kod üret'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 'var(--s5)' }}>
            <h3>Kodu gir</h3>
            <p className="muted" style={{ margin: 'var(--s2) 0 var(--s4)' }}>
              Partnerinin ürettiği 8 karakterli kodu yaz.
            </p>

            <input
              value={girilen}
              maxLength={9}
              placeholder="K7MP-2XQ4"
              onChange={(e) => setGirilen(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && kodKullan()}
              style={{
                textAlign: 'center', fontSize: 22, fontWeight: 700,
                letterSpacing: '0.12em', padding: '18px 12px',
              }}
            />

            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 'var(--s4)' }}
              onClick={kodKullan}
              disabled={mesgul}
            >
              {mesgul ? 'Kontrol ediliyor…' : 'Odaya katıl'}
            </button>
          </div>
        )}

        {hata && (
          <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, textAlign: 'center', marginTop: 'var(--s4)' }}>
            {hata}
          </p>
        )}

        <div style={{ textAlign: 'center', marginTop: 'var(--s6)' }}>
          <button className="btn btn--ghost btn--sm" onClick={signOut}>Çıkış yap</button>
        </div>
      </div>
    </div>
  );
}