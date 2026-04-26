import { motion } from 'motion/react';
import { Delete } from 'lucide-react';
import { hapticLight } from '../../../utils/mobile';

interface NumericKeypadProps {
  onNumberPress: (num: string) => void;
  onBackspace: () => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
}

export function NumericKeypad({ 
  onNumberPress, 
  onBackspace, 
  onBiometric,
  showBiometric = false 
}: NumericKeypadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showBiometric ? 'bio' : '', '0', 'backspace']
  ];

  const handlePress = (key: string) => {
    hapticLight();
    
    if (key === 'backspace') {
      onBackspace();
    } else if (key === 'bio' && onBiometric) {
      onBiometric();
    } else if (key && key !== 'bio') {
      onNumberPress(key);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {keys.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 mb-4 justify-center">
          {row.map((key, keyIndex) => {
            const uniqueKey = `${rowIndex}-${keyIndex}-${key || 'empty'}`;
            
            if (!key) {
              return <div key={uniqueKey} className="w-20 h-20" />;
            }

            if (key === 'backspace') {
              return (
                <motion.button
                  key={uniqueKey}
                  onClick={() => handlePress(key)}
                  whileTap={{ scale: 0.9 }}
                  className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center"
                >
                  <Delete className="w-6 h-6 text-white" />
                </motion.button>
              );
            }

            if (key === 'bio') {
              return (
                <motion.button
                  key={uniqueKey}
                  onClick={() => handlePress(key)}
                  whileTap={{ scale: 0.9 }}
                  className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                    />
                  </svg>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={uniqueKey}
                onClick={() => handlePress(key)}
                whileTap={{ scale: 0.9 }}
                className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center"
              >
                <span className="text-3xl font-light text-white">{key}</span>
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}