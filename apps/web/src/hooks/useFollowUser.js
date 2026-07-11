import { useAuth } from "../providers/AuthProvider";
import { useUsersProvider } from "../providers/UsersProvider";
import { useCardsProvider } from "../providers/CardsProvider";

// Module-level in-flight guard, shared across every component using this hook:
// a follow/unfollow request for a given user id ignores re-entry until it
// settles. Belt-and-suspenders on top of the atomic server fix — a rapid
// double-click can't fire two toggles that race each other.
const inFlightFollows = new Set();

function useFollowUser() {

  const{ handleToggleFollow, user} = useAuth();
  const {users, syncUser} = useUsersProvider();
  const {removeAuthorFromFeed, addAuthorToFeed} = useCardsProvider();

    // toggle Follow

    const toggleFollow = async (userId) => {
        if(!user) return false;
        // Ignore re-entry while a request for this user is already in flight.
        if(inFlightFollows.has(userId)) return;
        inFlightFollows.add(userId);
        try {
            // Update in place: patch the current user in the users list with the
            // server's response, so the button and counts update without a full
            // re-fetch (which caused re-renders / scroll jump).
            const updatedUser = await handleToggleFollow(userId);
            syncUser(updatedUser);
            if (!updatedUser) return;
            // Reflect the change in the feed in place — no refetch, no scroll reset.
            // Follow -> add their posts; unfollow -> drop them.
            if ((updatedUser.following || []).includes(userId)) {
                addAuthorToFeed(userId);
            } else {
                removeAuthorFromFeed(userId);
            }
        } finally {
            inFlightFollows.delete(userId);
        }
    }

    // isFollow by me
    const isFollowByMe = (userId) => {
        if(!user) return false;
        return (user?.following || []).includes(userId)
    }

    // get following Count — distinct-safe so a corrupt array (duplicate ids)
    // can never read as inflated.
    const getFollowingCount = (userId) => {
        const foundUser = users.find(user => user._id === userId);
        if(!foundUser) return 0;
        return new Set(foundUser?.following || []).size
    }

    // Takes the user OBJECT: prefer the server-computed `followersCount` (attached
    // to every user response) so no global users scan is needed. Falls back to
    // scanning the loaded users array by id only when the server count is absent
    // (e.g. the logged-in user's own object from login, which omits it) — that
    // fallback disappears once the global users load is retired.
    const getFollowersCount = (userOrId) => {
        if (userOrId && typeof userOrId === 'object') {
            if (typeof userOrId.followersCount === 'number') return userOrId.followersCount;
            userOrId = userOrId._id;
        }
        if(!users) return 0;
        return users.filter(userU => (userU.following || []).includes(userOrId)).length;
    }

  return {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} 
}

export default useFollowUser;
