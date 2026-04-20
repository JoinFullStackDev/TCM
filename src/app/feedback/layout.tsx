import type { ReactNode } from 'react';

// Minimal layout — no AuthProvider, no sidebar, no dashboard shell
export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
