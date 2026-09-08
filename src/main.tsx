import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './state/store';
import { UpdateBanner } from './components/UpdateBanner';
import './index.css';

/*
  ספארי מתעלמת מ-user-scalable=no בגלישה רגילה, ולכן חוסמים את מחוות
  הצביטה ואת הזום בהקשה כפולה במפורש — כדי שיתנהג כמו אפליקציה.
*/
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
      <UpdateBanner />
    </StoreProvider>
  </StrictMode>,
);
