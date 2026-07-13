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
  const {users, syncUser, userOverlay, patchUser} = useUsersProvider();
  const {removeAuthorFromFeed, addAuthorToFeed} = useCardsProvider();

    // toggle Follow
    //
    // Accepts the user OBJECT or a bare id. Given the object we can also keep the
    // TARGET's follower count right across every surface: that count used to be
    // derived by scanning the global users array (which syncUser patched), and with
    // that array gone the only place to record "+1 follower" is the user overlay.

    const toggleFollow = async (target) => {
        if(!user) return false;
        const userId = (target && typeof target === 'object') ? target._id : target;
        if(!userId) return;
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

            const nowFollowing = (updatedUser.following || []).includes(userId);

            // Record the target's new follower count in the overlay, so it reflects
            // on every surface showing them (profile header, cards, people lists).
            if (target && typeof target === 'object') {
                const base = getFollowersCount(target);
                patchUser(userId, {
                    followersCount: Math.max(0, nowFollowing ? base + 1 : base - 1),
                });
            }

            // Reflect the change in the feed in place — no refetch, no scroll reset.
            // Follow -> add their posts; unfollow -> drop them.
            if (nowFollowing) {
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

    // Takes the user OBJECT (or an id). Resolution order:
    //   1. the overlay — carries the count I just changed by following/unfollowing,
    //      so it reflects on every surface without a refetch;
    //   2. the server-computed `followersCount` on the user object itself;
    //   3. (legacy) a scan of the loaded users array — removed with the global load.
    const getFollowersCount = (userOrId) => {
        const id = (userOrId && typeof userOrId === 'object') ? userOrId._id : userOrId;

        const overlaid = userOverlay?.[id]?.followersCount;
        if (typeof overlaid === 'number') return overlaid;

        if (userOrId && typeof userOrId === 'object' && typeof userOrId.followersCount === 'number') {
            return userOrId.followersCount;
        }

        if(!users) return 0;
        return users.filter(userU => (userU.following || []).includes(id)).length;
    }

  return {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} 
}

export default useFollowUser;
