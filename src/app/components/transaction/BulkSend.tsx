import { ArrowLeft, Layers } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';

export function BulkSend() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-semibold text-white">Bundle</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Layers className="w-10 h-10 text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold mb-3">Bundles & Airdrops</h1>
          <p className="text-gray-400 text-lg mb-2">Coming Soon</p>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Atomic transaction bundles, bulk sends, and token airdrops
            powered by Jito. This feature is currently under development.
          </p>

          <div className="mt-8 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-400 text-sm">
            Stay tuned for updates
          </div>
        </motion.div>
      </div>
    </div>
  );
}