import { io } from "socket.io-client";
import { refreshAccessToken } from "./apiService";

const SERVER_URL = import.meta.env.VITE_API_URL;

let socket = null;

// One refresh attempt per broken connection. Cleared on a successful connect, so a
// later expiry can refresh again — but a genuinely dead session can't spin us into a
// refresh loop against a server that will keep refusing.
let triedRefresh = false;

// The server refuses a bad handshake with these (chatSocket.js io.use()). Anything
// else — 'xhr poll error', 'timeout', server down — is a NETWORK problem, and
// socket.io already retries those on its own. Refreshing the token wouldn't help.
const isAuthError = (message = '') =>
    /invalid token|no token|jwt|unauthor/i.test(message);

export function connectSocket(){
    if(socket?.connected) return socket;

    socket = io(SERVER_URL, {
        // A callback (not a static object), so every reconnect attempt re-reads the
        // CURRENT token rather than the one that happened to exist at construction.
        auth: (cb) => {
            cb({token: localStorage.getItem('auth-token')})
        }
    })

    socket.on('connect', () => {
        triedRefresh = false;
    })

    socket.on('connect_error', async (error) => {
        const message = error?.message || '';

        // The access token expired mid-session. HTTP calls heal themselves on a 401,
        // but the socket never sees a 401 — the handshake is simply refused, and it
        // would retry with the same dead token indefinitely. Go get a fresh one and
        // reconnect; the auth callback above will pick it up.
        if(isAuthError(message) && !triedRefresh){
            triedRefresh = true;
            try{
                const newToken = await refreshAccessToken();
                if(newToken){
                    socket?.connect();
                    return;
                }
            }
            catch{
                // fall through — the session is genuinely over
            }
            // Refresh failed: the refresh cookie is gone or revoked. apiService's own
            // 401 path will force the logout; don't duplicate it from here.
        }

        console.log('Connection error:', message);
    })

    return socket
}

export function disconnectSocket(){
    if(!socket) return;

    socket.disconnect();
    socket = null;
    triedRefresh = false;
}

export function getSocket() {
    return socket;
}
