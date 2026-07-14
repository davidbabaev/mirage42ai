import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '../services/socketService';
import { useAuth } from '../providers/authContext';
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

    // Reverse pagination: the thread opens on the newest page; `olderCursor` (the
    // server's nextCursor) points at the next-OLDER page, loaded on scroll-up.
    const [olderCursor, setOlderCursor] = useState(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const loadingOlderRef = useRef(false); // guards against rapid re-triggers
    const hasOlderMessages = !!olderCursor;

    const clearSendError = () => setSendError(null);

    const {user} = useAuth();

    const handleOpenConversation = async (id) => {
        try{
            const { messages, nextCursor } = await getSingleChatMessages(id);
            setChatMessages(messages);
            setOlderCursor(nextCursor);
        }
        catch(err){
           console.log(err.message);
        }
    }

    // Fetch the next-older page and PREPEND it. Ignores the result if the user
    // switched conversations mid-fetch, and de-dupes defensively (the keyset
    // cursor already guarantees no overlap with what's loaded).
    const loadOlderMessages = useCallback(async () => {
        if(loadingOlderRef.current) return;
        const cid = selectedConversationId;
        const cursor = olderCursor;
        if(!cid || !cursor) return;

        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try{
            const { messages, nextCursor } = await getSingleChatMessages(cid, { cursor });
            setChatMessages(prev => {
                if(prev[0] && prev[0].conversationId !== cid) return prev; // stale
                const known = new Set(prev.map(m => m._id));
                const fresh = messages.filter(m => !known.has(m._id));
                return [...fresh, ...prev];
            });
            setOlderCursor(nextCursor);
        }
        catch(err){
            console.log(err.message);
        }
        finally{
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [selectedConversationId, olderCursor]);

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
            // A text DM used to be a bare fire-and-forget emit. socket.io SILENTLY
            // BUFFERS an emit on a disconnected client — the message never reaches
            // the server and nothing throws, so a user whose socket was stuck (an
            // expired token refused the reconnect) just watched their messages
            // vanish. A message that cannot be delivered has to say so.
            const socket = getSocket();

            if(!socket?.connected){
                setSendError("You're offline. Message not sent — check your connection and try again.");
                return;
            }

            // Ack + timeout: the server answers when it has actually stored the
            // message. No answer (or an error) means it did NOT send, and the user
            // gets told — the Snackbar for this already exists; nothing was feeding it.
            socket.timeout(10000).emit('send-message', message, (timeoutErr, ack) => {
                if(timeoutErr){
                    setSendError('Message not sent — the server did not respond. Please try again.');
                    return;
                }
                if(ack?.error){
                    setSendError(ack.error);
                }
            })
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
        loadOlderMessages,
        hasOlderMessages,
        loadingOlder,
        sendError,
        clearSendError
    }
}

export default useChat;
