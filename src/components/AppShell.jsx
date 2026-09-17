import { useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useCouple } from '../context/CoupleContext';
import { Avatar } from './Bond';

const SEKMELER = [
  { yol: '/', ikon: 'home', etiket: 'Ana Sayfa' },
  { yol: '/oda', ikon: 'favorite', etiket: 'Eşleşme' },
  { yol: '/notlar', ikon: 'edit_note', etiket: 'Notlar' },
  { yol: '/ciz', ikon: 'palette', etiket: 'Çiz' },
  { yol: '/oyunlar', ikon: 'sports_esports', etiket: 'Oyunlar' },
  { yol: '/anilar', ikon: 'photo_camera', etiket: 'Anılar' },
];

export default function AppShell({ children }) {
  const { pathname } = useLocation();
  const { partner, partnerAktif, sayfaBildir, gunSayisi } = useCouple();

  useEffect(() => { sayfaBildir(pathname); }, [pathname, sayfaBildir]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_12px_rgba(93,48,14,0.04)]">
        <div className="h-16 px-space-lg flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm min-w-0 flex-shrink-0">
            <div className="relative w-7 h-7 rounded-lg bg-primary flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" className="absolute top-0.5 right-0.5">
                <path d="M12 20.2c-.25 0-.5-.08-.7-.24C7.6 17 3.5 13.3 3.5 9.3 3.5 6.6 5.6 4.5 8.2 4.5c1.6 0 3 .77 3.8 1.98.8-1.2 2.2-1.98 3.8-1.98 2.6 0 4.7 2.1 4.7 4.8 0 4-4.1 7.7-7.8 10.66-.2.16-.45.24-.7.24Z" />
              </svg>
            </div>
            <span className="text-headline-sm text-primary tracking-tight truncate">İkiz</span>
          </div>

          <div className="flex items-center gap-space-sm overflow-x-auto no-scrollbar py-space-xs">
            {partner && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Avatar isim={partner.display_name} boyut={28} aktif={partnerAktif} fotoUrl={partner.avatar_url} />
                <span className="text-label-eyebrow text-on-surface-variant whitespace-nowrap">
                  {partner.display_name || 'Partnerin'} {partnerAktif ? 'çevrimiçi' : 'çevrimdışı'}
                </span>
              </div>
            )}
            {gunSayisi !== null && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-fixed text-brown-earth flex-shrink-0">
                <span className="material-symbols-outlined text-[14px] text-tertiary">auto_awesome</span>
                <span className="text-label-eyebrow whitespace-nowrap">{gunSayisi}. Gün</span>
              </div>
            )}
          </div>

          <Link
            to="/profil"
            aria-label="Profil"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
          >
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-28 bg-surface min-h-screen">
        <div className="flex flex-col w-full px-space-md pt-space-md pb-space-2xl space-y-space-lg">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe pointer-events-none">
        <div className="px-space-md pb-space-sm pointer-events-auto max-w-md mx-auto">
          <div className="bg-surface-card/95 backdrop-blur-2xl rounded-full px-space-sm py-space-xs shadow-[0_16px_40px_rgba(210,69,88,0.14)] flex items-center justify-between">
            {SEKMELER.map(({ yol, ikon, etiket }) => (
              <NavLink
                key={yol}
                to={yol}
                end={yol === '/'}
                aria-label={etiket}
                className={({ isActive }) =>
                  'flex items-center justify-center w-11 h-11 rounded-full transition-colors ' +
                  (isActive ? 'text-primary bg-surface-soft' : 'text-on-surface-variant hover:text-on-surface')
                }
              >
                <span className="material-symbols-outlined text-[24px]">{ikon}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
