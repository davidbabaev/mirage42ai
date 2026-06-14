import { useEffect, useState } from 'react'
import { getSocket } from '../services/socketService';
import { useAuth } from '../providers/AuthProvider';
import { getSingleChatMessages, uploadChatMedia } from '../services/apiService';

// Owns the OPEN conversation thread (messages + send). The conversation list,
// unread counts and previews live in ChatProvider.
function useChat(
    selectedConversationId,
    onConversationDeleted,
    onMessageReceived
) {
    const [chatMessages, setChatMessages] = useState([]);
    const [sendError, setSendError] = useState(null);

    const clearSendError = () => setSendError(null);

    const {user} = useAuth();

    const handleOpenConversation = async (id) => {
        try{
            const response = await getSingleChatMessages(id);
            setChatMessages(response);
        }
        catch(err){
           console.log(err.message);
        }
    }

    const handleSendNewMessage = async (message) => {
        if(message.mediaFile){
            // Optimistic bubble: show the media immediately with a "sending"
            // state (local preview URL) while it uploads to Cloudinary, then
            // swap it for the real message on success / mark it failed on error.
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const localUrl = URL.createObjectURL(message.mediaFile);
            const mediaType = message.mediaFile.type.startsWith('video/') ? 'video' : 'image';
            const pending = {
                _id: tempId,
                userId: user?._id,
                conversationId: selectedConversationId,
                text: message.text,
                mediaUrl: localUrl,
                mediaType,
                createdAt: new Date().toISOString(),
                status: 'sending',
            };
            setChatMessages(prev => [...prev, pending]);

            const formData = new FormData();
                formData.append('media', message.mediaFile);
                formData.append('toUser', message.toUser);
                formData.append('text', message.text);

            try{
                const created = await uploadChatMedia(formData)
                // Replace the pending bubble (if the socket echo hasn't already).
                setChatMessages(prev => {
                    if(prev.some(m => m._id === created._id)) {
                        return prev.filter(m => m._id !== tempId);
                    }
                    return prev.map(m => m._id === tempId ? {...created, status: 'sent'} : m);
                });
                URL.revokeObjectURL(localUrl);
            }
            catch(err){
                setChatMessages(prev => prev.map(m => m._id === tempId ? {...m, status: 'failed'} : m));
                setSendError(err.message || 'Could not send media. Please try again.')
            }
        }
        else{
            getSocket().emit('send-message', message)
        }
    }

    useEffect(() => {
        const socket = getSocket();
        if(!socket) return undefined;

        // Append incoming messages to the open thread. (List/unread updates are
        // handled separately by ChatProvider.) Named handlers + targeted off so
        // we don't clobber ChatProvider's listeners.
        const onReceive = (newMessage) => {
            if(onMessageReceived){
                onMessageReceived(newMessage)
            }

            const isOurOpenChat =
                newMessage.conversationId === selectedConversationId ||
                selectedConversationId === null;

            if(isOurOpenChat){
                setChatMessages(prev => {
                    // already have it (e.g. our own upload's HTTP response) — skip
                    if(prev.some(m => m._id === newMessage._id)) return prev;
                    // if this echoes our own just-sent media, replace the pending bubble
                    if(newMessage.userId === user?._id){
                        const idx = prev.findIndex(m => m.status === 'sending' && m.mediaType === newMessage.mediaType);
                        if(idx !== -1){
                            const copy = [...prev];
                            copy[idx] = {...newMessage, status: 'sent'};
                            return copy;
                        }
                    }
                    return [...prev, newMessage];
                })
            }
        };

        const onDeleted = (deletedId) => {
            if(onConversationDeleted){
                onConversationDeleted(deletedId)
            }
        };

        // surface server-side send failures (the backend emits this to the sender)
        const onSendError = (payload) => {
            setSendError(payload?.message || 'Message failed to send. Please try again.')
        };

        socket.on('receive-message', onReceive);
        socket.on('deleted-conversation', onDeleted);
        socket.on('send-message-error', onSendError);

        return () => {
            socket.off('receive-message', onReceive);
            socket.off('deleted-conversation', onDeleted);
            socket.off('send-message-error', onSendError);
        }

    }, [
        user?._id, selectedConversationId,
        onConversationDeleted,
        onMessageReceived
    ]); // <- re-runs when the actual ID changes.

    return{
        handleOpenConversation,
        handleSendNewMessage,
        chatMessages,
        sendError,
        clearSendError
    }
}

export default useChat;
