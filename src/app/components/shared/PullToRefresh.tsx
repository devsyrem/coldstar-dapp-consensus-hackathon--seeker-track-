import { useState, useRef, TouchEvent } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const threshold = 80;

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  };

  const rotation = (pullDistance / threshold) * 360;
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        style={{
          height: isRefreshing ? threshold : pullDistance,
          opacity: isRefreshing ? 1 : opacity,
        }}
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div
          animate={isRefreshing ? { rotate: 360 } : { rotate: rotation }}
          transition={
            isRefreshing
              ? { duration: 1, repeat: Infinity, ease: 'linear' }
              : { duration: 0 }
          }
        >
          <RefreshCw className="w-6 h-6 text-white/60" />
        </motion.div>
      </motion.div>
      <motion.div
        style={{
          transform: `translateY(${isRefreshing ? 0 : pullDistance}px)`,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
