import { io } from "socket.io-client";
const SERVER_URL = import.meta.env.VITE_API_URL;

let socket = null;

export function connectSocket(){
    if(socket?.connected) return socket;

    socket = io(SERVER_URL, {
        auth: (cb) => {
            cb({token: localStorage.getItem('auth-token')})
        }
    })

    socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
    })

    socket.on('connect_error', (error) => {
        console.log('Connection error:', error.message);
    })

    return socket
}

export function disconnectSocket(){
    if(!socket) return;

    socket.disconnect();
    socket = null;
}

export function getSocket() {
    return socket;
}
