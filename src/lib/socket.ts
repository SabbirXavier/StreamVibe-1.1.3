import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || '';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
