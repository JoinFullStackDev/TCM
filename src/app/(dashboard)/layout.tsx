export const dynamic = 'force-dynamic';

import Box from '@mui/material/Box';
import { AuthProvider } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
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
    </AuthProvider>
  );
}
