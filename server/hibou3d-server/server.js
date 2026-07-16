'use strict';

// Relais WebSocket pour le multijoueur de Hibou 3D (docs/hibou-3d.html).
// Même philosophie que chess-server : tout en mémoire, pas de base de données,
// le serveur RELAIE l'état des joueurs et n'applique que des garde-fous simples
// (cadence de tir, stock de munitions, cap de joueurs par partie). La détection
// des touches est faite côté client (voir plans/hibou3d-multiplayer.md).

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.HIBOU3D_SERVER_PORT || 8098;
const HOST = process.env.HIBOU3D_SERVER_HOST || '127.0.0.1';
const WS_PATH = '/hibou3d-ws';

const ROOM_TTL_MS = 30 * 60 * 1000; // partie supprimée après 30 min sans activité
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 20 * 1000; // garde le tunnel Apache wstunnel vivant
const PSEUDO_MAX_LEN = 24;

const MAX_PLAYERS_PER_ROOM = 4;
const MAG_CAP = 150;          // taille du chargeur (côté client aussi)
const FIRE_RATE_PER_SEC = 100; // 6000 coups/min
const AMMO_PICKUP_GRANT = 60;  // munitions rendues par caisse ramassée
const KILL_AMMO_GRANT = 80;    // munitions rendues au tireur pour un kill confirmé

// Les 4 auras, assignées dans l'ordre à mesure que les joueurs rejoignent.
const AURA_COLOR_ORDER = ['brown', 'purple', 'yellow', 'green'];

/** @type {Map<string, Room>} */
const rooms = new Map();
let nextRoomId = 1;

/** @type {Map<WebSocket, Client>} */
const clients = new Map();
let nextClientId = 1;

// Garde uniquement les caractères imprimables (même logique que chess-server).
function sanitizePseudo(raw) {
  const str = String(raw || '');
  let cleaned = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const isControlChar = code < 32 || code === 127;
    if (!isControlChar) cleaned += str[i];
  }
  cleaned = cleaned.trim().slice(0, PSEUDO_MAX_LEN);
  return cleaned || null;
}

function makeRoom() {
  const id = String(nextRoomId++);
  return {
    id,
    /** @type {Map<WebSocket, Player>} */
    players: new Map(),
    colorsInUse: new Set(),
    lastActivity: Date.now(),
  };
}

function pickColor(room) {
  for (const c of AURA_COLOR_ORDER) {
    if (!room.colorsInUse.has(c)) return c;
  }
  return null; // ne devrait jamais arriver : la room est capée à 4
}

function send(ws, message) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastRoom(room, message, exclude) {
  for (const ws of room.players.keys()) {
    if (ws !== exclude) send(ws, message);
  }
}

function findPlayerEntryById(room, id) {
  for (const [ws, p] of room.players) {
    if (p.id === id) return { ws, player: p };
  }
  return null;
}

function roomRoster(room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    pseudo: p.pseudo,
    color: p.color,
    alive: p.alive,
  }));
}

function broadcastPresence() {
  const list = Array.from(clients.entries()).map(([ws, c]) => ({ ws, id: c.id, pseudo: c.pseudo, away: !!c.away }));
  for (const ws of clients.keys()) {
    if (ws.readyState !== ws.OPEN) continue;
    const users = list.map(({ ws: uws, ...rest }) => ({ ...rest, you: uws === ws }));
    ws.send(JSON.stringify({ type: 'presence', users }));
  }
}

function lobbyPayload() {
  return {
    type: 'lobby',
    rooms: Array.from(rooms.values()).map((room) => ({
      id: room.id,
      count: room.players.size,
      max: MAX_PLAYERS_PER_ROOM,
      players: roomRoster(room).map((p) => ({ pseudo: p.pseudo, color: p.color })),
    })),
  };
}

// Le lobby est envoyé à tous les clients connectés (pas seulement ceux hors
// partie) : la liste des parties en cours reste visible depuis le salon.
function broadcastLobby() {
  const payload = JSON.stringify(lobbyPayload());
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function joinRoom(ws, room) {
  const client = clients.get(ws);
  if (!client) return send(ws, { type: 'error', message: 'Choisissez d’abord un pseudo.' });
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
    return send(ws, { type: 'game-full', roomId: room.id });
  }

  const color = pickColor(room);
  const player = {
    id: client.id,
    pseudo: client.pseudo,
    color,
    alive: true,
    ammo: MAG_CAP,
    fireTokens: FIRE_RATE_PER_SEC,
    lastTokenRefill: Date.now(),
    lastHitBy: null, // dernier tireur nous ayant touché — crédité du kill si on meurt
  };
  room.players.set(ws, player);
  room.colorsInUse.add(color);
  room.lastActivity = Date.now();
  ws.roomId = room.id;

  send(ws, { type: 'joined', roomId: room.id, color, youId: player.id, players: roomRoster(room) });
  broadcastRoom(room, { type: 'player-joined', id: player.id, pseudo: player.pseudo, color }, ws);
  broadcastLobby();
}

function leaveRoom(ws) {
  const room = rooms.get(ws.roomId);
  ws.roomId = null;
  if (!room) return;
  const player = room.players.get(ws);
  if (!player) return;
  room.players.delete(ws);
  room.colorsInUse.delete(player.color);
  broadcastRoom(room, { type: 'player-left', id: player.id });
  if (room.players.size === 0) {
    rooms.delete(room.id); // une partie vide disparaît immédiatement
  }
  broadcastLobby();
}

