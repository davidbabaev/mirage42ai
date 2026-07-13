import { createContext, useContext } from 'react';

// The admin analytics dataset (all users + all cards), fetched ON DEMAND when the
// admin Overview panel mounts.
//
// The analytics do genuinely need the whole collections — they compute totals,
// distributions and rankings across every user and post. What was wrong was WHERE
// that came from: the global UsersProvider/CardsProvider, which loaded both
// collections at APP MOUNT for every visitor, so a logged-in user who never opens
// the admin dashboard was still paying for the entire database.
//
// Now the cost lands only on an admin who actually opens the panel.
export const AdminAnalyticsDataContext = createContext({ users: [], cards: [], loading: true });

export const useAdminAnalyticsData = () => useContext(AdminAnalyticsDataContext);
