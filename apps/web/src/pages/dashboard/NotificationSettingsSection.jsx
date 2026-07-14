import { useState } from 'react';
import {
    Box,
    Container,
    Divider,
    FormControlLabel,
    List,
    ListItem,
    Switch,
    Typography,
    Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuth } from '../../providers/authContext';
import { updateNotificationPrefs } from '../../services/apiService';

// Per-type labels and descriptions — matches Instagram / X settings patterns.
const PREF_CONFIG = [
    {
        key: 'likes',
        label: 'Likes',
        description: 'When someone likes your post',
    },
    {
        key: 'comments',
        label: 'Comments',
        description: 'When someone comments on your post',
    },
    {
        key: 'follows',
        label: 'Follows',
        description: 'When someone starts following you',
    },
    {
        key: 'commentLikes',
        label: 'Comment likes',
        description: 'When someone likes your comment',
    },
    {
        key: 'commentReplies',
        label: 'Comment replies',
        description: 'When someone replies to your comment',
    },
];

// Default: all true — mirrors the server-side schema defaults so the UI is
// correct even for accounts that pre-date this feature (no stored prefs yet).
const DEFAULT_PREFS = {
    likes: true,
    comments: true,
    follows: true,
    commentLikes: true,
    commentReplies: true,
};

export default function NotificationSettingsSection() {
    const { user, setUser } = useAuth();

    // Merge stored prefs with the all-true default so older accounts look correct.
    const storedPrefs = user?.notificationPrefs || {};
    const initialPrefs = { ...DEFAULT_PREFS, ...storedPrefs };

    const [prefs, setPrefs] = useState(initialPrefs);
    const [saving, setSaving] = useState(null); // key being saved, or null
    const [error, setError] = useState(null);

    const handleToggle = async (key) => {
        const newVal = !prefs[key];
        // Optimistic update so the toggle feels instant.
        setPrefs((prev) => ({ ...prev, [key]: newVal }));
        setSaving(key);
        setError(null);

        try {
            const updated = await updateNotificationPrefs({ [key]: newVal });
            // Sync updated user (incl. notificationPrefs) back into context and
            // localStorage so the state survives a page refresh.
            setUser((prev) => ({ ...prev, notificationPrefs: updated.notificationPrefs }));
        } catch (err) {
            // Roll back the optimistic update on failure.
            setPrefs((prev) => ({ ...prev, [key]: !newVal }));
            setError(err.message || 'Failed to save — please try again.');
        } finally {
            setSaving(null);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <NotificationsIcon color="primary" />
                <Typography variant="h6">Notification settings</Typography>
            </Box>
            <Typography color="text.secondary" fontSize={14} sx={{ mb: 2 }}>
                Choose which notifications you receive. Turning a type off stops new
                notifications of that type — existing ones are unaffected.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <List disablePadding>
                {PREF_CONFIG.map(({ key, label, description }, i) => (
                    <Box key={key}>
                        {i > 0 && <Divider component="li" />}
                        <ListItem
                            sx={{ px: 0, py: 1.5 }}
                            secondaryAction={
                                <Switch
                                    edge="end"
                                    checked={prefs[key]}
                                    disabled={saving === key}
                                    onChange={() => handleToggle(key)}
                                    slotProps={{
                                        input: { 'aria-label': label },
                                    }}
                                />
                            }
                        >
                            <Box>
                                <Typography fontWeight={500} fontSize={15}>
                                    {label}
                                </Typography>
                                <Typography color="text.secondary" fontSize={13}>
                                    {description}
                                </Typography>
                            </Box>
                        </ListItem>
                    </Box>
                ))}
            </List>
        </Container>
    );
}
