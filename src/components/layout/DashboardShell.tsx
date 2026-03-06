'use client';

import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
