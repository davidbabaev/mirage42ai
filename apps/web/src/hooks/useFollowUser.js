import { useAuth } from "../providers/AuthProvider";
import { useUsersProvider } from "../providers/UsersProvider";
import { useCardsProvider } from "../providers/CardsProvider";

function useFollowUser() {

  const{ handleToggleFollow, user} = useAuth();
  const {users, syncUser} = useUsersProvider();
  const {removeAuthorFromFeed, addAuthorToFeed} = useCardsProvider();

    // toggle Follow

    const toggleFollow = async (userId) => {
        if(!user) return false;
        // Update in place: patch the current user in the users list with the
        // server's response, so the button and counts update without a full
        // re-fetch (which caused re-renders / scroll jump).
        const updatedUser = await handleToggleFollow(userId);
        syncUser(updatedUser);
        if (!updatedUser) return;
        // Reflect the change in the feed in place — no refetch, no scroll reset.
        // Follow -> add their posts; unfollow -> drop them.
        if ((updatedUser.following || []).includes(userId)) {
            addAuthorToFeed(userId);
        } else {
            removeAuthorFromFeed(userId);
        }
    }

    // isFollow by me
    const isFollowByMe = (userId) => {
        if(!user) return false;
        return (user?.following || []).includes(userId)
    }

    // get following Count
    const getFollowingCount = (userId) => {
        const foundUser = users.find(user => user._id === userId);
        if(!foundUser) return 0;
        return (foundUser?.following || []).length
    }

    const getFollowersCount = (userId) => {
        if(!users) return 0;
        return users.filter(userU => (userU.following || []).includes(userId)).length;
    }

  return {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} 
}

export default useFollowUser;
