import { createContext, useContext } from 'react';

// The profile being VIEWED (not the logged-in user). UserProfileLayout resolves it
// once from GET /users/:id and shares it with the tab components, which used to
// each run their own `users.find(...)` against the global users array.
//
// One resolve, not five: the layout already gates rendering on the subject, so a
// tab can assume it exists.
export const ProfileSubjectContext = createContext(null);

export const useProfileSubject = () => useContext(ProfileSubjectContext);
