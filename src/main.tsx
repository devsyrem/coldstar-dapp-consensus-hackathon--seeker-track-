import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// Prevent zoom on double-tap for mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Pull-to-refresh is prevented via CSS (overscroll-behavior: none)
// and handled at the component level by PullToRefresh.tsx

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
