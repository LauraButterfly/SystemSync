import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { newGame, playCard, laySequence, serializeState, GameState, ensureHandSizeFour, drawToHand } from '../shared/game/core';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

type Room = {
  id: string;
  sockets: string[]; // socket ids
  players: Record<string, number>; // socketId -> playerIndex
  pendingReorderBy?: string; // socket id who may reorder top 3 after playing Q
  drawnThisTurnCount?: number | null; // number of draw actions taken this turn (auto-draw = 1, top-up = 2)
  discardedThisTurnFor?: number | null; // playerIndex who has discarded this turn
  state?: GameState;
  mode?: string; // game mode key, e.g., 'standard' or 'sudden-death'
  sequencesToWin?: number; // threshold for sequences to win (defaults to 3)
};

const rooms = new Map<string, Room>();

function makeId(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

  function fullStatePayload(room: Room) {
    return {
      state: room.state,
      meta: {
        drawnThisTurnCount: room.drawnThisTurnCount ?? 0,
        discardedThisTurnFor: room.discardedThisTurnFor ?? null,
        mode: room.mode ?? 'standard',
        sequencesToWin: room.sequencesToWin ?? 3,
      }
    };
  }

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('createRoom', (modeOrCb: any, cb?: any) => {
    // support being called either as (cb) or (mode, cb)
    let mode = 'standard';
    if (typeof modeOrCb === 'string') mode = modeOrCb;
    if (typeof modeOrCb === 'function') cb = modeOrCb;
    const id = makeId();
    const room: Room = { id, sockets: [socket.id], players: {} };
    room.players[socket.id] = 0;
    room.mode = mode;
    room.sequencesToWin = mode === 'sudden-death' ? 1 : 3;
    rooms.set(id, room);
    socket.join(id);
    console.log(`room created ${id} by socket ${socket.id} mode=${room.mode} sequencesToWin=${room.sequencesToWin}`);
    cb && cb({ roomId: id, playerIndex: 0 });
  });

  socket.on('joinRoom', (roomId: string, cb: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room) return cb({ ok: false, reason: 'Room not found' });
    if (room.sockets.length >= 2) return cb({ ok: false, reason: 'Room full' });
    room.sockets.push(socket.id);
    room.players[socket.id] = 1;
    socket.join(roomId);
    console.log(`socket ${socket.id} joined room ${roomId}`);
    // notify room members someone joined
    io.to(roomId).emit('playerJoined', { socketId: socket.id });
    cb({ ok: true, playerIndex: 1, mode: room.mode ?? 'standard', sequencesToWin: room.sequencesToWin ?? 3 });
  });

  socket.on('startGame', (roomId: string, cb?: (res: { ok: boolean; reason?: string }) => void) => {
    const room = rooms.get(roomId);
    if (!room) return cb && cb({ ok: false, reason: 'Room not found' });
    // only host (playerIndex 0) may start
    const idx = room.players[socket.id];
  if (idx !== 0) return cb && cb({ ok: false, reason: 'Only the Host can start the game' });
    // prefer counting registered players (room.players) instead of sockets array length
    const playerCount = Object.keys(room.players).length;
    console.log(`startGame requested by ${socket.id} in room ${roomId} - sockets=${room.sockets.length} players=${playerCount} playersMap=${JSON.stringify(room.players)}`);
    if (playerCount < 2) return cb && cb({ ok: false, reason: 'Need 2 players to start' });
  // start game with smaller hands in sudden-death mode
  const startingHandSize = room.mode === 'sudden-death' ? 3 : 8;
  room.state = newGame(undefined, startingHandSize);
    room.drawnThisTurnCount = 0;
    room.discardedThisTurnFor = null;
    // mandatory initial draw for starting player
    const starter = room.state.currentPlayer;
  drawToHand(room.state, starter, 1);
  // auto top-up to four if below four after the mandatory draw
  ensureHandSizeFour(room.state, starter);
    room.drawnThisTurnCount = 1;
    console.log(`game started in room ${roomId} by ${socket.id}`);
    io.to(roomId).emit('gameStarted', { state: room.state });
    io.to(roomId).emit('stateUpdate', fullStatePayload(room));
    cb && cb({ ok: true });
  });

  socket.on('playCard', (data: { roomId: string; playerIndex: number; handIndex: number; options?: any }, cb?: (res: any) => void) => {
    const room = rooms.get(data.roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    // enforce one discard per turn: if this player already discarded, block further plays
    if (room.discardedThisTurnFor === data.playerIndex) return cb && cb({ ok: false, reason: 'Already discarded this turn' });
    // snapshot pre-play hands to detect stolen cards (Jack)
    const prePlayerHandIds = room.state.players[data.playerIndex].hand.map(c => c.id);
    const res = playCard(room.state, data.playerIndex, data.handIndex, data.options);
    if (!res.ok) return cb && cb(res);
  // detect if any new cards were added to the player's hand (e.g., Jack steal)
    const postPlayerHandIds = room.state.players[data.playerIndex].hand.map(c => c.id);
    const addedIds = postPlayerHandIds.filter(id => !prePlayerHandIds.includes(id));

  // mark that this player has discarded this turn
  room.discardedThisTurnFor = data.playerIndex;

    // If Jack was played, we want to prevent the stealing player from seeing the identities
    // of the stolen cards. We'll emit the full state to the room except the acting socket,
    // and emit a sanitized state to the acting socket where stolen cards are masked.
    // special-card notifications (e.g., Ace -> drew 2 cards)
    const top = room.state.discardPile[room.state.discardPile.length - 1];
    if (top && top.rank === 'A') {
      // determine who drew: the player who played the Ace
      const pIdx = data.playerIndex;
      const newHandSize = room.state.players[pIdx].hand.length;
      io.to(data.roomId).emit('cardsDrawn', { playerIndex: pIdx, count: 2, newHandSize });
    }
    if (top && top.rank === 'K') {
      const pIdx = data.playerIndex;
      const remaining = room.state.players[pIdx].extraTurns ?? 0;
      io.to(data.roomId).emit('extraTurnGranted', { playerIndex: pIdx, remaining });
    }
  if (top && top.rank === 'Q') {
      // allow the player who played the Queen to peek and reorder top 3
      // find socket id for that playerIndex
      const socketId = Object.keys(room.players).find(k => room.players[k] === data.playerIndex);
      if (socketId) {
        room.pendingReorderBy = socketId;
        const top3 = room.state.mainDeck.slice(-3).filter(Boolean);
        io.to(socketId).emit('peekTop', { top3 });
      }
    }
    // reset drawn flag when a new turn is about to start? handled in endTurn; leave as-is here
    // emit state updates, with masking if needed
    if (top && top.rank === 'J' && addedIds.length > 0) {
      // notify room that a steal happened
      io.to(data.roomId).emit('cardsStolen', { playerIndex: data.playerIndex, count: addedIds.length });
      // Build a sanitized state for everyone else where stolen card identities in the thief's hand are hidden
      try {
        const sanitized = JSON.parse(JSON.stringify(room.state));
        const thiefHand = sanitized.players[data.playerIndex].hand as any[];
        for (let i = 0; i < thiefHand.length; i++) {
          if (addedIds.includes(thiefHand[i].id)) {
            thiefHand[i] = { id: `HIDDEN-${Math.random().toString(36).slice(2,8).toUpperCase()}`, suit: 'Hidden', rank: '??' };
          }
        }
        // send sanitized state to everyone else
        socket.to(data.roomId).emit('stateUpdate', { state: sanitized, meta: { drawnThisTurnCount: room.drawnThisTurnCount ?? 0, discardedThisTurnFor: room.discardedThisTurnFor ?? null } });
        // send full state to the acting socket so they see what they stole
        socket.emit('stateUpdate', fullStatePayload(room));
  // private notice for the thief (removed — client no longer listens for this)
      } catch (err) {
        // fallback: broadcast full state to everyone
        io.to(data.roomId).emit('stateUpdate', fullStatePayload(room));
      }
    } else {
      // normal flow: broadcast full state to everyone
      io.to(data.roomId).emit('stateUpdate', fullStatePayload(room));
    }
  const win = (require('../shared/game/core') as any).checkWin(room.state, room.sequencesToWin ?? 3);
  if (win && win.winner !== undefined) io.to(data.roomId).emit('gameOver', win);
    cb && cb({ ok: true });
  });

  socket.on('endTurn', (roomId: string, cb?: (res: { ok: boolean; reason?: string }) => void) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    const playerIdx = room.players[socket.id];
    if (playerIdx === undefined) return cb && cb({ ok: false, reason: 'Not in room' });
    if (room.state.currentPlayer !== playerIdx) return cb && cb({ ok: false, reason: 'Not your turn' });
  // player must discard one card before ending the turn
  if (room.discardedThisTurnFor !== playerIdx) return cb && cb({ ok: false, reason: 'You must discard one card before ending your turn' });

  // if the player has an extra turn (from King), consume it and give them the turn again
    const extra = room.state.players[playerIdx].extraTurns ?? 0;
    if (extra > 0) {
      room.state.players[playerIdx].extraTurns = Math.max(0, extra - 1);
      // start a fresh turn for the same player: reset draw/discard flags and perform mandatory draw
      room.state.currentPlayer = playerIdx;
      room.drawnThisTurnCount = 0;
      room.discardedThisTurnFor = null;
      drawToHand(room.state, playerIdx, 1);
      // auto top-up to four after mandatory draw for new turn
      ensureHandSizeFour(room.state, playerIdx);
      room.drawnThisTurnCount = 1;
      io.to(roomId).emit('stateUpdate', fullStatePayload(room));
      return cb && cb({ ok: true });
    }

    // advance to next player
    let next = 1 - playerIdx;

    // handle blocked rounds: if next player is blocked, decrement and skip them
    if (room.state.players[next].blockedRounds > 0) {
      room.state.players[next].blockedRounds = Math.max(0, room.state.players[next].blockedRounds - 1);
      // skip to the other player
      const skipTo = 1 - next;
      room.state.currentPlayer = skipTo;
      room.drawnThisTurnCount = 0;
      room.discardedThisTurnFor = null;
      // mandatory draw for new turn
      drawToHand(room.state, skipTo, 1);
      // auto top-up to four after mandatory draw
      ensureHandSizeFour(room.state, skipTo);
      room.drawnThisTurnCount = 1;
    } else {
      room.state.currentPlayer = next;
      room.drawnThisTurnCount = 0;
      room.discardedThisTurnFor = null;
      // mandatory draw for new turn
      drawToHand(room.state, next, 1);
      // auto top-up to four after mandatory draw
      ensureHandSizeFour(room.state, next);
      room.drawnThisTurnCount = 1;
    }

    io.to(roomId).emit('stateUpdate', fullStatePayload(room));
    cb && cb({ ok: true });
  });

  socket.on('laySequence', (data: { roomId: string; playerIndex: number; handIndices: number[] }, cb?: (res: any) => void) => {
    const room = rooms.get(data.roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    // player must have discarded this turn before laying sequences
    if (room.discardedThisTurnFor !== data.playerIndex) return cb && cb({ ok: false, reason: 'You must discard one card before laying sequences' });
    const res = laySequence(room.state, data.playerIndex, data.handIndices);
    if (!res.ok) return cb && cb(res);
  io.to(data.roomId).emit('stateUpdate', fullStatePayload(room));
  const win = (require('../shared/game/core') as any).checkWin(room.state, room.sequencesToWin ?? 3);
  if (win && win.winner !== undefined) io.to(data.roomId).emit('gameOver', win);
    cb && cb({ ok: true });
  });

  socket.on('getState', (roomId: string, cb: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return cb({ ok: false, reason: 'No game' });
    cb({ ok: true, state: room.state });
  });

  socket.on('reorderTop', (data: { roomId: string; newOrderIds: string[] }, cb?: (res: any) => void) => {
    const room = rooms.get(data.roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    if (!room.pendingReorderBy || room.pendingReorderBy !== socket.id) return cb && cb({ ok: false, reason: 'Not authorized to reorder' });
    // apply reorder
    try {
      const { reorderTopThree } = require('../shared/game/core') as any;
      const ok = reorderTopThree(room.state, data.newOrderIds);
      room.pendingReorderBy = undefined;
  io.to(data.roomId).emit('stateUpdate', fullStatePayload(room));
      cb && cb({ ok: true });
    } catch (err) {
      cb && cb({ ok: false, reason: 'Failed to reorder' });
    }
  });

  // allow a player to request their hand be sorted (color then number)
  socket.on('sortHand', (roomId: string, cb?: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    const playerIdx = room.players[socket.id];
    if (playerIdx === undefined) return cb && cb({ ok: false, reason: 'Not in room' });
    try {
      const { sortHand } = require('../shared/game/core') as any;
      sortHand(room.state, playerIdx);
      io.to(roomId).emit('stateUpdate', fullStatePayload(room));
      return cb && cb({ ok: true });
    } catch (err) {
      return cb && cb({ ok: false, reason: 'Failed to sort hand' });
    }
  });

  socket.on('drawUpToFour', (roomId: string, cb?: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return cb && cb({ ok: false, reason: 'No game' });
    const playerIdx = room.players[socket.id];
    if (playerIdx === undefined) return cb && cb({ ok: false, reason: 'Not in room' });
    if (room.state.currentPlayer !== playerIdx) return cb && cb({ ok: false, reason: 'Not your turn' });
    // allow one top-up draw action (in addition to mandatory auto-draw). drawnThisTurnCount: 0/1/2
    if ((room.drawnThisTurnCount ?? 0) >= 2) return cb && cb({ ok: false, reason: 'Already drawn (top-up) this turn' });
    const before = room.state.players[playerIdx].hand.length;
    ensureHandSizeFour(room.state, playerIdx);
    const after = room.state.players[playerIdx].hand.length;
    const drawn = Math.max(0, after - before);
    // mark that top-up draw was used
    room.drawnThisTurnCount = Math.max(room.drawnThisTurnCount ?? 0, 2);
    io.to(roomId).emit('stateUpdate', fullStatePayload(room));
    if (drawn > 0) io.to(roomId).emit('cardsDrawn', { playerIndex: playerIdx, count: drawn, newHandSize: after });
    cb && cb({ ok: true, drawn });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
    // remove socket from any room
    for (const [id, room] of rooms) {
      const idx = room.sockets.indexOf(socket.id);
      if (idx !== -1) {
        room.sockets.splice(idx, 1);
        delete room.players[socket.id];
        io.to(id).emit('playerLeft', { socketId: socket.id });
        // if room empty, delete
        if (room.sockets.length === 0) rooms.delete(id);
      }
    }
  });

  // allow clients to voluntarily leave a room without disconnecting the socket
  socket.on('leaveRoom', (roomId: string, cb?: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room) return cb && cb({ ok: false, reason: 'Room not found' });
    const idx = room.sockets.indexOf(socket.id);
    if (idx !== -1) {
      room.sockets.splice(idx, 1);
      delete room.players[socket.id];
      socket.leave(roomId);
      io.to(roomId).emit('playerLeft', { socketId: socket.id });
      if (room.sockets.length === 0) rooms.delete(roomId);
      return cb && cb({ ok: true });
    }
    return cb && cb({ ok: false, reason: 'Not in room' });
  });
});

app.get('/', (_req, res) => res.send('System Sync server running'));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
