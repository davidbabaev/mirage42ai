import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/authContext";
import {
    getMyFavorites,
    addFavorite as apiAddFavorite,
    removeFavorite as apiRemoveFavorite,
} from "../services/apiService";

// Saved posts ("favorites"), server-persisted so they follow the user across
// devices (replaces the old per-browser localStorage store). Same return shape
// as before — { favoriteCards, handleFavoriteCards, handleRemoveCard } — so no
// consumer needs to change. favoriteCards holds full, fresh card objects.
function useFavoriteCards() {
    const [favoriteCards, setFavoriteCards] = useState([]);
    const { user, isLoggedIn } = useAuth();
    const userId = user?._id;

    // Read current favorites synchronously inside the toggle handlers without
    // adding favoriteCards to their deps (avoids stale closures + re-creation).
    const favRef = useRef([]);
    useEffect(() => { favRef.current = favoriteCards; }, [favoriteCards]);

    // Load the user's saved posts while logged in; the cleanup clears them when
    // the session ends (logout) or the user switches, so a new account never
    // shows the previous one's saves. (Starts [] for a logged-out first mount.)
    useEffect(() => {
        if (!isLoggedIn || !userId) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const cards = await getMyFavorites();
                if (!cancelled) setFavoriteCards(Array.isArray(cards) ? cards : []);
            } catch (err) {
                console.log(err.message);
            }
        })();
        return () => {
            cancelled = true;
            setFavoriteCards([]);
        };
    }, [isLoggedIn, userId]);

    // Toggle: update the UI optimistically, persist to the server, revert on error.
    const handleFavoriteCards = useCallback((card) => {
        if (!isLoggedIn) return;
        const wasFavorite = favRef.current.some((fav) => fav._id === card._id);
        setFavoriteCards((prev) =>
            wasFavorite ? prev.filter((fav) => fav._id !== card._id) : [...prev, card]
        );
        const persist = wasFavorite ? apiRemoveFavorite : apiAddFavorite;
        persist(card._id).catch((err) => {
            console.log(err.message);
            setFavoriteCards((prev) => {
                const has = prev.some((fav) => fav._id === card._id);
                if (wasFavorite) return has ? prev : [...prev, card]; // re-add the failed removal
                return prev.filter((fav) => fav._id !== card._id);    // undo the failed add
            });
        });
    }, [isLoggedIn]);

    // Explicit remove (favorites list) — only ever unsaves.
    const handleRemoveCard = useCallback((card) => {
        if (!isLoggedIn) return;
        setFavoriteCards((prev) => prev.filter((fav) => fav._id !== card._id));
        apiRemoveFavorite(card._id).catch((err) => {
            console.log(err.message);
            setFavoriteCards((prev) =>
                prev.some((fav) => fav._id === card._id) ? prev : [...prev, card]
            );
        });
    }, [isLoggedIn]);

    return { favoriteCards, handleFavoriteCards, handleRemoveCard };
}

export default useFavoriteCards;
