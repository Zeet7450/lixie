'use client';

import { useEffect, useState } from 'react';
import { AnimationConfig } from '@/lib/animations';
import { Transition, Easing } from 'framer-motion';

export function useAnimation() {
  const [isAnimationReduced, setIsAnimationReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsAnimationReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsAnimationReduced(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const getTransition = (transition: Transition | undefined): Transition | undefined => {
    if (isAnimationReduced) {
      return {
        ...transition,
        duration: 0.01,
      };
    }
    // Ensure ease is correctly typed
    if (transition && transition.ease) {
      return {
        ...transition,
        ease: transition.ease as Easing,
      };
    }
    return transition;
  };

  return {
    config: AnimationConfig,
    isAnimationReduced,
    getTransition,
  };
}

export function usePageTransition() {
  const { config, getTransition } = useAnimation();

  const variant = config.AnimationVariants.pageEnter;

  return {
    initial: variant.initial as any,
    animate: variant.animate as any,
    exit: variant.exit as any,
    transition: getTransition(config.Transitions.pageTransition) as any,
  };
}

export function useStaggerAnimation(type: 'default' | 'fast' | 'slow' = 'default') {
  const { config } = useAnimation();

  const containerMap = {
    default: config.ContainerVariants,
    fast: config.ContainerVariantsFast,
    slow: config.ContainerVariantsSlow,
  };

  return {
    container: containerMap[type] as any,
    item: config.ItemVariants.default as any,
  };
}
