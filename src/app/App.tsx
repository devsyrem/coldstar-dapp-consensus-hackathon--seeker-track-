import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { initializeStatusBar, hideSplashScreen } from '../utils/mobile';
import { PinUnlock } from './components/auth/PinUnlock';
import { WalletProvider } from '../contexts/WalletContext';
import { hasWallet } from '../services/wallet';
import { DebugLogViewer } from './components/shared/DebugLogViewer';
import { dlog } from '../services/debug-log';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    dlog.info('App', 'App mounted');
    const initMobileApp = async () => {
      await initializeStatusBar();
      await hideSplashScreen();
      
      const walletExists = hasWallet();
      const currentPath = window.location.pathname;
      const isAppPath = currentPath.startsWith('/app');
      dlog.info('App', `Init — walletExists: ${walletExists}, path: ${currentPath}, isAppPath: ${isAppPath}`);
      
      if (walletExists && isAppPath) {
        setNeedsPin(true);
      } else if (walletExists && !isAppPath) {
        // Wallet exists but user landed on / or /onboarding — redirect to /app
        const isCreatingNew = sessionStorage.getItem('coldstar_creating_new_wallet') === 'true';
        if (!isCreatingNew) {
          window.location.replace('/app');
          return;
        }
        setIsUnlocked(true);
      } else {
        setIsUnlocked(true);
      }
    };

    initMobileApp();
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
    setNeedsPin(false);
  };

  if (needsPin && !isUnlocked) {
    return <PinUnlock onUnlock={handleUnlock} />;
  }

  return (
    <WalletProvider>
      {/* Triple-tap the version label at the bottom to open debug logs */}
      <DebugLogViewer>
        <div className="fixed bottom-0 left-0 z-50 px-2 py-1">
          <span className="text-[8px] text-white/10 select-none">v1.0.0</span>
        </div>
      </DebugLogViewer>
      <RouterProvider router={router} />
    </WalletProvider>
  );
}