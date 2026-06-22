import React, { createContext, useContext, useEffect, useState } from 'react'
import { getTheme } from '../theme/mirageTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { CssBaseline, useMediaQuery } from '@mui/material';

const ThemeContext = createContext()

// The user's SELECTION is persisted under "theme" as the string 'light' | 'dark'
// | 'system' (default 'system'). A pre-existing 'light'/'dark' (written by Layer
// 1) is honored as an explicit choice; only an absent/unrecognized value falls
// back to 'system'. The resolved 'system' value follows the OS live (Layer 3
// will sync this same string to the account).
const THEME_STORAGE_KEY = 'theme';
const VALID_SELECTIONS = ['light', 'dark', 'system'];
const OS_DARK_QUERY = '(prefers-color-scheme: dark)';

const readStoredSelection = () => {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY);
        return VALID_SELECTIONS.includes(raw) ? raw : 'system';
    } catch {
        // localStorage can be unavailable (private mode / SSR); default to system.
        return 'system';
    }
};

// Synchronous OS read for the initial paint, guarded for environments without
// matchMedia (jsdom / SSR) — mirrors VideoCoordinatorProvider's guard.
const systemPrefersDarkSync = () => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia(OS_DARK_QUERY).matches;
    }
    return false;
};

const resolveDark = (selection, osDark) =>
    selection === 'system' ? osDark : selection === 'dark';

export function ThemeProvider({children}) {

    // Read selection synchronously so the very first paint is already correct —
    // reading in a useEffect would flash the default theme first. For 'system',
    // the initializer resolves the OS preference synchronously too (no flash).
    const [themeSelection, setThemeSelection] = useState(readStoredSelection);

    // After mount, useMediaQuery keeps 'system' following the OS live. Its
    // default value matches the synchronous read above so the first render is
    // consistent with the initializer.
    const systemPrefersDark = useMediaQuery(OS_DARK_QUERY, {
        defaultMatches: systemPrefersDarkSync(),
    });

    const darkMode = resolveDark(themeSelection, systemPrefersDark);

    // Convenience kept for back-compat: flip between explicit light/dark.
    const handleToggle = () => {
        setThemeSelection(darkMode ? 'light' : 'dark');
    };

    // Persist the SELECTION string (never the resolved boolean, which would
    // clobber 'system'). Best-effort.
    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, themeSelection);
        } catch {
            // Ignore: persistence is best-effort; the in-memory choice still works.
        }
    }, [themeSelection]);

  return (
    <MuiThemeProvider theme={getTheme(darkMode)}>
        <CssBaseline/>
        <ThemeContext.Provider value={{darkMode, themeSelection, setThemeSelection, handleToggle}}>
            {children}
        </ThemeContext.Provider>
    </MuiThemeProvider>
  )
}

export function useThemeContext(){
    return useContext(ThemeContext);
}
