import React, { useState } from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { reportCard } from '../../services/apiService';

const REASONS = [
    { value: 'spam',          label: 'Spam' },
    { value: 'harassment',    label: 'Harassment' },
    { value: 'nudity',        label: 'Nudity or sexual content' },
    { value: 'hate',          label: 'Hate speech' },
    { value: 'violence',      label: 'Violence' },
    { value: 'misinformation', label: 'False information' },
    { value: 'other',         label: 'Other' },
];

/**
 * ReportPostDialog — reason-picker dialog for reporting a post.
 *
 * Props:
 *   open        — controlled open state
 *   onClose     — called when the dialog should close (Cancel or Esc)
 *   cardId      — the card being reported
 *   onSuccess   — called with (alreadyReported: boolean) after a successful API call
 */
export default function ReportPostDialog({ open, onClose, cardId, onSuccess }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const theme = useTheme();
    const fullWidth = useMediaQuery(theme.breakpoints.down('sm'));

    const handleClose = () => {
        if (submitting) return;
        setReason('');
        setError('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!reason || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const result = await reportCard(cardId, reason);
            // Reset and close — let parent handle toast + UI state.
            setReason('');
            onSuccess(result?.alreadyReported === true);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="xs"
            // Full-width on mobile, centered on desktop (handled by MUI Dialog + maxWidth)
            PaperProps={{
                sx: {
                    ...(fullWidth && { mx: 2 }),
                },
            }}
            aria-labelledby="report-dialog-title"
        >
            <DialogTitle id="report-dialog-title">Report post</DialogTitle>

            <DialogContent>
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                    <FormLabel
                        component="legend"
                        sx={{ mb: 1, fontSize: 14, color: 'text.secondary' }}
                    >
                        Why are you reporting this post?
                    </FormLabel>

                    <RadioGroup
                        aria-label="Report reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    >
                        {REASONS.map(({ value, label }) => (
                            <FormControlLabel
                                key={value}
                                value={value}
                                control={<Radio />}
                                label={label}
                                sx={{
                                    // Finger-friendly tap target on mobile
                                    minHeight: 44,
                                    alignItems: 'center',
                                }}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>

                {error && (
                    <Typography color="error" fontSize={13} mt={1}>
                        {error}
                    </Typography>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={!reason || submitting}
                    onClick={handleSubmit}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {submitting ? 'Submitting…' : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
