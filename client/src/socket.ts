import { io, Socket } from 'socket.io-client';

const SERVER_URL = ((import.meta as unknown) as { env: { VITE_SERVER_URL?: string } }).env.VITE_SERVER_URL ?? 'http://localhost:3000';

export const socket: Socket = io(SERVER_URL, {
	autoConnect: true,
	transports: ['websocket', 'polling']
});

// helpful debug logging for connection issues
socket.on('connect', () => console.log('socket connected', socket.id, 'to', SERVER_URL));
socket.on('connect_error', (err) => console.error('socket connect_error', err));
socket.on('error', (err) => console.error('socket error', err));
socket.on('reconnect_attempt', (n) => console.log('reconnect attempt', n));

export default socket;
