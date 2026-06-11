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

const countComments = (cardId) => {
  const card = registeredCards.find(c => c._id === cardId)
  const count = (card?.comments || []).length
  return count
}

  return {addComment, countComments, removeComment}
}

export default useCommentsCards;
