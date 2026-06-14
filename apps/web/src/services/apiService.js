const BASE_URL = import.meta.env.VITE_API_URL;

const getToken = () => localStorage.getItem('auth-token');
export const FORCE_LOGOUT_EVENT = 'auth:force-logout'

const httpRequest = async (endpoint, method, body) => {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json"
    }

    if(token){
        headers['auth-token'] = token;
    }

    const options = {
        method,
        headers,
    }

    if(body){
        options.body = JSON.stringify(body);
    }

    const response = await fetch(BASE_URL + endpoint, options)

    if(!response.ok){
        const message = await response.text()

        if(response.status === 401 && message === 'User not found :('){
            window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, {
                detail: {reason: 'deleted'}
            }))
        }

        if(response.status === 403 && message === 'You Banned :('){
            window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, {
                detail: {reason: 'banned'}
            }))
        }

        throw new Error(message);
    }
    return await response.json();
}

const httpRequestFormData = async (endpoint, method, body) => {
    const token = getToken();

    const headers = {};

    if(token){
        headers['auth-token'] = token;
    }

    const options = {
        method,
        headers,
    }

    if(body){
        options.body = body;
    }

    const response = await fetch(BASE_URL + endpoint, options)

    if(!response.ok){
        const message = await response.text();

        if(response.status === 401 && message === 'User not found :('){
            window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, {
                detail: {reason: 'deleted'}
            }))
        }

        if(response.status === 403 && message === 'You Banned :('){
            window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT, {
                detail: {reason: 'banned'}
            }))
        }

        throw new Error(message);
    }
    return await response.json();
}

// Users Requests
export const loginUser = (userData) => httpRequest('/users/login', 'POST', userData);
export const registerUser = (userData) => httpRequest('/users', 'POST', userData);
export const getAllUsers = () => httpRequest('/users', 'GET');
export const getSingleUser = (id) => httpRequest(`/users/${id}`, 'GET');
export const updateUser = (id, userData) => httpRequestFormData(`/users/${id}`, 'PUT', userData);
export const deleteUser = (id) => httpRequest(`/users/${id}`, 'DELETE');
export const followUnfollowUser = (id) => httpRequest(`/users/${id}/follow`, 'PATCH');
export const banUser = (id) => httpRequest(`/users/${id}/ban`, 'PATCH');
export const promoteUser = (id) => httpRequest(`/users/${id}/promote`, 'PATCH');

// Cards Requests
export const getAllCards = () => httpRequest('/cards', 'GET');
// export const getCard = (id) => httpRequest(`/cards/${id}`, 'GET');
export const createCard = (cardData) => httpRequestFormData('/cards', 'POST', cardData);
export const updateCard = (id ,cardData) => httpRequestFormData(`/cards/${id}`, 'PUT', cardData);
export const deleteCard = (id) => httpRequest(`/cards/${id}`, 'DELETE');
export const likeUnlikeCard = (id) => httpRequest(`/cards/${id}`, 'PATCH');
export const addComment = (id, cardData) => httpRequest(`/cards/${id}/comments`, 'PATCH', cardData);
export const removeComment = (id, commentId) => httpRequest(`/cards/${id}/comments/${commentId}`, 'PATCH');
export const getFeedCards = () => httpRequest(`/cards/feed`, 'GET');
export const banCard = (id) => httpRequest(`/cards/${id}/ban`, 'PATCH');


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


