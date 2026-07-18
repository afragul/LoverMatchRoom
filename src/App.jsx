import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCouple } from './context/CoupleContext';

import AppShell from './components/AppShell';
import AuthPage from './features/auth/AuthPage';
import MatchPage from './features/match/MatchPage';
import HomePage from './features/home/HomePage';
import NotesPage from './features/notes/NotesPage';
import GamesPage from './features/games/GamesPage';
import DrawPage from './features/draw/DrawPage';
import RoomPage from './features/room/RoomPage';

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

/* Anılar henüz veri katmanına bağlı değil — boş durumu dürüstçe anlat. */
function AnilarPage() {
  return (
    <>
      <header className="stack-2" style={{ marginBottom: 'var(--s5)' }}>
        <p className="eyebrow">Anılar</p>
        <h1>Arşiv</h1>
      </header>
      <div className="card" style={{ textAlign: 'center', padding: 'var(--s7) var(--s5)' }}>
        <h3>Henüz açılmadı</h3>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Fotoğraf ve tarih saklama yakında burada olacak.
        </p>
      </div>
    </>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { coupleId, loading: coupleLoading } = useCouple();

  if (authLoading || coupleLoading) return <Yukleniyor />;
  if (!user) return <AuthPage />;
  if (!coupleId) return <MatchPage />;

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"        element={<HomePage />} />
          <Route path="/notlar"  element={<NotesPage />} />
          <Route path="/ciz"     element={<DrawPage />} />
          <Route path="/oyunlar" element={<GamesPage />} />
          <Route path="/anilar"  element={<AnilarPage />} />
          <Route path="/oda"     element={<RoomPage />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}