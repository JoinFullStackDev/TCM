'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => (
    <Typography variant="h4" fontWeight={700} mt={4} mb={1.5} color="text.primary">
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="h5" fontWeight={600} mt={3.5} mb={1} color="text.primary">
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="h6" fontWeight={600} mt={3} mb={1} color="text.primary">
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="subtitle1" fontWeight={600} mt={2.5} mb={0.5} color="text.primary">
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography variant="body1" mb={1.5} sx={{ lineHeight: 1.75, color: 'text.secondary' }}>
      {children}
    </Typography>
  ),
  a: ({ href, children }) => (
    <Link href={href ?? '#'} target="_blank" rel="noopener" underline="hover" color="primary">
      {children}
    </Link>
  ),
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        borderLeft: `3px solid ${palette.primary.main}`,
        pl: 2,
        ml: 0,
        my: 2,
        color: 'text.secondary',
        fontStyle: 'italic',
      }}
    >
      {children}
    </Box>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { color: 'text.secondary', mb: 0.5, lineHeight: 1.7 } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { color: 'text.secondary', mb: 0.5, lineHeight: 1.7 } }}>
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 3 }} />,
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <Paper
          component="pre"
          sx={{
            p: 2,
            my: 2,
            bgcolor: palette.background.surface2,
            border: `1px solid ${palette.divider}`,
            borderRadius: 1,
            overflow: 'auto',
            '& code': {
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              color: palette.text.primary,
            },
          }}
        >
          <code>{children}</code>
        </Paper>
      );
    }
    return (
      <Box
        component="code"
        sx={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.8125rem',
          bgcolor: alpha(palette.primary.main, 0.1),
          color: palette.primary.light,
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
        }}
      >
        {children}
      </Box>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <TableContainer
      component={Paper}
      sx={{
        my: 2,
        bgcolor: palette.background.surface2,
        border: `1px solid ${palette.divider}`,
      }}
    >
      <Table size="small">{children}</Table>
    </TableContainer>
  ),
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => (
    <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>{children}</TableRow>
  ),
  th: ({ children }) => (
    <TableCell
      sx={{
        fontWeight: 600,
        color: 'text.primary',
        borderColor: palette.divider,
        fontSize: '0.8125rem',
      }}
    >
      {children}
    </TableCell>
  ),
  td: ({ children }) => (
    <TableCell
      sx={{
        color: 'text.secondary',
        borderColor: palette.divider,
        fontSize: '0.8125rem',
      }}
    >
      {children}
    </TableCell>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
      {children}
    </Box>
  ),
  em: ({ children }) => (
    <Box component="em" sx={{ color: 'text.secondary' }}>
      {children}
    </Box>
  ),
};

interface MarkdownRendererProps {
  title: string;
  content: string;
}

export default function MarkdownRenderer({ title, content }: MarkdownRendererProps) {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={1} color="text.primary">
        {title}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}
