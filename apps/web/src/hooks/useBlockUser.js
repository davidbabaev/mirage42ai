import { useAuth } from "../providers/authContext";
import { useCardsProvider } from "../providers/cardsContext";

// Block/unblock another user. On block we also drop their posts from the feed
// in place; the rest of the hiding (lists, suggestions, profile, messaging) is
// enforced server-side and reconciles on the next data fetch.
function useBlockUser() {
    const { handleToggleBlock, user } = useAuth();
    const { removeAuthorFromFeed } = useCardsProvider();

    const isBlockedByMe = (userId) => (user?.blocked || []).includes(userId);

    const toggleBlock = async (userId) => {
        if (!user) return null;
        const wasBlocked = isBlockedByMe(userId);
        // AuthProvider stores my updated record (blocked + following changed). It
        // used to also be patched into the global users array, which no longer exists.
        const updated = await handleToggleBlock(userId);
        if (!updated) return null;
        if (!wasBlocked) {
            // just blocked them — clear their posts from the feed immediately
            removeAuthorFromFeed(userId);
        }
        return updated;
    };

    return { toggleBlock, isBlockedByMe };
}

export default useBlockUser;
