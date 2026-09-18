import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCouple } from './context/CoupleContext';

import AppShell from './components/AppShell';
import AuthPage from './features/auth/AuthPage';
import MatchPage from './features/match/MatchPage';
import HomePage from './features/home/HomePage';
import NotesPage from './features/notes/NotesPage';
import ChatPage from './features/chat/ChatPage';
import GamesPage from './features/games/GamesPage';
import DrawPage from './features/draw/DrawPage';
import XoxPage from './features/games/XoxPage';
import DuelloPage from './features/games/DuelloPage';
import CizBilPage from './features/games/CizBilPage';
import BilirMisinPage from './features/games/BilirMisinPage';
import UnoPage from './features/games/UnoPage';
import DotsBoxesPage from './features/games/DotsBoxesPage';
import Connect4Page from './features/games/Connect4Page';
import ReversiPage from './features/games/ReversiPage';
import BattleshipPage from './features/games/BattleshipPage';
import RoomPage from './features/room/RoomPage';
import AnilarPage from './features/anilar/AnilarPage';
import ProfilPage from './features/profil/ProfilPage';

function Yukleniyor() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div
        style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '2.5px solid var(--surface-soft)',
          borderTopColor: 'var(--primary)',
          animation: 'dondur 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes dondur { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { coupleId, loading: coupleLoading } = useCouple();

  if (authLoading || coupleLoading) return <Yukleniyor />;
  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      {!coupleId ? (
        <Routes>
          <Route
            path="/profil"
            element={
              <div className="shell shell--wide" style={{ paddingTop: 'var(--s7)', paddingBottom: 'var(--s6)' }}>
                <ProfilPage />
              </div>
            }
          />
          <Route path="*" element={<MatchPage />} />
        </Routes>
      ) : (
        <AppShell>
          <Routes>
            <Route path="/"        element={<HomePage />} />
            <Route path="/notlar"  element={<NotesPage />} />
            <Route path="/mesajlar" element={<ChatPage />} />
            <Route path="/ciz"     element={<DrawPage />} />
            <Route path="/oyunlar" element={<GamesPage />} />
            <Route path="/oyunlar/xox" element={<XoxPage />} />
            <Route path="/oyunlar/duello" element={<DuelloPage />} />
            <Route path="/oyunlar/cizbil" element={<CizBilPage />} />
            <Route path="/oyunlar/bilirmisin" element={<BilirMisinPage />} />
            <Route path="/oyunlar/uno" element={<UnoPage />} />
            <Route path="/oyunlar/kutudoldurma" element={<DotsBoxesPage />} />
            <Route path="/oyunlar/connect4" element={<Connect4Page />} />
            <Route path="/oyunlar/reversi" element={<ReversiPage />} />
            <Route path="/oyunlar/amiralbatti" element={<BattleshipPage />} />
            <Route path="/anilar"  element={<AnilarPage />} />
            <Route path="/oda"     element={<RoomPage />} />
            <Route path="/profil"  element={<ProfilPage />} />
            <Route path="*"        element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      )}
    </BrowserRouter>
  );
}