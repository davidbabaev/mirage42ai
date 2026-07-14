import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import CheckIcon from '@mui/icons-material/Check';
import { useThemeContext } from '../providers/themeContext';

// Single shared theme control used by BOTH the main NavBar and the AdminNavBar
// so the Light/Dark/System choice can't drift between them. Modeled on the
// existing anchored-menu idiom in ChatHeader.jsx. The trigger keeps the original
// single-icon footprint (resolved sun/moon) so it doesn't widen the nav cluster,
// important on the ~390px mobile nav.
const OPTIONS = [
    { value: 'light', label: 'Light', Icon: LightModeIcon },
    { value: 'dark', label: 'Dark', Icon: DarkModeIcon },
    { value: 'system', label: 'System', Icon: SettingsBrightnessIcon },
];

export default function ThemeMenu() {
    const { darkMode, themeSelection, setThemeSelection } = useThemeContext();
    const [anchorEl, setAnchorEl] = useState(null);
    const handleOpen = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const select = (value) => {
        setThemeSelection(value);
        handleClose();
    };

    return (
        <>
            <Tooltip title="Theme">
                <IconButton
                    onClick={handleOpen}
                    aria-label="Theme"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                    {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                {OPTIONS.map((opt) => {
                    const selected = themeSelection === opt.value;
                    const Icon = opt.Icon;
                    return (
                        <MenuItem key={opt.value} selected={selected} onClick={() => select(opt.value)}>
                            <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
                            <ListItemText>{opt.label}</ListItemText>
                            {selected && <CheckIcon fontSize="small" sx={{ ml: 2 }} />}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
