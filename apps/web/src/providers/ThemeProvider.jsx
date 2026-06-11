import React, { createContext, useContext, useState } from 'react'
import { getTheme } from '../theme/mirageTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material';

const ThemeContext = createContext()

export function ThemeProvider({children}) {

    const[darkMode, setDarkMode] = useState(false);
    const handleToggle = () => {
        setDarkMode(!darkMode)
    }

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


