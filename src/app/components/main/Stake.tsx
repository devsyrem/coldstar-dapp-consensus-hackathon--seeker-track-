import { TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { BottomNav } from '../shared/BottomNav';

export function Stake() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-purple-400" />
          </div>

          <h1 className="text-2xl font-bold mb-3">Staking</h1>
          <p className="text-gray-400 text-lg mb-2">Coming Soon</p>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Stake your SOL with top validators and earn rewards.
            This feature is currently under development.
          </p>

          <div className="mt-8 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-400 text-sm">
            Stay tuned for updates
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
