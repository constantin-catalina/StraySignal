import { API_BASE_URL } from '@/constants/api';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(userId: string) {
  if (socket && socket.connected) return socket;
  socket = io(API_BASE_URL.replace(/\/api$/, ''), {
    transports: ['websocket'],
    query: { userId },
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
