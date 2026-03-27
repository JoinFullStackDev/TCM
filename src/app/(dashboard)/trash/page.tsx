import Box from '@mui/material/Box';
import TrashView from '@/components/test-cases/TrashView';

export const metadata = { title: 'Trash — TestForge' };

export default function TrashPage() {
  return (
    <Box sx={{ p: 3 }}>
      <TrashView />
    </Box>
  );
}
