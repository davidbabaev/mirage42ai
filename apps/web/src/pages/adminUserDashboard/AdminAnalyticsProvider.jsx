import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getAllUsers, getAllCards } from '../../services/apiService';
import { AdminAnalyticsDataContext } from './hooks/adminAnalyticsContext';

// Loads the analytics dataset (all users + all cards) when the admin Overview panel
// mounts, and hands it to the analytics components through context.
//
// This is what lets UsersProvider/CardsProvider stop loading both collections at APP
// mount for every visitor: the only surface that genuinely needs the whole dataset
// is this admin panel, so it fetches its own data, on demand, admin-only.
export default function AdminAnalyticsProvider({ children }) {
    const [data, setData] = useState({ users: [], cards: [], loading: true, error: null });

    useEffect(() => {
        let cancelled = false;
        Promise.all([getAllUsers(), getAllCards()])
            .then(([users, cards]) => {
                if (cancelled) return;
                setData({ users: users ?? [], cards: cards ?? [], loading: false, error: null });
            })
            .catch(err => {
                if (cancelled) return;
                setData({ users: [], cards: [], loading: false, error: err.message || 'Failed to load analytics' });
            });
        return () => { cancelled = true; };
    }, []);

    if (data.loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (data.error) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography color='error'>Couldn't load the analytics.</Typography>
            </Box>
        );
    }

    return (
        <AdminAnalyticsDataContext.Provider value={data}>
            {children}
        </AdminAnalyticsDataContext.Provider>
    );
}
