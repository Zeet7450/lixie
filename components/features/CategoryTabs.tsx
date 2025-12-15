'use client';

import { motion } from 'framer-motion';
import { useAnimation } from '@/hooks/useAnimation';
import { categories } from '@/config/categories';
import { useLanguage } from '@/hooks/useLanguage';

interface CategoryTabsProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const { config } = useAnimation();
  const { t } = useLanguage();

  return (
    <motion.div
      className="sticky top-[64px] bg-cream-200/70 dark:bg-slate-900/70 glass backdrop-blur-md z-40 border-b border-gray-300/20 -mt-[1px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        ...config.Transitions.standard,
        delay: 0.2,
      } as any}
    >
      <motion.div
        className="relative flex gap-2 overflow-x-auto px-3 sm:px-4 pr-4 sm:pr-6 py-2 sm:py-3 scrollbar-hide snap-x snap-mandatory"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          staggerChildren: 0.03,
          delayChildren: 0.25,
        }}
        onAnimationComplete={() => {}}
        data-category-tabs
      >
        {categories.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            initial={{
              opacity: 0,
              x: -30,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={config.Transitions.standard as any}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative px-4 py-2 rounded-full font-medium whitespace-nowrap
              transition-all duration-300 snap-start flex-shrink-0
              ${
                activeCategory === category.id
                  ? 'text-rose-600 dark:text-rose-300'
                  : 'text-emerald-700 dark:text-cream-300 hover:text-emerald-900'
              }
            `}
          >
            <span className="flex items-center gap-2">
              <span>{category.icon}</span>
              <span>{t(`nav.${category.id}`) || category.label}</span>
            </span>

            {/* ACTIVE INDICATOR */}
            {activeCategory === category.id && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute inset-0 rounded-full bg-rose-200 dark:bg-rose-900/30 -z-10"
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
              />
            )}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

