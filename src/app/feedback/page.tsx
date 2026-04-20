import Box from '@mui/material/Box';
import FeedbackForm from '@/components/feedback/FeedbackForm';

export const metadata = {
  title: 'Submit Feedback — TestForge',
  description: 'Submit a bug report or feature request',
};

export default function FeedbackPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        py: { xs: 2, sm: 4 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 680 }}>
        <FeedbackForm />
      </Box>
    </Box>
  );
}
