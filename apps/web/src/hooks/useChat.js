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
            const formData = new FormData();
                formData.append('media', message.mediaFile);
                formData.append('toUser', message.toUser);
                formData.append('text', message.text);

            try{
                await uploadChatMedia(formData)
            }
            catch(err){
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
                setChatMessages(prev => [...prev, newMessage])
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
