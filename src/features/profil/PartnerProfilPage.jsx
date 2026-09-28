import { useNavigate } from 'react-router-dom';
import { useCouple } from '../../context/CoupleContext';

function bashHarf(isim) {
  return (isim || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
}

export default function PartnerProfilPage() {
  const navigate = useNavigate();
  const { partner, partnerAktif, gunSayisi } = useCouple();

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
          <h1 className="text-headline-md text-on-surface">{partner?.display_name || 'Partnerin'}</h1>
        </div>
      </header>

      <section className="bg-surface-card rounded-xl p-space-xl text-center shadow-sm">
        <div className="relative inline-block">
          {partner?.avatar_url ? (
            <img src={partner.avatar_url} alt="Profil fotoğrafı" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-[36px] font-extrabold">
              {bashHarf(partner?.display_name)}
            </div>
          )}
          <span
            className={
              'absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-surface-card ' +
              (partnerAktif ? 'bg-[var(--green)]' : 'bg-text-faint')
            }
          />
        </div>
        <p className="text-body-sm text-text-muted mt-space-sm">
          {partnerAktif ? 'Şu an çevrimiçi' : 'Çevrimdışı'}
        </p>
      </section>

      {gunSayisi !== null && (
        <section className="bg-surface-card rounded-xl p-space-lg shadow-sm flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-tertiary text-[22px]">auto_awesome</span>
          <p className="text-body-base text-on-surface">
            <strong>{gunSayisi}.</strong> gündür birliktesiniz 💕
          </p>
        </section>
      )}
    </>
  );
}
