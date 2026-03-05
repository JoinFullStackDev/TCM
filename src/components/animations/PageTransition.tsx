'use client';

import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/lib/animations/variants';
import type { ReactNode } from 'react';

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransitionConfig}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  );
}
