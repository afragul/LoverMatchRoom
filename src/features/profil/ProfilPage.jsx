import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

function bashHarf(isim) {
  return (isim || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
}

// Supabase Storage anahtarları Türkçe karakter/boşluk kabul etmiyor —
// orijinal dosya adı yerine güvenli, üretilmiş bir ad kullan.
function guvenliDosyaAdi(dosya) {
  const uzanti = (dosya.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`;
}

export default function ProfilPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { yenile } = useCouple();

  const [yukleniyor, setYukleniyor] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [taslakIsim, setTaslakIsim] = useState('');
  const [isimKaydediliyor, setIsimKaydediliyor] = useState(false);
  const [isimHata, setIsimHata] = useState(null);
  const [isimBasarili, setIsimBasarili] = useState(false);

  const [avatarYukleniyor, setAvatarYukleniyor] = useState(false);
  const [avatarHata, setAvatarHata] = useState(null);

  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [sifreKaydediliyor, setSifreKaydediliyor] = useState(false);
  const [sifreHata, setSifreHata] = useState(null);
  const [sifreBasarili, setSifreBasarili] = useState(false);

  useEffect(() => {
    let iptal = false;
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (iptal) return;
        setTaslakIsim(data?.display_name ?? '');
        setAvatarUrl(data?.avatar_url ?? null);
        setYukleniyor(false);
      });
    return () => { iptal = true; };
  }, [user.id]);

  async function isimKaydet() {
    const temiz = taslakIsim.trim();
    if (!temiz) return;

    setIsimKaydediliyor(true);
    setIsimHata(null);
    setIsimBasarili(false);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: temiz })
      .eq('id', user.id);

    setIsimKaydediliyor(false);

    if (error) { setIsimHata('İsim kaydedilemedi.'); return; }
    setIsimBasarili(true);
    setTimeout(() => setIsimBasarili(false), 2000);
    yenile();
  }

  async function avatarSec(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;

    setAvatarYukleniyor(true);
    setAvatarHata(null);

    const yol = `${user.id}/${guvenliDosyaAdi(dosya)}`;
    const { error: yuklemeHatasi } = await supabase.storage.from('avatars').upload(yol, dosya);
    if (yuklemeHatasi) {
      console.error('Avatar yükleme hatası:', yuklemeHatasi);
      setAvatarHata(`Fotoğraf yüklenemedi: ${yuklemeHatasi.message}`);
      setAvatarYukleniyor(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(yol);
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', user.id);

    setAvatarYukleniyor(false);

    if (error) { setAvatarHata('Fotoğraf kaydedilemedi.'); return; }
    setAvatarUrl(data.publicUrl);
    yenile();
  }

  async function sifreKaydet() {
    setSifreHata(null);
    setSifreBasarili(false);

    if (yeniSifre.length < 6) { setSifreHata('Şifre en az 6 karakter olmalı.'); return; }
    if (yeniSifre !== yeniSifreTekrar) { setSifreHata('Şifreler eşleşmiyor.'); return; }

    setSifreKaydediliyor(true);
    const { error } = await supabase.auth.updateUser({ password: yeniSifre });
    setSifreKaydediliyor(false);

    if (error) { setSifreHata('Şifre değiştirilemedi.'); return; }
    setYeniSifre('');
    setYeniSifreTekrar('');
    setSifreBasarili(true);
    setTimeout(() => setSifreBasarili(false), 2500);
  }

  return (
    <>
      <header className="flex items-center gap-space-sm">
        <button
          onClick={() => navigate(-1)}
          aria-label="Geri dön"
          className="w-10 h-10 rounded-full bg-surface-card shadow-sm flex items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <p className="text-label-eyebrow text-primary uppercase tracking-widest">Profil</p>
          <h1 className="text-headline-md text-on-surface">Hesabın</h1>
        </div>
      </header>

      {yukleniyor ? (
        <p className="text-body-sm text-text-muted">Yükleniyor…</p>
      ) : (
        <>
          <section className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
            <label className="relative inline-block cursor-pointer">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profil fotoğrafı" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-[36px] font-extrabold">
                  {bashHarf(taslakIsim)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[16px]">
                  {avatarYukleniyor ? 'hourglass_top' : 'photo_camera'}
                </span>
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={avatarSec} disabled={avatarYukleniyor} />
            </label>
            {avatarHata && <p className="text-primary text-body-sm font-semibold mt-space-sm">{avatarHata}</p>}
            <p className="text-body-sm text-text-muted mt-space-sm">{user.email}</p>
          </section>

          <section className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
            <label className="text-label-eyebrow text-text-muted uppercase block">Görünen adın</label>
            <input
              value={taslakIsim}
              onChange={(e) => setTaslakIsim(e.target.value)}
              className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
            />
            {isimHata && <p className="text-primary text-body-sm font-semibold">{isimHata}</p>}
            <button
              onClick={isimKaydet}
              disabled={isimKaydediliyor || !taslakIsim.trim()}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-primary text-label-button shadow-md"
            >
              {isimKaydediliyor ? 'Kaydediliyor…' : isimBasarili ? 'Kaydedildi ✓' : 'Kaydet'}
            </button>
          </section>

          <section className="bg-surface-card rounded-xl p-space-lg shadow-sm space-y-space-sm">
            <h2 className="text-headline-sm text-on-surface">Şifreyi değiştir</h2>
            <input
              type="password"
              placeholder="Yeni şifre"
              value={yeniSifre}
              onChange={(e) => setYeniSifre(e.target.value)}
              className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
            />
            <input
              type="password"
              placeholder="Yeni şifre (tekrar)"
              value={yeniSifreTekrar}
              onChange={(e) => setYeniSifreTekrar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sifreKaydet()}
              className="w-full h-11 px-space-md rounded-lg bg-surface-soft text-on-surface outline-none"
            />
            {sifreHata && <p className="text-primary text-body-sm font-semibold">{sifreHata}</p>}
            <button
              onClick={sifreKaydet}
              disabled={sifreKaydediliyor || !yeniSifre || !yeniSifreTekrar}
              className="w-full py-2.5 rounded-xl bg-surface-soft disabled:opacity-50 text-primary text-label-button"
            >
              {sifreKaydediliyor ? 'Değiştiriliyor…' : sifreBasarili ? 'Değiştirildi ✓' : 'Şifreyi değiştir'}
            </button>
          </section>

          <button onClick={signOut} className="text-text-muted text-label-tab">Çıkış yap</button>
        </>
      )}
    </>
  );
}
