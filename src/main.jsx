import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tailwind.css';
import './styles/theme.css';
import { AuthProvider } from './context/AuthContext';
import { CoupleProvider } from './context/CoupleContext';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CoupleProvider>
        <App />
      </CoupleProvider>
    </AuthProvider>
  </StrictMode>
);