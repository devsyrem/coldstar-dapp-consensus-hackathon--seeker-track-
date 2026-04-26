import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { SwipeButton } from './SwipeButton';
import { HardwareStatus } from './HardwareStatus';
import { PinVerification } from './PinVerification';
import { useWallet } from '../../../contexts/WalletContext';

interface HardwareAuthPromptProps {
  onSuccess: () => void;
  onCancel: () => void;
  message: string;
}

export function HardwareAuthPrompt({ onSuccess, onCancel, message }: HardwareAuthPromptProps) {
  const [isSigning, setIsSigning] = useState(false);
  const { hardwareConnected } = useWallet();
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);

  const handlePinVerified = (_pin: string) => {
    setIsPinVerified(true);
    setShowPinVerification(false);
  };

  const handleCompleteSigning = () => {
    setIsSigning(true);
    setTimeout(() => {
      onSuccess();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="px-3 sm:px-6 pt-12 sm:pt-14 pb-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-semibold text-white">Hardware Authorization</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <motion.div
            animate={
              isSigning
                ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }
                : {}
            }
            transition={{ duration: 0.5, repeat: isSigning ? Infinity : 0 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/30 flex items-center justify-center mb-8 mx-auto"
          >
            <span className="text-5xl">🔐</span>
          </motion.div>

          <h1 className="text-2xl font-semibold text-white mb-4 text-center">
            {isSigning ? 'Signing Transaction...' : isPinVerified ? 'Sign with Hardware' : 'Verify PIN First'}
          </h1>
          <p className="text-base text-white/60 text-center mb-8">
            {isSigning
              ? 'Waiting for hardware confirmation'
              : isPinVerified 
              ? message
              : 'Please verify your PIN to continue'}
          </p>

          <div className="w-full mb-8 flex justify-center">
            <HardwareStatus connected={hardwareConnected} variant="badge" />
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-3 sm:px-6 pb-6">
        <div className="max-w-md mx-auto w-full">
          {!isSigning && isPinVerified && (
            <SwipeButton
              onComplete={handleCompleteSigning}
              text="Swipe to sign"
              variant="sign"
            />
          )}
          
          {!isPinVerified && (
            <button
              onClick={() => setShowPinVerification(true)}
              className="w-full h-14 rounded-2xl bg-white text-black font-semibold active:scale-95 transition-transform"
            >
              Verify PIN
            </button>
          )}
        </div>
      </div>

      {/* Biometric Verification Modal */}
      <PinVerification
        isOpen={showPinVerification}
        onClose={() => {
          setShowPinVerification(false);
        }}
        onVerified={handlePinVerified}
        title="Authorize Transaction"
        description="Scan your fingerprint to proceed with signing"
      />
    </div>
  );
}