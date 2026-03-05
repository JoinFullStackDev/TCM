'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface AutocompleteSuggestion {
  description: string;
  test_data: string | null;
  expected_result: string | null;
}

interface StepAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  projectId?: string;
  label?: string;
  disabled?: boolean;
}

export default function StepAutocomplete({
  value,
  onChange,
  onSelect,
  projectId,
  label = 'Description',
  disabled,
}: StepAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const params = new URLSearchParams({ q: query });
        if (projectId) params.set('project_id', projectId);

        const res = await fetch(`/api/test-steps/autocomplete?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        setSuggestions([]);
      }
    },
    [projectId],
  );

  const handleChange = (newValue: string) => {
    onChange(newValue);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelect = (suggestion: AutocompleteSuggestion) => {
    onSelect(suggestion);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const highlightMatch = (text: string, query: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <Box component="span" sx={{ color: palette.primary.main, fontWeight: 600 }}>
          {text.slice(idx, idx + query.length)}
        </Box>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <TextField
        label={label}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        fullWidth
        multiline
        minRows={1}
        maxRows={4}
        size="small"
        disabled={disabled}
      />

      {showDropdown && suggestions.length > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 200,
            overflow: 'auto',
            mt: 0.5,
            bgcolor: 'background.paper',
            border: `1px solid ${palette.divider}`,
          }}
        >
          {suggestions.map((s, i) => (
            <Box
              key={i}
              onClick={() => handleSelect(s)}
              sx={{
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                bgcolor: i === selectedIndex ? alpha(palette.primary.main, 0.08) : 'transparent',
                '&:hover': { bgcolor: alpha(palette.primary.main, 0.06) },
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                {highlightMatch(s.description, value)}
              </Typography>
              {s.expected_result && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Expected: {s.expected_result}
                </Typography>
              )}
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
