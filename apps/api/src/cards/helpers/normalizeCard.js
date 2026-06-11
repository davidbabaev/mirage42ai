const normalizeCard = (card) => {
    return{
        ...card, // keep everything the user sent
        mediaUrl: card.mediaUrl || "https://via.placeholder.com/300",
        mediaType: card.mediaType || "image",
        likes: card.likes || [],
        category: card.category || "general"
    }
}

module.exports = normalizeCard;