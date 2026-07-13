import { useAuth } from "../providers/AuthProvider";
import { useCardsProvider } from "../providers/CardsProvider";

function useLikedCards() {
    const {user} = useAuth();
    const {registeredCards, handleToggleLike} = useCardsProvider();

    // Resolve the authoritative version of a card: prefer the CardsProvider
    // overlay (registeredCards — carries optimistic like state so a like reflects
    // on EVERY surface), and fall back to the card's own embedded arrays. Taking
    // the card object (not just an id) means these work even when the card isn't
    // in the overlay — and after the global getAllCards load is retired.
    const resolve = (card) => {
        if (!card) return null;
        return registeredCards.find(c => c._id === card._id) || card;
    };

    // Takes the card OBJECT (like isLikeByMe/getLikeCount): the optimistic flip
    // needs something to seed the overlay with when the card isn't in it yet.
    const toggleLike = (card) => {
        if(!user) return;
        handleToggleLike(card)
    }

    const isLikeByMe = (card) => {
        const c = resolve(card);
        return (c?.likes || []).includes(user?._id);
    }

    const getLikeCount = (card) => {
        const c = resolve(card);
        return (c?.likes || []).length;
    }

    return{toggleLike, isLikeByMe, getLikeCount}
}

export default useLikedCards;
