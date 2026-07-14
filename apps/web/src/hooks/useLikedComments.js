import { useAuth } from "../providers/authContext";
import { useCardsProvider } from "../providers/cardsContext";

// Comment-level likes, mirroring useLikedCards but operating on an embedded
// comment. The helpers take the comment object directly (it's already in hand
// where comments are mapped), so there's no extra lookup.
function useLikedComments() {
    const { user } = useAuth();
    const { handleToggleCommentLike } = useCardsProvider();

    // Takes the card OBJECT (not its id) so the optimistic flip can seed the
    // overlay when the card isn't already in it.
    const toggleCommentLike = (card, commentId) => {
        if (!user) return;
        return handleToggleCommentLike(card, commentId);
    };

    const isCommentLikedByMe = (comment) => (comment?.likes || []).includes(user?._id);

    const getCommentLikeCount = (comment) => (comment?.likes || []).length;

    return { toggleCommentLike, isCommentLikedByMe, getCommentLikeCount };
}

export default useLikedComments;
