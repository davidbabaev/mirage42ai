import { useAuth } from "../providers/authContext";
import { useUsersProvider } from "../providers/usersContext";
import { useCardsProvider } from "../providers/cardsContext";

// Module-level in-flight guard, shared across every component using this hook:
// a follow/unfollow request for a given user id ignores re-entry until it
// settles. Belt-and-suspenders on top of the atomic server fix — a rapid
// double-click can't fire two toggles that race each other.
const inFlightFollows = new Set();

function useFollowUser() {

  const{ handleToggleFollow, user} = useAuth();
  const {userOverlay, patchUser} = useUsersProvider();
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
            // The server returns MY updated record; AuthProvider stores it, so the
            // follow button flips without a refetch (no re-render storm, no scroll
            // jump). It used to also be patched into the global users array — that
            // array is gone; the target's follower count goes in the overlay below.
            const updatedUser = await handleToggleFollow(userId);
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

    // Takes the user OBJECT. Resolution order:
    //   1. the overlay — carries the count I just changed by following/unfollowing,
    //      so it reflects on every surface without a refetch;
    //   2. the server-computed `followersCount` on the user object itself.
    // (The third source used to be a scan of the fully-loaded users array. That
    // array is gone, and with it the reason this ever needed one.)
    const getFollowersCount = (userOrId) => {
        const id = (userOrId && typeof userOrId === 'object') ? userOrId._id : userOrId;

        const overlaid = userOverlay?.[id]?.followersCount;
        if (typeof overlaid === 'number') return overlaid;

        if (userOrId && typeof userOrId === 'object' && typeof userOrId.followersCount === 'number') {
            return userOrId.followersCount;
        }

        return 0;
    }

  return {toggleFollow, isFollowByMe, getFollowersCount}
}

export default useFollowUser;
