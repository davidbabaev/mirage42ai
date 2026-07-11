import { useAuth } from "../providers/AuthProvider";
import { useCardsProvider } from "../providers/CardsProvider";

function useCommentsCards() {

const {registeredCards ,handleAddComment, handleRemoveComment} = useCardsProvider();
const {user} = useAuth();


const addComment = (commentText, cardId) => {
  if(!user) return;
  return handleAddComment(cardId, commentText)
}

const removeComment = (cardId, commentId) => {
  if(!user) return;
  return handleRemoveComment(cardId, commentId)
}

// Takes the card object; prefers the CardsProvider overlay (so an added/removed
// comment reflects everywhere) and falls back to the card's own embedded
// comments — works even when the card isn't in the overlay / after the global
// getAllCards load is retired.
const countComments = (card) => {
  if(!card) return 0;
  const c = registeredCards.find(x => x._id === card._id) || card;
  return (c?.comments || []).length
}

  return {addComment, countComments, removeComment}
}

export default useCommentsCards;
