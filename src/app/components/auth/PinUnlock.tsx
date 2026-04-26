import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Fingerprint } from 'lucide-react';
import { ShootingStars } from '../shared/ShootingStars';
import logoDisconnected from '../../../imports/Not_Connected.png';
import { useStartupPage } from '../../../utils/useStartupPage';
import { isBiometricAvailable, authenticateWithBiometric } from '../../../services/biometric';
import { hapticSuccess, hapticError } from '../../../utils/mobile';

interface PinUnlockProps {
  onUnlock: () => void;
}

export function PinUnlock({ onUnlock }: PinUnlockProps) {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);
  useStartupPage();

  // Check biometric availability and auto-prompt on mount
  useEffect(() => {
    const init = async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) {
        triggerBiometric();
      }
    };
    init();
  }, []);

  const triggerBiometric = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setError('');

    try {
      const success = await authenticateWithBiometric();
      if (success) {
        hapticSuccess();
        onUnlock();
      } else {
        hapticError();
        setError('Authentication failed. Tap to try again.');
      }
    } catch {
      hapticError();
      setError('Authentication failed. Tap to try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-6 relative overflow-hidden">
      <ShootingStars />

      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Logo */}
        <motion.img
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          src={logoDisconnected}
          alt="Coldstar"
          className="h-16 mb-12"
        />

        {/* Fingerprint Icon */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          whileTap={{ scale: 0.9 }}
          onClick={triggerBiometric}
          disabled={isAuthenticating}
          className="w-28 h-28 mx-auto mb-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center active:bg-white/15 transition-colors"
        >
          <motion.div
            animate={isAuthenticating ? { scale: [1, 1.1, 1], opacity: [1, 0.5, 1] } : {}}
            transition={{ duration: 1, repeat: isAuthenticating ? Infinity : 0 }}
          >
            <Fingerprint className="w-14 h-14 text-white" />
          </motion.div>
        </motion.button>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          {isAuthenticating ? 'Authenticating...' : 'Unlock Coldstar'}
        </h1>

        {/* Description */}
        <p className="text-base text-white/60 mb-8 leading-relaxed text-center">
          {biometricAvailable === false
            ? 'Fingerprint not available on this device'
            : 'Use your fingerprint to unlock the wallet'
          }
        </p>

        {/* Tap to retry hint */}
        {!isAuthenticating && biometricAvailable !== false && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-sm text-white/40"
          >
            Tap the fingerprint icon to authenticate
          </motion.p>
        )}

        {/* Error Message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-400 mt-4"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md text-center text-xs text-white/40 relative z-10"
      >
        <p>Secured by Solana Mobile Seeker biometric authentication</p>
      </motion.div>
    </div>
  );
}
