import React, { useEffect, useState } from 'react'
import { getSocket } from '../services/socketService';
import { useAuth } from '../providers/AuthProvider';
import { deleteChat, getChats, getSingleChatMessages, uploadChatMedia } from '../services/apiService';

function useChat(
    selectedConversationId, 
    onConversationDeleted, 
    onMessageReceived
) {
    const [conversationsList, setConversationsList] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [sendError, setSendError] = useState(null);

    const clearSendError = () => setSendError(null);

    const {user} = useAuth();

    const handleOpenChatList = async () => {
        try{
            const response = await getChats();
            setConversationsList(response);
        }   
        catch(err){
           console.log(err.message);
            
        }
    }

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

    const handleDeleteChat = async (conversationId) => {
        try{
            await deleteChat(conversationId)
            // set the list to a new list without this id of deleted chat
            setConversationsList(prev => prev.filter(c => c._id !== conversationId))
        }
        catch(err){
            console.log(err.message);
        }
    }
    
    useEffect(() => {
        const socket = getSocket();
        if(!socket) return;
        
        socket.on('receive-message', (newMessage) => {
            // if(newMessage.conversationId === selectedConversationId){
            //     setChatMessages(prev => [...prev, newMessage])
            // }
            // handleOpenChatList();

            if(onMessageReceived){
                onMessageReceived(newMessage)   
            }

            const isOurOpenChat = 
                newMessage.conversationId === selectedConversationId ||
                selectedConversationId === null;

            if(isOurOpenChat){
                setChatMessages(prev => [...prev, newMessage])
            }

            handleOpenChatList();
        });
        
        socket.on('deleted-conversation', (deletedId) => {
            setConversationsList(prev => prev.filter(c => c._id !== deletedId))

            // tell the page about it (if it wants to know)
            if(onConversationDeleted){
                onConversationDeleted(deletedId)
            }
        })

        // surface server-side send failures (the backend emits this to the sender)
        socket.on('send-message-error', (payload) => {
            setSendError(payload?.message || 'Message failed to send. Please try again.')
        })

        return () => {
            socket.off('receive-message');
            socket.off('deleted-conversation');
            socket.off('send-message-error');
        }

    }, [
        user?._id, selectedConversationId, 
        onConversationDeleted, 
        onMessageReceived
    ]); // <- re-runs when the actual ID changes.

    return{
        handleOpenChatList, 
        handleOpenConversation, 
        handleSendNewMessage,
        conversationsList,
        chatMessages,
        handleDeleteChat,
        sendError,
        clearSendError
    }
}

export default useChat;
