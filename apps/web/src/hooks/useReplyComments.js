import { useAuth } from "../providers/AuthProvider";
import { useCardsProvider } from "../providers/CardsProvider";

// Single-level replies on a comment, mirroring useLikedComments: a thin wrapper
// over the provider handler that no-ops when logged out.
function useReplyComments() {
    const { user } = useAuth();
    const { handleAddReply } = useCardsProvider();

    const addReply = (cardId, commentId, replyText) => {
        if (!user) return;
        return handleAddReply(cardId, commentId, replyText);
    };

    return { addReply };
}

export default useReplyComments;
