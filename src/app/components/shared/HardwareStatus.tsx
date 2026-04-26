import { Usb } from 'lucide-react';
import { motion } from 'motion/react';

interface HardwareStatusProps {
  connected: boolean;
  deviceName?: string;
  variant?: 'badge' | 'inline';
  onClick?: () => void;
}

export function HardwareStatus({ connected, deviceName, variant = 'badge', onClick }: HardwareStatusProps) {
  const label = connected
    ? deviceName || 'Connected'
    : 'Disconnected';

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          connected ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {connected && (
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
        <span className="text-xs text-white/60">
          {label}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-95 ${
        connected 
          ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20' 
          : 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
      }`}
    >
      <Usb className={`w-4 h-4 ${
        connected ? 'text-emerald-400' : 'text-red-400'
      }`} />
      <span className={`text-xs font-medium ${
        connected ? 'text-emerald-400' : 'text-red-400'
      }`}>
        {label}
      </span>
      {connected && (
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </button>
  );
}