const BASE_URL = import.meta.env.VITE_API_URL;

const getToken = () => localStorage.getItem('auth-token');
export const FORCE_LOGOUT_EVENT = 'auth:force-logout'

const forceLogout = (reason) => {
    window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, { detail: { reason } }))
}

// Single-flight refresh: many requests can 401 at once when the access token
// expires; they all await the same /auth/refresh round-trip instead of each
// firing their own. credentials:'include' sends the httpOnly refresh cookie.
let refreshPromise = null;

const requestRefresh = async () => {
    const res = await fetch(BASE_URL + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
    })
    if(!res.ok) return null;
    const data = await res.json();
    if(data?.token) localStorage.setItem('auth-token', data.token);
    return data?.token || null;
}

const refreshAccessToken = () => {
    if(!refreshPromise){
        refreshPromise = requestRefresh().finally(() => { refreshPromise = null; })
    }
    return refreshPromise;
}

// Revoke the refresh cookie server-side on logout. Best-effort.
export const logout = () => fetch(BASE_URL + '/auth/logout', {
    method: 'POST',
    credentials: 'include',
})

const buildOptions = (method, body, isFormData) => {
    const token = getToken();
    const headers = isFormData ? {} : { "Content-Type": "application/json" };
    if(token){
        headers['auth-token'] = token;
    }
    const options = { method, headers, credentials: 'include' };
    if(body){
        options.body = isFormData ? body : JSON.stringify(body);
    }
    return options;
}

const send = async (endpoint, method, body, isFormData) => {
    const hadToken = !!getToken();
    let response = await fetch(BASE_URL + endpoint, buildOptions(method, body, isFormData))

    // A 401 on an authenticated request usually means the access token expired.
    // Try a one-shot refresh and replay the request once. If refresh fails, the
    // session is genuinely over.
    if(response.status === 401 && hadToken && endpoint !== '/auth/refresh'){
        const newToken = await refreshAccessToken();
        if(newToken){
            response = await fetch(BASE_URL + endpoint, buildOptions(method, body, isFormData))
        } else {
            forceLogout('session');
            throw new Error('Session expired');
        }
    }

    if(!response.ok){
        const message = await response.text()

        if(response.status === 401 && message === 'User not found :('){
            forceLogout('deleted');
        }

        if(response.status === 403 && message === 'You Banned :('){
            forceLogout('banned');
        }

        throw new Error(message);
    }
    return await response.json();
}

const httpRequest = (endpoint, method, body) => send(endpoint, method, body, false);
const httpRequestFormData = (endpoint, method, body) => send(endpoint, method, body, true);

// Users Requests
export const loginUser = (userData) => httpRequest('/users/login', 'POST', userData);
export const registerUser = (userData) => httpRequest('/users', 'POST', userData);
export const getAllUsers = () => httpRequest('/users', 'GET');
// Server-side people search for pickers (recipient autocomplete etc.) so we
// never load every user into the client.
export const searchUsers = (q, limit = 10) =>
    httpRequest(`/users?q=${encodeURIComponent(q)}&limit=${limit}`, 'GET');
export const getSingleUser = (id) => httpRequest(`/users/${id}`, 'GET');
// The caller's own blocked users (id + name + avatar) for the settings list.
export const getBlockedUsers = () => httpRequest('/users/blocked', 'GET');
// Recent DM contacts for the share-dialog default list.
export const getRecentContacts = (limit = 10) =>
    httpRequest(`/users/recent-contacts?limit=${limit}`, 'GET');
