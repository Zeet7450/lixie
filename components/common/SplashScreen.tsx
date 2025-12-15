'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface SplashScreenProps {
  show: boolean;
  onComplete?: () => void;
}

export function SplashScreen({ show, onComplete }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-cream-200 dark:bg-slate-900"
          onAnimationComplete={(definition) => {
            // Call onComplete when exit animation finishes
            if (definition === 'exit' && onComplete) {
              onComplete();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative flex flex-col items-center justify-center"
          >
            {/* Logo Animation GIF */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
              <Image
                src="/animations/logo-animation.gif"
                alt="Lixie Logo Animation"
                fill
                className="object-contain"
                unoptimized // GIF animations need unoptimized
                priority
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
