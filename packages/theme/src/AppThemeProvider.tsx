import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { createAppTheme } from './createTheme.js';
import type { AppSurface } from './createTheme.js';
import { FONT_MONO } from './fonts.js';

export interface AppThemeProviderProps {
  children: ReactNode;
  surface?: AppSurface;
  highContrast?: boolean;
}

/**
 * Theme + baseline in one component.
 *
 * The apps import this from the shared package instead of reaching for
 * `@mui/material/styles` themselves: that specifier is the only barrel-ish MUI
 * entry, and keeping it inside packages/theme means the two apps can use
 * exact-path MUI imports exclusively (docs/eChallan_DESIGN.md section 10).
 */
export function AppThemeProvider({
  children,
  surface = 'tablet',
  highContrast = false,
}: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={createAppTheme({ surface, highContrast })}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '.echallan-identifier-field, .echallan-identifier-field input, .echallan-identifier-field textarea':
            {
              fontFamily: `${FONT_MONO} !important`,
              fontWeight: 500,
              letterSpacing: '0.01em',
            },
        }}
      />
      {children}
    </ThemeProvider>
  );
}
