import type { Variants, Transition } from 'framer-motion';

export const easing = {
  entrance: [0, 0, 0.2, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  morph: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const pageTransitionConfig: Transition = {
  duration: 0.3,
  ease: easing.entrance,
};

export const modalEntrance: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const modalTransitionConfig: Transition = {
  duration: 0.25,
  ease: easing.entrance,
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerChild: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easing.entrance },
  },
};

export const statusPulse: Variants = {
  pulse: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.2 },
  },
};

export const slideIn: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easing.entrance },
  },
  exit: {
    opacity: 0,
    x: 24,
    transition: { duration: 0.2, ease: easing.exit },
  },
};

export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    overflow: 'hidden',
    transition: { duration: 0.25, ease: easing.morph },
  },
};

export const sidebarIndicator: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: easing.entrance },
  },
};