export const updateUser = (id, userData) => httpRequestFormData(`/users/${id}`, 'PUT', userData);
export const deleteUser = (id) => httpRequest(`/users/${id}`, 'DELETE');
export const followUnfollowUser = (id) => httpRequest(`/users/${id}/follow`, 'PATCH');
export const blockUnblockUser = (id) => httpRequest(`/users/${id}/block`, 'PATCH');
export const banUser = (id) => httpRequest(`/users/${id}/ban`, 'PATCH');
export const promoteUser = (id) => httpRequest(`/users/${id}/promote`, 'PATCH');
export const getSuggestedUsers = (limit = 20, cursor) =>
    httpRequest(`/users/suggested?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET');
export const updateOnboarding = (data) => httpRequest('/users/me/onboarding', 'PATCH', data);
export const updateNotificationPrefs = (prefs) => httpRequest('/users/me/notification-prefs', 'PATCH', prefs);

// Cards Requests
export const getAllCards = () => httpRequest('/cards', 'GET');
// export const getCard = (id) => httpRequest(`/cards/${id}`, 'GET');
export const createCard = (cardData) => httpRequestFormData('/cards', 'POST', cardData);
export const updateCard = (id ,cardData) => httpRequestFormData(`/cards/${id}`, 'PUT', cardData);
export const deleteCard = (id) => httpRequest(`/cards/${id}`, 'DELETE');
export const likeUnlikeCard = (id) => httpRequest(`/cards/${id}`, 'PATCH');
export const addComment = (id, cardData) => httpRequest(`/cards/${id}/comments`, 'PATCH', cardData);
export const removeComment = (id, commentId) => httpRequest(`/cards/${id}/comments/${commentId}`, 'PATCH');
export const likeUnlikeComment = (id, commentId) => httpRequest(`/cards/${id}/comments/${commentId}/like`, 'PATCH');
export const addReply = (id, commentId, replyData) => httpRequest(`/cards/${id}/comments/${commentId}/replies`, 'PATCH', replyData);
// Cursor-paginated feed → { cards, nextCursor }. Omit cursor for the first page.
export const getFeedCards = (cursor, limit = 15) => {
    const params = new URLSearchParams({ limit });
    if (cursor) params.set('cursor', cursor);
    return httpRequest(`/cards/feed?${params}`, 'GET');
};
export const banCard = (id) => httpRequest(`/cards/${id}/ban`, 'PATCH');
export const reportCard = (id, reason) => httpRequest(`/cards/${id}/report`, 'POST', { reason });
export const getCardLikes = (cardId, cursor, limit = 20) => {
    const params = new URLSearchParams({ limit });
    if (cursor) params.set('cursor', cursor);
    return httpRequest(`/cards/${cardId}/likes?${params}`, 'GET');
};
export const getCardReports = (cardId) => httpRequest(`/cards/${cardId}/reports`, 'GET');

// Cursor-paginated list endpoints → { items, nextCursor }. Omit cursor for page 1.
const pageParams = (cursor, limit, extra = {}) => {
    const params = new URLSearchParams({ limit, ...extra });
    if (cursor) params.set('cursor', cursor);
    return params.toString();
};
export const getExploreCards = (cursor, limit = 15, userId) =>
    httpRequest(`/cards/explore?${pageParams(cursor, limit, userId ? { userId } : {})}`, 'GET');
export const getCardComments = (cardId, cursor, limit = 15) =>
    httpRequest(`/cards/${cardId}/comments?${pageParams(cursor, limit)}`, 'GET');
export const getUsersBrowse = (cursor, limit = 15) =>
    httpRequest(`/users/browse?${pageParams(cursor, limit)}`, 'GET');
export const getFollowers = (userId, cursor, limit = 15) =>
    httpRequest(`/users/${userId}/followers?${pageParams(cursor, limit)}`, 'GET');
export const getFollowing = (userId, cursor, limit = 15) =>
    httpRequest(`/users/${userId}/following?${pageParams(cursor, limit)}`, 'GET');


// Notifications Requests
export const getNotifications = () => httpRequest(`/notifications`, 'GET');
export const markNotificationsAsRead = () => httpRequest(`/notifications`, 'PATCH');
export const deleteOneNotification = (id) => httpRequest(`/notifications/${id}`, 'DELETE');


// chat requests
export const getChats = () => httpRequest(`/chats`, 'GET');
export const getSingleChatMessages = (id) => httpRequest(`/messages/${id}`, 'GET');
export const deleteChat = (conversationId) => httpRequest(`/chats/${conversationId}`, 'DELETE');
export const markChatRead = (conversationId) => httpRequest(`/chats/${conversationId}/read`, 'PATCH');
export const uploadChatMedia = (formData) => httpRequestFormData('/chat/upload-media', 'POST', formData);


