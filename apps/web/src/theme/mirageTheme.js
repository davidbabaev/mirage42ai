import { createTheme } from "@mui/material";

export function getTheme(isDark){
    return createTheme({
        palette: {
            mode: isDark ? 'dark' : 'light',
            primary: {
                main: '#7F77DD'
            },
            background: {
                default: isDark ? '#0D0D14' : '#FFFFFF',
                paper: isDark ? '#13131F' : '#FFFFFF'
            }
        }
    })
}