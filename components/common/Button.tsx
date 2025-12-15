'use client';

import { motion } from 'framer-motion';
import { useAnimation } from '@/hooks/useAnimation';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className, ...props }: ButtonProps) {
  const { config } = useAnimation();

  const variants = {
    primary: 'bg-rose-200 text-emerald-900 hover:bg-rose-300',
    secondary: 'border-2 border-rose-200 text-rose-200 hover:bg-rose-200/20',
    ghost: 'hover:bg-rose-200/30 text-emerald-700',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={config.Transitions.micro as any}
      className={cn(
        'px-6 py-2 rounded-full font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

