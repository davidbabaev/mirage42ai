import React, { createContext, useContext, useEffect, useState } from 'react'
import { getTheme } from '../theme/mirageTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material';

const ThemeContext = createContext()

// Persisted under the key "theme" as the STRING 'light' | 'dark' (not a raw
// boolean) so a future 'system' value (Layer 2) drops in without a format change.
const THEME_STORAGE_KEY = 'theme';

const readStoredTheme = () => {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
        // localStorage can be unavailable (private mode / SSR); fall back to light.
        return false;
    }
};

export function ThemeProvider({children}) {

    // Read synchronously in the initial state so the first paint is already
    // correct — reading in a useEffect would flash the default theme first.
    const[darkMode, setDarkMode] = useState(readStoredTheme);
    const handleToggle = () => {
        setDarkMode(!darkMode)
    }

    // Persist whenever the mode changes (and on mount, normalizing the stored
    // value to the canonical 'light'/'dark' string).
    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
        } catch {
            // Ignore: persistence is best-effort; the in-memory choice still works.
        }
    }, [darkMode]);

  return (
    <MuiThemeProvider theme={getTheme(darkMode)}>
        <CssBaseline/>
        <ThemeContext.Provider value={{darkMode, handleToggle}}>
            {children}
        </ThemeContext.Provider>
    </MuiThemeProvider>
  )
}

export function useThemeContext(){
    return useContext(ThemeContext);
}


