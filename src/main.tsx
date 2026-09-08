import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './state/store';
import { UpdateBanner } from './components/UpdateBanner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
      <UpdateBanner />
    </StoreProvider>
  </StrictMode>,
);
