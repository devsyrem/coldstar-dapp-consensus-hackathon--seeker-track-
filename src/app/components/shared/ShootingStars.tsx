import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface Star {
  id: number;
  startY: number;
  delay: number;
  duration: number;
}

export function ShootingStars() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate initial stars
    const initialStars: Star[] = Array.from({ length: 4 }, (_, i) => ({
      id: i,
      startY: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 2 + Math.random() * 1,
    }));
    setStars(initialStars);

    // Add new stars periodically
    const interval = setInterval(() => {
      setStars(prev => {
        const newStar: Star = {
          id: Date.now(),
          startY: Math.random() * 100,
          delay: 0,
          duration: 2 + Math.random() * 1,
        };
        return [...prev.slice(-3), newStar];
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          initial={{
            x: '-10vw',
            y: `${star.startY}vh`,
            opacity: 0,
          }}
          animate={{
            x: '110vw',
            y: `${star.startY - 70}vh`,
            opacity: [0, 0.2, 0.2, 0],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            repeatDelay: 10,
            ease: 'linear',
          }}
          className="absolute"
        >
          {/* Simple white line at 55 degree angle */}
          <div 
            className="w-16 h-[1px] bg-white"
            style={{ transform: 'rotate(-55deg)' }}
          />
        </motion.div>
      ))}
    </div>
  );
}