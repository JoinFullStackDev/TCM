export const palette = {
  background: {
    default: '#0A0A0F',
    paper: '#111118',
    surface2: '#1A1A24',
    surface3: '#222230',
  },

  primary: {
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4F46E5',
    contrastText: '#FFFFFF',
  },

  success: {
    main: '#14B8A6',
    light: '#2DD4BF',
    dark: '#0D9488',
    contrastText: '#FFFFFF',
  },

  error: {
    main: '#F43F5E',
    light: '#FB7185',
    dark: '#E11D48',
    contrastText: '#FFFFFF',
  },

  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
    contrastText: '#FFFFFF',
  },

  info: {
    main: '#A78BFA',
    light: '#C4B5FD',
    dark: '#7C3AED',
    contrastText: '#FFFFFF',
  },

  neutral: {
    main: '#64748B',
    light: '#94A3B8',
    dark: '#475569',
    contrastText: '#FFFFFF',
  },

  text: {
    primary: '#E8E8ED',
    secondary: '#8888A0',
    disabled: '#555566',
  },

  divider: 'rgba(100, 116, 139, 0.2)',
} as const;

export const semanticColors = {
  executionStatus: {
    pass: palette.success.main,
    fail: palette.error.main,
    blocked: palette.warning.main,
    skip: palette.neutral.main,
    not_run: palette.neutral.light,
  },

  automationStatus: {
    in_cicd: palette.success.main,
    scripted: palette.info.main,
    out_of_sync: palette.warning.main,
    not_automated: palette.neutral.main,
  },

  platform: {
    desktop: palette.primary.main,
    tablet: palette.info.main,
    mobile: palette.success.main,
  },

  role: {
    admin: palette.error.main,
    qa_engineer: palette.primary.main,
    sdet: palette.info.main,
    viewer: palette.neutral.main,
  },

  suiteColors: [
    palette.primary.main,
    palette.success.main,
    palette.info.main,
    palette.warning.main,
    palette.error.main,
  ],
} as const;
