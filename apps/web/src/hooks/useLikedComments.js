import { useAuth } from "../providers/AuthProvider";
import { useCardsProvider } from "../providers/CardsProvider";

// Comment-level likes, mirroring useLikedCards but operating on an embedded
// comment. The helpers take the comment object directly (it's already in hand
// where comments are mapped), so there's no extra lookup.
function useLikedComments() {
    const { user } = useAuth();
    const { handleToggleCommentLike } = useCardsProvider();

    const toggleCommentLike = (cardId, commentId) => {
        if (!user) return;
        return handleToggleCommentLike(cardId, commentId);
    };

    const isCommentLikedByMe = (comment) => (comment?.likes || []).includes(user?._id);

    const getCommentLikeCount = (comment) => (comment?.likes || []).length;

    return { toggleCommentLike, isCommentLikedByMe, getCommentLikeCount };
}

export default useLikedComments;
