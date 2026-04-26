import { CheckCircle2, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useStartupPage } from '../../../utils/useStartupPage';

export function Success() {
  const navigate = useNavigate();
  useStartupPage();

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-6 pb-12 pt-16">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="mb-12"
        >
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
            <CheckCircle2 className="w-16 h-16 text-white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-semibold text-white mb-4">
            You're All Set!
          </h1>
          <p className="text-base text-white/60 leading-relaxed">
            Your hardware wallet is ready. Keep your USB drive secure.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-4 w-full"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Hardware Security</h3>
                <p className="text-sm text-white/60">
                  Your private keys are stored on the USB drive and never exposed
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Swipe to Sign</h3>
                <p className="text-sm text-white/60">
                  Confirm transactions with a simple swipe gesture
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
        >
          <p className="text-sm text-amber-400 text-center">
            <strong>Important:</strong> Always keep your USB drive in a safe place. It's the only way to access your wallet.
          </p>
        </motion.div>
      </div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        onClick={() => {
          sessionStorage.removeItem('coldstar_creating_new_wallet');
          navigate('/app');
        }}
        className="w-full max-w-md h-14 rounded-2xl bg-white text-black font-semibold text-base shadow-xl active:scale-95 transition-transform"
      >
        Enter Coldstar
      </motion.button>
    </div>
  );
}