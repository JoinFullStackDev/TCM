'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Fuse from 'fuse.js';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import PageTransition from '@/components/animations/PageTransition';
import type { KnowledgeBaseArticle } from '@/types/knowledge-base';

const FOLDER_LABELS: Record<string, string> = {
  general: 'General',
  features: 'Features',
};

const FOLDER_DESCRIPTIONS: Record<string, string> = {
  general: 'Project overview, architecture, design system, and technical references',
  features: 'Detailed specifications for MVP and future features',
};

function extractPreview(content: string, maxLength = 160): string {
  const withoutTitle = content.replace(/^#\s+.+\n+/, '');
  const withoutHeadings = withoutTitle.replace(/^#{1,6}\s+.+$/gm, '');
  const plain = withoutHeadings
    .replace(/[`*_~\[\]()>]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s\S*$/, '') + '...';
}

export default function KnowledgeBaseView() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<KnowledgeBaseArticle[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      try {
        const res = await fetch('/api/knowledge-base');
        if (!res.ok) throw new Error('Failed to load knowledge base');
        const data: KnowledgeBaseArticle[] = await res.json();
        if (!cancelled) {
          setArticles(data);
          setFiltered(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchArticles();
    return () => { cancelled = true; };
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(articles, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'content', weight: 1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [articles],
  );

  const handleSearch = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setFiltered(articles);
        return;
      }
      setFiltered(fuse.search(value.trim()).map((r) => r.item));
    },
    [fuse, articles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => handleSearch(value), 200);
    },
    [handleSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setFiltered(articles);
  }, [articles]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isSearching = query.trim().length > 0;

  const groups = useMemo(() => {
    const map = new Map<string, KnowledgeBaseArticle[]>();
    for (const article of filtered) {
      if (!map.has(article.folder)) map.set(article.folder, []);
      map.get(article.folder)!.push(article);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'general') return -1;
      if (b === 'general') return 1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Hero + sticky search */}
        <Box
          sx={{
            position: 'sticky',
            top: -24,
            zIndex: 10,
            bgcolor: 'background.default',
            mx: -3,
            px: 3,
            pt: 3,
            pb: 0,
          }}
        >
          <Box
            sx={{
              maxWidth: 1024,
              mx: 'auto',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              border: `1px solid ${palette.divider}`,
              bgcolor: palette.background.paper,
              px: { xs: 3, md: 5 },
              pt: { xs: 4, md: 5 },
              pb: { xs: 3, md: 4 },
              mb: 0,
              background: `radial-gradient(ellipse at 20% 0%, ${alpha(palette.primary.main, 0.08)} 0%, transparent 60%),
                           radial-gradient(ellipse at 80% 100%, ${alpha(palette.info.main, 0.06)} 0%, transparent 50%),
                           ${palette.background.paper}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: alpha(palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MenuBookOutlinedIcon sx={{ fontSize: 22, color: palette.primary.main }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} color="text.primary">
                  Knowledge Base
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 520 }}>
              Search through project documentation, feature specs, design system references, and technical guides.
            </Typography>

            <TextField
              value={query}
              onChange={handleChange}
              placeholder="Search all articles..."
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton onClick={handleClear} size="small" edge="end">
                        <ClearIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: alpha(palette.background.default, 0.6),
                  backdropFilter: 'blur(8px)',
                  '& fieldset': { borderColor: alpha(palette.primary.main, 0.15) },
                  '&:hover fieldset': { borderColor: alpha(palette.primary.main, 0.35) },
                  '&.Mui-focused fieldset': { borderColor: palette.primary.main },
                },
              }}
            />

            {isSearching && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{query.trim()}&rdquo;
              </Typography>
            )}

            {!isSearching && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
                {articles.length} articles across {new Set(articles.map((a) => a.folder)).size} categories
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ height: 24 }} />

        {/* No results */}
        {filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2, opacity: 0.4 }} />
            <Typography variant="h6" color="text.disabled">
              No articles found
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Try a different search term
            </Typography>
          </Box>
        )}

        {/* Article groups */}
        {groups.map(([folder, items]) => {
          const label = FOLDER_LABELS[folder] ?? folder.charAt(0).toUpperCase() + folder.slice(1);
          const description = FOLDER_DESCRIPTIONS[folder];

          return (
            <Box key={folder} sx={{ mb: 4 }}>
              {!isSearching && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {label}
                    </Typography>
                    {description && (
                      <Typography variant="caption" color="text.secondary">
                        {description}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={items.length}
                    size="small"
                    sx={{
                      ml: 'auto',
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      bgcolor: alpha(palette.primary.main, 0.1),
                      color: palette.primary.light,
                    }}
                  />
                </Box>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 1.5,
                }}
              >
                {items.map((article) => (
                  <Paper
                    key={article.slug}
                    onClick={() => router.push(`/knowledge-base/${article.slug}`)}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: 'background.paper',
                      border: `1px solid ${palette.divider}`,
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      transition: 'border-color 0.15s, background-color 0.15s, transform 0.15s',
                      '&:hover': {
                        borderColor: alpha(palette.primary.main, 0.4),
                        bgcolor: alpha(palette.primary.main, 0.03),
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          bgcolor: alpha(palette.primary.main, 0.08),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionOutlinedIcon sx={{ fontSize: 16, color: palette.primary.main }} />
                      </Box>
                      {isSearching && (
                        <Chip
                          label={FOLDER_LABELS[article.folder] ?? article.folder}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            bgcolor: alpha(palette.neutral.main, 0.1),
                            color: palette.neutral.light,
                          }}
                        />
                      )}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight={600}
                        color="text.primary"
                        sx={{
                          mb: 0.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.4,
                        }}
                      >
                        {article.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {extractPreview(article.content, 120)}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </PageTransition>
  );
}
