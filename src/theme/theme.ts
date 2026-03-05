'use client';

import { createTheme, alpha } from '@mui/material/styles';
import { palette } from './palette';

declare module '@mui/material/styles' {
  interface TypeBackground {
    surface2: string;
    surface3: string;
  }
  interface Palette {
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    neutral: true;
  }
}

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    background: {
      default: palette.background.default,
      paper: palette.background.paper,
      surface2: palette.background.surface2,
      surface3: palette.background.surface3,
    },
    primary: palette.primary,
    secondary: palette.info,
    success: palette.success,
    error: palette.error,
    warning: palette.warning,
    info: palette.info,
    text: palette.text,
    divider: palette.divider,
    neutral: palette.neutral,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.025em' },
    h3: { fontWeight: 600, fontSize: '1.25rem' },
    h4: { fontWeight: 600, fontSize: '1.125rem' },
    h5: { fontWeight: 600, fontSize: '1rem' },
    h6: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', color: palette.text.secondary },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background.default,
          scrollbarWidth: 'thin',
          scrollbarColor: `${palette.neutral.dark} transparent`,
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${palette.divider}`,
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: palette.background.paper,
          border: `1px solid ${palette.divider}`,
          borderRadius: 8,
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: '0.8125rem',
        },
        containedPrimary: {
          '&:hover': {
            boxShadow: `0 0 16px ${alpha(palette.primary.main, 0.4)}`,
          },
        },
        containedError: {
          '&:hover': {
            boxShadow: `0 0 16px ${alpha(palette.error.main, 0.4)}`,
          },
        },
        outlined: {
          borderColor: alpha(palette.primary.main, 0.5),
          '&:hover': {
            borderColor: palette.primary.main,
            backgroundColor: alpha(palette.primary.main, 0.08),
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
        filled: {
          border: 'none',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha(palette.background.surface3, 0.95),
          backdropFilter: 'blur(8px)',
          border: `1px solid ${palette.divider}`,
          fontSize: '0.75rem',
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: palette.background.surface2,
          border: `1px solid ${palette.divider}`,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.paper,
          backgroundImage: 'none',
          border: `1px solid ${palette.divider}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.paper,
          backgroundImage: 'none',
          borderRight: `1px solid ${palette.divider}`,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: palette.divider,
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          '&.Mui-selected': {
            backgroundColor: alpha(palette.primary.main, 0.15),
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, 0.2),
            },
          },
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.08),
          },
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: palette.background.surface2,
            fontWeight: 600,
            color: palette.text.primary,
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha(palette.primary.main, 0.08),
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: alpha(palette.neutral.main, 0.15),
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.background.surface2,
          backgroundImage: 'none',
          border: `1px solid ${palette.divider}`,
        },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(palette.neutral.main, 0.15),
        },
      },
    },
  },
});

export default theme;
