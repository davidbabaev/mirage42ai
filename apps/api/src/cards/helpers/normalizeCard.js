// A post may deliberately have NO media — a text-only post, which is what most
// people actually write most of the time (master-plan §6). That case has to be
// distinguishable from "the caller didn't supply mediaUrl", so:
//
//   mediaUrl omitted / null  -> legacy behaviour, fall back to the placeholder
//   mediaUrl === ''          -> an EXPLICIT text-only post; keep it empty
//
// `mediaType` describes the media, so a text-only post has none. It is left
// undefined rather than '' because the schema enum is ['image','video'] and an
// empty string would fail validation.
const PLACEHOLDER_MEDIA_URL = 'https://via.placeholder.com/300';

const normalizeCard = (card) => {
    const isTextOnly = card.mediaUrl === '';

    return {
        ...card, // keep everything the user sent
        mediaUrl: isTextOnly ? '' : (card.mediaUrl || PLACEHOLDER_MEDIA_URL),
        mediaType: isTextOnly ? undefined : (card.mediaType || 'image'),
        likes: card.likes || [],
        category: card.category || 'general',
    };
};

module.exports = normalizeCard;
module.exports.PLACEHOLDER_MEDIA_URL = PLACEHOLDER_MEDIA_URL;
