import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";

function useFavoriteCards() {

    // const {registeredCards} = useCardsProvider();
    const [favoriteCards, setFavoriteCards] = useState([]);
    const {user} = useAuth();
    const [isUserLoaded, setIsUserLoaded] = useState(false);

    const storageUserkey = user ? `favoriteCards_${user._id}` : null;

    const handleFavoriteCards = useCallback((card) => {
        setFavoriteCards((prev) => {
            const include = prev.some(fav => fav._id === card._id)
            if(!include){
                return [...prev, card]
            }
            return prev.filter(fav => fav._id !== card._id)
        })
    }, [])

    const handleRemoveCard = useCallback((card) => {
        setFavoriteCards((prev) => {
            return prev.filter(fav => fav._id !== card._id)
        })
    }, [])

    // useEffect on mount - with get LocalStorage
    useEffect(() => {
        if(!storageUserkey) return;

        const savedCards = JSON.parse(localStorage.getItem(storageUserkey))

        if(savedCards){
            setFavoriteCards(savedCards)
        }

        setIsUserLoaded(true);
    }, [storageUserkey]);
    
    // useEffect when changed with set LocalStorage
    useEffect(() => {
        if(!isUserLoaded) return;
        if(!storageUserkey) return;

        localStorage.setItem(storageUserkey ,JSON.stringify(favoriteCards))
    }, [favoriteCards, storageUserkey, isUserLoaded])

  return{favoriteCards, handleFavoriteCards, handleRemoveCard}
}

export default useFavoriteCards;
