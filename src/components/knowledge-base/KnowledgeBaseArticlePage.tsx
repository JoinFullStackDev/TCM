'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import PageTransition from '@/components/animations/PageTransition';
import MarkdownRenderer from './MarkdownRenderer';
import type { KnowledgeBaseArticle } from '@/types/knowledge-base';

const FOLDER_LABELS: Record<string, string> = {
  general: 'General',
  features: 'Features',
};

interface KnowledgeBaseArticlePageProps {
  slug: string;
}

export default function KnowledgeBaseArticlePage({ slug }: KnowledgeBaseArticlePageProps) {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [article, setArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticle() {
      try {
        const res = await fetch('/api/knowledge-base');
        if (!res.ok) throw new Error('Failed to load');
        const data: KnowledgeBaseArticle[] = await res.json();
        const found = data.find((a) => a.slug === slug);
        if (!cancelled) {
          if (found) {
            setArticle(found);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticle();
    return () => { cancelled = true; };
  }, [slug]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (notFound || !article) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.disabled" gutterBottom>
          Article not found
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/knowledge-base')}
          sx={{ mt: 2 }}
        >
          Back to Knowledge Base
        </Button>
      </Box>
    );
  }

  const folderLabel = FOLDER_LABELS[article.folder] ?? article.folder;

  return (
    <PageTransition>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/knowledge-base')}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: alpha(palette.primary.main, 0.06) },
            }}
          >
            All Articles
          </Button>
          <Chip
            label={folderLabel}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(palette.primary.main, 0.1),
              color: palette.primary.light,
            }}
          />
        </Box>

        <MarkdownRenderer title={article.title} content={article.content} />
      </Box>
    </PageTransition>
  );
}
