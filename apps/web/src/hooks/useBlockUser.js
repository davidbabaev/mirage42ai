import { useAuth } from "../providers/AuthProvider";
import { useUsersProvider } from "../providers/UsersProvider";
import { useCardsProvider } from "../providers/CardsProvider";

// Block/unblock another user. On block we also drop their posts from the feed
// in place; the rest of the hiding (lists, suggestions, profile, messaging) is
// enforced server-side and reconciles on the next data fetch.
function useBlockUser() {
    const { handleToggleBlock, user } = useAuth();
    const { syncUser } = useUsersProvider();
    const { removeAuthorFromFeed } = useCardsProvider();

    const isBlockedByMe = (userId) => (user?.blocked || []).includes(userId);

    const toggleBlock = async (userId) => {
        if (!user) return null;
        const wasBlocked = isBlockedByMe(userId);
        const updated = await handleToggleBlock(userId);
        if (!updated) return null;
        // keep the current user in the users list in sync (following changed too)
        syncUser(updated);
        if (!wasBlocked) {
            // just blocked them — clear their posts from the feed immediately
            removeAuthorFromFeed(userId);
        }
        return updated;
    };

    return { toggleBlock, isBlockedByMe };
}

export default useBlockUser;
