import { Variants, Easing } from 'framer-motion';

// Framer Motion v12 requires easing as arrays, not strings
export const Easings = {
  standard: [0.4, 0, 0.2, 1] as Easing,
  decelerate: [0, 0, 0.2, 1] as Easing,
  accelerate: [0.4, 0, 1, 1] as Easing,
  sharp: [0.4, 0, 0.6, 1] as Easing,
  softSpring: [0.16, 1, 0.3, 1] as Easing,
  bounceSpring: [0.34, 1.56, 0.64, 1] as Easing,
  smoothBounce: [0.25, 0.46, 0.45, 0.94] as Easing,
  linearSmooth: [0.25, 0.25, 0.75, 0.75] as Easing,
  easeIn: 'ease-in' as Easing,
  easeOut: 'ease-out' as Easing,
  easeInOut: 'ease-in-out' as Easing,
  linear: 'linear' as Easing,
};

export const Transitions = {
  instant: {
    duration: 0.05,
    ease: Easings.sharp,
  },
  micro: {
    duration: 0.15,
    ease: Easings.standard,
  },
  standard: {
    duration: 0.3,
    ease: Easings.softSpring,
  },
  pageTransition: {
    duration: 0.4,
    ease: Easings.softSpring,
  },
  complex: {
    duration: 0.5,
    ease: Easings.softSpring,
  },
  slow: {
    duration: 0.6,
    ease: Easings.softSpring,
  },
  spring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 1,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 15,
    mass: 1,
  },
};

export const InitialStates = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const AnimationVariants: Record<string, Variants> = {
  pageEnter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 40 },
  },
  slideDown: {
    initial: { opacity: 0, y: -40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 },
  },
  popIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  rotateIn: {
    initial: { opacity: 0, rotate: -10 },
    animate: { opacity: 1, rotate: 0 },
    exit: { opacity: 0, rotate: 10 },
  },
  cardHover: {
    initial: { y: 0, boxShadow: '0 4px 12px rgba(216, 191, 216, 0.15)' },
    whileHover: {
      y: -8,
      boxShadow: '0 12px 32px rgba(216, 191, 216, 0.25)',
      transition: Transitions.standard,
    },
    whileTap: {
      y: -4,
      scale: 0.98,
      transition: Transitions.micro,
    },
  },
  buttonPress: {
    initial: { scale: 1 },
    whileHover: {
      scale: 1.02,
      transition: Transitions.micro,
    },
    whileTap: {
      scale: 0.96,
      transition: Transitions.instant,
    },
  },
  pulse: {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: Easings.easeInOut,
      },
    },
  } as any,
  bounce: {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: Easings.easeInOut,
      },
    },
  } as any,
  float: {
    animate: {
      y: [0, -12, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: Easings.easeInOut,
      },
    },
  } as any,
  spin: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: Easings.linear,
      },
    },
  } as any,
};

export const ContainerVariants: Record<string, Variants> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
      ease: Easings.softSpring,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
} as any;

export const ContainerVariantsFast: Record<string, Variants> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
} as any;

export const ContainerVariantsSlow: Record<string, Variants> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
} as any;

export const ItemVariants: Record<string, Variants> = {
  default: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: Transitions.standard,
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: Transitions.micro,
    },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: Transitions.standard,
    },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: Transitions.standard,
    },
  },
  slide: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: Transitions.standard,
    },
  },
};

export const AnimationConfig = {
  Easings,
  Transitions,
  InitialStates,
  AnimationVariants,
  ContainerVariants,
  ContainerVariantsFast,
  ContainerVariantsSlow,
  ItemVariants,
};

export default AnimationConfig;
