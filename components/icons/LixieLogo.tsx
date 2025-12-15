'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface LixieLogoProps {
  size?: number;
  className?: string;
}

export function LixieLogo({ size = 40, className = '' }: LixieLogoProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      whileHover={{ rotate: 5, scale: 1.05 }}
      transition={{ duration: 0.3 }}
    >
      <Image
        src="/images/logo-lixie.png"
        alt="Lixie Logo"
        width={size}
        height={size}
        priority
        className="object-contain"
      />
    </motion.div>
  );
}
