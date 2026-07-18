import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const HATALAR = {
  'Invalid login credentials': 'E-posta veya şifre hatalı.',
  'User already registered': 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.',
  'Password should be at least 6 characters':
    'Şifre en az 6 karakter olmalı.',
  'Email not confirmed': 'E-postanı doğrulaman gerekiyor.',
};

export default function AuthPage() {
  const [mod, setMod]     = useState('giris');   // 'giris' | 'kayit'
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [isim, setIsim]   = useState('');
  const [hata, setHata]   = useState(null);
  const [mesgul, setMesgul] = useState(false);

  const kayit = mod === 'kayit';

  async function gonder() {
    setHata(null);
    setMesgul(true);

    const { error } = kayit
      ? await supabase.auth.signUp({
          email,
          password: sifre,
          options: { data: { display_name: isim.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email, password: sifre });

    setMesgul(false);
    if (error) setHata(HATALAR[error.message] ?? error.message);
  }

  const gecerli = email.trim() && sifre && (!kayit || isim.trim());

  return (
    <div className="shell shell--wide" style={{ paddingTop: 'var(--s8)', paddingBottom: 'var(--s6)' }}>
      <div className="page">
        <header style={{ marginBottom: 'var(--s7)' }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 'var(--r-md)',
              background: 'var(--primary)', color: '#fff',
              display: 'grid', placeItems: 'center',
              fontWeight: 800, fontSize: 19, letterSpacing: '-0.04em',
              marginBottom: 'var(--s5)',
            }}
          >
            oo
          </div>

          <h1 style={{ fontSize: 32, lineHeight: 1.15 }}>
            İkinizin<br />ortak alanı.
          </h1>
          <p className="muted" style={{ marginTop: 'var(--s3)', maxWidth: 320 }}>
            Notlar, çizimler ve oyunlar tek yerde. Sadece siz görürsünüz.
          </p>
        </header>

        <div className="card stack" style={{ gap: 'var(--s3)' }}>
          <div className="row" style={{ gap: 'var(--s1)', background: 'var(--surface-soft)', padding: 4, borderRadius: 'var(--r-full)' }}>
            {[
              ['giris', 'Giriş yap'],
              ['kayit', 'Hesap oluştur'],
            ].map(([deger, etiket]) => (
              <button
                key={deger}
                onClick={() => { setMod(deger); setHata(null); }}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer',
                  padding: '10px 0', borderRadius: 'var(--r-full)',
                  fontSize: 13, fontWeight: 700,
                  background: mod === deger ? 'var(--surface)' : 'transparent',
                  color: mod === deger ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: mod === deger ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.22s var(--ease)',
                }}
              >
                {etiket}
              </button>
            ))}
          </div>

          {kayit && (
            <input
              placeholder="Adın"
              value={isim}
              onChange={(e) => setIsim(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="E-posta"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Şifre"
            autoComplete={kayit ? 'new-password' : 'current-password'}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && gecerli && gonder()}
          />

          {hata && (
            <p style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>
              {hata}
            </p>
          )}

          <button
            className="btn btn--primary btn--block"
            onClick={gonder}
            disabled={mesgul || !gecerli}
            style={{ marginTop: 'var(--s1)' }}
          >
            {mesgul ? 'Bir saniye…' : kayit ? 'Hesap oluştur' : 'Giriş yap'}
          </button>
        </div>

        <p className="faint" style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
          Kayıt olduktan sonra bir davet kodu alacaksın.
        </p>
      </div>
    </div>
  );
}