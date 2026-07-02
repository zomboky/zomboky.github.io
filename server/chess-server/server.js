'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { Chess } = require('./chess.min.js');

const PORT = process.env.CHESS_SERVER_PORT || 8095;
const HOST = process.env.CHESS_SERVER_HOST || '127.0.0.1';
const WS_PATH = '/chess-ws';

const ROOM_TTL_MS = 30 * 60 * 1000; // delete a room after 30min of no activity
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 20 * 1000; // keep the Apache wstunnel proxy alive

// Codes avoid ambiguous characters (0/O, 1/I).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** @type {Map<string, Room>} */
const rooms = new Map();

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function makeRoom(code) {
  return {
    code,
    chess: new Chess(),
    players: { white: null, black: null },
    rematch: { white: false, black: false },
    lastActivity: Date.now(),
  };
}

function opponentColor(color) {
  return color === 'white' ? 'black' : 'white';
}

function colorFromChessTurn(chess) {
  return chess.turn() === 'w' ? 'white' : 'black';
}

function send(ws, message) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(room, message, exclude) {
  for (const color of ['white', 'black']) {
    const ws = room.players[color];
    if (ws && ws !== exclude) send(ws, message);
  }
}

function statusPayload(room) {
  const chess = room.chess;
  const gameOver = chess.game_over();
  let result = null;
  if (gameOver) {
    if (chess.in_checkmate()) {
      result = { reason: 'checkmate', winner: opponentColor(colorFromChessTurn(chess)) };
    } else if (chess.in_stalemate()) {
      result = { reason: 'stalemate', winner: null };
    } else if (chess.in_threefold_repetition()) {
      result = { reason: 'threefold', winner: null };
    } else if (chess.insufficient_material()) {
      result = { reason: 'insufficient-material', winner: null };
    } else {
      result = { reason: 'draw', winner: null };
    }
  }
  return {
    fen: chess.fen(),
    turn: colorFromChessTurn(chess),
    check: chess.in_check(),
    gameOver,
    result,
  };
}

function sendStartToEach(room) {
  for (const color of ['white', 'black']) {
    const ws = room.players[color];
    if (ws) send(ws, { type: 'start', color, ...statusPayload(room) });
  }
}

function sweepStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      broadcast(room, { type: 'error', message: 'La partie a expiré par inactivité.' });
      rooms.delete(code);
    }
  }
}
setInterval(sweepStaleRooms, SWEEP_INTERVAL_MS).unref();

const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('chess-server ok\n');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(ws, { type: 'error', message: 'Message invalide.' });
    }
    if (!msg || typeof msg.type !== 'string') return;

    try {
      handleMessage(ws, msg);
    } catch (err) {
      send(ws, { type: 'error', message: 'Erreur serveur.' });
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    if (ws.color && room.players[ws.color] === ws) {
      room.players[ws.color] = null;
      const opp = room.players[opponentColor(ws.color)];
      if (opp) send(opp, { type: 'opponent-left' });
    }
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);
heartbeat.unref();

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'create': {
      const code = generateCode();
      const room = makeRoom(code);
      const color = Math.random() < 0.5 ? 'white' : 'black';
      room.players[color] = ws;
      rooms.set(code, room);
      ws.roomCode = code;
      ws.color = color;
      send(ws, { type: 'created', code, color, ...statusPayload(room) });
      break;
    }

    case 'join': {
      const code = normalizeCode(msg.code);
      const room = rooms.get(code);
      if (!room) return send(ws, { type: 'error', message: 'Code de partie introuvable.' });

      let color = null;
      if (!room.players.white) color = 'white';
      else if (!room.players.black) color = 'black';
      else return send(ws, { type: 'error', message: 'Cette partie est déjà complète.' });

      room.players[color] = ws;
      ws.roomCode = code;
      ws.color = color;
      room.lastActivity = Date.now();

      send(ws, { type: 'joined', code, color, ...statusPayload(room) });
      if (room.players.white && room.players.black) {
        sendStartToEach(room);
      }
      break;
    }

    case 'rejoin': {
      const code = normalizeCode(msg.code);
      const room = rooms.get(code);
      if (!room) return send(ws, { type: 'error', message: 'Partie introuvable ou expirée.' });
      const color = msg.color === 'black' ? 'black' : 'white';
      if (room.players[color] && room.players[color] !== ws) {
        return send(ws, { type: 'error', message: 'Cette couleur est déjà connectée.' });
      }
      room.players[color] = ws;
      ws.roomCode = code;
      ws.color = color;
      room.lastActivity = Date.now();
      send(ws, { type: 'start', color, ...statusPayload(room) });
      const opp = room.players[opponentColor(color)];
      if (opp) send(opp, { type: 'opponent-joined', ...statusPayload(room) });
      break;
    }

    case 'move': {
      const room = rooms.get(ws.roomCode);
      if (!room || !ws.color) return send(ws, { type: 'error', message: 'Vous n’êtes dans aucune partie.' });
      if (!room.players.white || !room.players.black) {
        return send(ws, { type: 'error', message: 'En attente de l’adversaire.' });
      }
      if (room.chess.game_over()) {
        return send(ws, { type: 'error', message: 'La partie est terminée.' });
      }
      if (ws.color !== colorFromChessTurn(room.chess)) {
        return send(ws, { type: 'error', message: 'Ce n’est pas votre tour.' });
      }

      const moveResult = room.chess.move({
        from: msg.from,
        to: msg.to,
        promotion: msg.promotion || 'q',
      });
      if (!moveResult) return send(ws, { type: 'error', message: 'Coup illégal.' });

      room.lastActivity = Date.now();
      room.rematch.white = false;
      room.rematch.black = false;

      broadcast(room, {
        type: 'move',
        from: moveResult.from,
        to: moveResult.to,
        promotion: moveResult.promotion || null,
        san: moveResult.san,
        ...statusPayload(room),
      });
      break;
    }

    case 'resign': {
      const room = rooms.get(ws.roomCode);
      if (!room || !ws.color) return;
      room.lastActivity = Date.now();
      broadcast(room, { type: 'game-over', reason: 'resign', winner: opponentColor(ws.color) });
      break;
    }

    case 'rematch': {
      const room = rooms.get(ws.roomCode);
      if (!room || !ws.color) return;
      room.lastActivity = Date.now();
      room.rematch[ws.color] = true;

      if (room.rematch.white && room.rematch.black) {
        room.chess.reset();
        room.rematch.white = false;
        room.rematch.black = false;
        // swap sides so the same player isn't always white
        const white = room.players.white;
        const black = room.players.black;
        room.players.white = black;
        room.players.black = white;
        if (room.players.white) room.players.white.color = 'white';
        if (room.players.black) room.players.black.color = 'black';
        sendStartToEach(room);
      } else {
        const opp = room.players[opponentColor(ws.color)];
        if (opp) send(opp, { type: 'rematch-requested' });
      }
      break;
    }

    case 'resync': {
      const room = rooms.get(ws.roomCode);
      if (!room || !ws.color) return send(ws, { type: 'error', message: 'Partie introuvable.' });
      send(ws, { type: 'state', color: ws.color, ...statusPayload(room) });
      break;
    }

    default:
      break;
  }
}

httpServer.listen(PORT, HOST, () => {
  console.log(`chess-server listening on ${HOST}:${PORT}${WS_PATH}`);
});