// Seau de jetons : autorise au plus FIRE_RATE_PER_SEC tirs par seconde.
function consumeFireToken(player) {
  const now = Date.now();
  const elapsed = (now - player.lastTokenRefill) / 1000;
  player.fireTokens = Math.min(FIRE_RATE_PER_SEC, player.fireTokens + elapsed * FIRE_RATE_PER_SEC);
  player.lastTokenRefill = now;
  if (player.fireTokens < 1) return false;
  player.fireTokens -= 1;
  return true;
}

function sweepStaleRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      broadcastRoom(room, { type: 'error', message: 'La partie a expiré par inactivité.' });
      for (const ws of room.players.keys()) ws.roomId = null;
      rooms.delete(id);
    }
  }
}
setInterval(sweepStaleRooms, SWEEP_INTERVAL_MS).unref();

const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hibou3d-server ok\n');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.clientId = nextClientId++;
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
    leaveRoom(ws);
    if (clients.has(ws)) {
      clients.delete(ws);
      broadcastPresence();
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

function currentPlayer(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return { room: null, player: null };
  return { room, player: room.players.get(ws) || null };
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'hello':
    case 'set-pseudo': {
      const pseudo = sanitizePseudo(msg.pseudo);
      if (!pseudo) return;
      const existing = clients.get(ws);
      clients.set(ws, { id: ws.clientId, pseudo, away: existing ? existing.away : false });
      broadcastPresence();
      send(ws, lobbyPayload());
      break;
    }

    case 'away-status': {
      const info = clients.get(ws);
      if (!info) return;
      info.away = !!msg.away;
      broadcastPresence();
      break;
    }

    case 'list-lobby': {
      send(ws, lobbyPayload());
      break;
    }

    case 'quick-join': {
      if (ws.roomId) leaveRoom(ws);
      // Rejoint la partie ouverte la plus ancienne, sinon en crée une.
      let target = null;
      for (const room of rooms.values()) {
        if (room.players.size < MAX_PLAYERS_PER_ROOM) { target = room; break; }
      }
      if (!target) {
        target = makeRoom();
        rooms.set(target.id, target);
      }
      joinRoom(ws, target);
      break;
    }

    case 'join-room': {
      if (ws.roomId) leaveRoom(ws);
      const room = rooms.get(String(msg.roomId));
      if (!room) return send(ws, { type: 'error', message: 'Partie introuvable.' });
      joinRoom(ws, room);
      break;
    }

    case 'leave-room': {
      leaveRoom(ws);
      break;
    }

    case 'state': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player) return;
      room.lastActivity = Date.now();
      // On ne fait pas confiance au champ ammo du client : le serveur garde
      // son propre compte (décrémenté par tir accepté, incrémenté par caisse).
      broadcastRoom(room, {
        type: 'state',
        id: player.id,
        pos: msg.pos,
        quat: msg.quat,
        vel: msg.vel,
        dmg: Array.isArray(msg.dmg) ? msg.dmg : undefined,
        alive: player.alive,
        seq: msg.seq,
      }, ws);
      break;
    }

    case 'fire': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player || !player.alive) return;
      if (player.ammo <= 0) return;
      if (!consumeFireToken(player)) return;
      player.ammo -= 1;
      room.lastActivity = Date.now();
      broadcastRoom(room, { type: 'fire', id: player.id, seq: msg.seq }, ws);
      break;
    }

    case 'hit': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player || !player.alive) return;
      const location = ['head', 'left-wing', 'right-wing', 'tail', 'body'].includes(msg.location)
        ? msg.location : 'body';
      // Relaie à toute la room (y compris la victime, qui applique elle-même
      // l'effet sur son propre hibou), et mémorise le tireur pour créditer un
      // kill si la victime meurt de ce coup (voir 'died' ci-dessous).
      const target = findPlayerEntryById(room, msg.targetId);
      if (target) target.player.lastHitBy = player.id;
      broadcastRoom(room, { type: 'hit', shooterId: player.id, targetId: msg.targetId, location });
      break;
    }

    case 'died': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player) return;
      player.alive = false;
      room.lastActivity = Date.now();
      if (player.lastHitBy) {
        const shooter = findPlayerEntryById(room, player.lastHitBy);
        if (shooter) {
          shooter.player.ammo = Math.min(MAG_CAP, shooter.player.ammo + KILL_AMMO_GRANT);
          send(shooter.ws, { type: 'ammo', ammo: shooter.player.ammo });
          broadcastRoom(room, { type: 'kill', killerId: shooter.player.id, targetId: player.id });
        }
        player.lastHitBy = null;
      }
      broadcastRoom(room, { type: 'died', id: player.id, cause: msg.cause === 'headshot' ? 'headshot' : 'other' }, ws);
      break;
    }

    case 'respawn-request': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player) return;
      player.alive = true;
      player.ammo = MAG_CAP;
      room.lastActivity = Date.now();
      send(ws, { type: 'respawn-ack', ammo: player.ammo });
      broadcastRoom(room, { type: 'respawned', id: player.id }, ws);
      break;
    }

    case 'pickup-ammo': {
      const { room, player } = currentPlayer(ws);
      if (!room || !player || !player.alive) return;
      player.ammo = Math.min(MAG_CAP, player.ammo + AMMO_PICKUP_GRANT);
      room.lastActivity = Date.now();
      send(ws, { type: 'ammo', ammo: player.ammo });
      break;
    }

    default:
      break;
  }
}

httpServer.listen(PORT, HOST, () => {
  console.log(`hibou3d-server listening on ${HOST}:${PORT}${WS_PATH}`);
});
