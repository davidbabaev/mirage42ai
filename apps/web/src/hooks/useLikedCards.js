import { useAuth } from "../providers/AuthProvider";
import { useCardsProvider } from "../providers/CardsProvider";

function useLikedCards() {
    const {user} = useAuth();
    const {registeredCards, handleToggleLike} = useCardsProvider();

    const toggleLike = (cardId) => {
        if(!user) return;
        handleToggleLike(cardId)
    }

    const isLikeByMe = (cardId) => {
        const card = registeredCards.find(card => card._id === cardId);
        if(!card && !user) return false;
        return (card?.likes || []).includes(user?._id);
    }

    const getLikeCount = (cardId) => {
        const card = registeredCards.find(c => c._id === cardId)
        const likeCount = (card?.likes || []).length;
        return likeCount;
    }

    return{toggleLike, isLikeByMe, getLikeCount}
}

export default useLikedCards;
