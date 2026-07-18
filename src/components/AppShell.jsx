import { NavLink, useLocation } from 'react-router-dom';
import { IconHome, IconNote, IconGame, IconBrush, IconRoom } from './Icons';

const SEKMELER = [
  { yol: '/',       etiket: 'Ana',     Ikon: IconHome },
  { yol: '/notlar', etiket: 'Notlar',  Ikon: IconNote },
  { yol: '/ciz',    etiket: 'Çiz',     Ikon: IconBrush },
  { yol: '/oyunlar',etiket: 'Oyunlar', Ikon: IconGame },
  { yol: '/oda',    etiket: 'Oda',     Ikon: IconRoom },
];

export default function AppShell({ children }) {
  const { pathname } = useLocation();

  return (
    <>
      <div className="shell">
        {/* key -> her rota değişiminde giriş animasyonu tetiklensin */}
        <div className="page" key={pathname}>
          {children}
        </div>
      </div>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {SEKMELER.map(({ yol, etiket, Ikon }) => (
            <NavLink
              key={yol}
              to={yol}
              end={yol === '/'}
              className={({ isActive }) => 'tab' + (isActive ? ' is-active' : '')}
            >
              <Ikon />
              <span>{etiket}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}