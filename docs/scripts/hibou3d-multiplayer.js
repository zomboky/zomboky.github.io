// Multijoueur Hibou 3D — réseau + hiboux distants + lobby.
//
// Ce module est importé par le <script type="module"> de docs/hibou-3d.html.
// Tout l'état du jeu vivant dans la closure window.__hibouStart, le module ne
// touche jamais directement aux variables du jeu : il reçoit un objet `hooks`
// (références et callbacks explicites) via initMultiplayer(hooks) et expose une
// petite API (update, drawLobby, sendFire, remotes, ...). Voir
// plans/hibou3d-multiplayer.md pour l'architecture d'ensemble.
//
// Même contrainte d'infra que le client échecs (docs/scripts/chess-multiplayer.js) :
// le relais Oracle ne parle que ws:// (port 443 bloqué), donc le multijoueur
// n'est jouable que depuis http://bear.servebeer.com/hibou-3d.html.

const PRODUCTION_WS_URL = 'ws://bear.servebeer.com/hibou3d-ws';
const PSEUDO_KEY = 'h3d-mp-pseudo';
const SEND_HZ = 15;              // fréquence d'envoi de l'état local
const REMOTE_EXTRAP_MAX = 0.3;   // extrapolation max (s) entre deux paquets

const AURA_COLOR_HEX = {
  brown: 0x8a5a2b,
  purple: 0x9b30ff,
  yellow: 0xffe135,
  green: 0x4caf50,
};
const AURA_COLOR_CSS = {
  brown: '#b07840',
  purple: '#b46bff',
  yellow: '#ffe135',
  green: '#6fd06a',
};
const AURA_COLOR_LABEL = { brown: 'marron', purple: 'violet', yellow: 'jaune', green: 'vert' };

export function auraColorHex(name) {
  return AURA_COLOR_HEX[name] || 0xffffff;
}

export function initMultiplayer(hooks) {
  const { THREE, scene, hudCanvas, hctx, rrect, drawTargetIndicator } = hooks;

  let ws = null;
  let wantConnection = false; // vrai tant que le joueur est dans l'UI multijoueur
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let statusMessage = 'Non connecté';
  let lobbyError = '';

  let pseudo = null;
  let myId = null;
  let roomId = null;
  let myColor = null;
  let roster = []; // [{id, pseudo, color, alive}] — tous les joueurs de ma partie

  let presenceUsers = []; // [{id, pseudo, away, you}]
  let lobbyRooms = [];    // [{id, count, max, players:[{pseudo,color}]}]

  /** @type {Map<number, RemoteOwl>} */
  const remotes = new Map();

  let sendAccum = 0;
  let seq = 0;

  // Zones cliquables du lobby, recalculées à chaque drawLobby()
  let quickJoinRect = null;
  let roomRects = []; // [{x,y,w,h,roomId}]
  let pseudoRect = null;

  // ---------- pseudo ----------

  function loadPseudo() {
    try { return (localStorage.getItem(PSEUDO_KEY) || '').trim().slice(0, 24) || null; }
    catch { return null; }
  }
  function savePseudo(p) {
    try { localStorage.setItem(PSEUDO_KEY, p); } catch { /* stockage indisponible */ }
  }
  function ensurePseudo(forceAsk) {
    if (!forceAsk) {
      pseudo = pseudo || loadPseudo();
      if (pseudo) return true;
    }
    const raw = window.prompt('Choisissez un pseudo (visible par les autres joueurs) :', pseudo || '');
    if (raw === null) return !!pseudo; // annulé : on garde l'ancien s'il existe
    const cleaned = raw.trim().slice(0, 24);
    if (!cleaned) return !!pseudo;
    pseudo = cleaned;
    savePseudo(pseudo);
    if (ws && ws.readyState === WebSocket.OPEN) send({ type: 'hello', pseudo });
    return true;
  }

  // ---------- connexion ----------

  function wsUrl() {
    const override = new URLSearchParams(location.search).get('ws');
    if (override) return override;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      return proto + location.host + '/hibou3d-ws';
    }
    return PRODUCTION_WS_URL;
  }

  // Une page HTTPS (GitHub Pages) ne peut pas ouvrir de ws:// non sécurisé.
  function isMixedContentBlocked() {
    if (location.protocol !== 'https:') return false;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return false;
    if (new URLSearchParams(location.search).get('ws')) return false;
    return true;
  }

  function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function connect() {
    if (isMixedContentBlocked()) {
      statusMessage = 'Multijoueur indisponible en HTTPS.';
      return;
    }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    statusMessage = 'Connexion au serveur…';
    ws = new WebSocket(wsUrl());
    ws.addEventListener('open', onOpen);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
  }

  function onOpen() {
    reconnectAttempts = 0;
    statusMessage = 'Connecté';
    if (pseudo) send({ type: 'hello', pseudo });
  }

  function onClose() {
    if (roomId !== null) {
      // Coupure en pleine partie : on retombe côté jeu sur le lobby.
      clearRoomState();
      hooks.onLeftRoom();
    }
    ws = null;
    if (!wantConnection) return;
    reconnectAttempts++;
    const delay = Math.min(8000, 500 * Math.pow(2, reconnectAttempts));
    statusMessage = 'Déconnecté — reconnexion…';
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  }

  function onMessage(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'presence': {
        presenceUsers = msg.users || [];
        const me = presenceUsers.find((u) => u.you);
        if (me) myId = me.id;
        break;
      }

      case 'lobby': {
        lobbyRooms = msg.rooms || [];
        break;
      }

      case 'joined': {
        roomId = msg.roomId;
        myColor = msg.color;
        myId = msg.youId;
        roster = msg.players || [];
        lobbyError = '';
        for (const p of roster) {
          if (p.id !== myId) addRemote(p);
        }
        hooks.onJoined(myColor);
        break;
      }

      case 'game-full': {
        lobbyError = 'Cette partie est complète (4 joueurs max).';
        break;
      }

      case 'player-joined': {
        roster.push({ id: msg.id, pseudo: msg.pseudo, color: msg.color, alive: true });
        addRemote({ id: msg.id, pseudo: msg.pseudo, color: msg.color, alive: true });
        break;
      }

      case 'player-left': {
        roster = roster.filter((p) => p.id !== msg.id);
        removeRemote(msg.id);
        break;
      }

      case 'state': {
        const r = remotes.get(msg.id);
        if (!r || !Array.isArray(msg.pos) || !Array.isArray(msg.quat)) break;
        r.targetPos.fromArray(msg.pos);
        r.targetQuat.fromArray(msg.quat).normalize();
        if (Array.isArray(msg.vel)) r.vel.fromArray(msg.vel);
        r.timeSincePacket = 0;
        r.alive = msg.alive !== false;
        if (!r.hasState) {
          // Premier paquet : on téléporte au lieu d'interpoler depuis l'origine.
          r.obj.position.copy(r.targetPos);
          r.obj.quaternion.copy(r.targetQuat);
          r.hasState = true;
        }
        r.obj.visible = r.alive;
        break;
      }

      case 'fire': {
        const r = remotes.get(msg.id);
        if (!r || !r.hasState || !r.alive) break;
        // Tracer cosmétique : la vraie détection de touche est faite par le tireur.
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(r.obj.quaternion);
        hooks.onRemoteFire(r.obj.position, dir);
        break;
      }

      case 'hit': {
        if (msg.shooterId === myId) break; // déjà montré localement au moment du tir
        if (msg.targetId === myId) {
          hooks.onHitMe(msg.location, msg.shooterId);
        } else {
          const r = remotes.get(msg.targetId);
          if (r && r.hasState) hooks.spawnFX(r.obj.position, 8, 'death');
        }
        break;
      }

      case 'died': {
        const r = remotes.get(msg.id);
        const entry = roster.find((p) => p.id === msg.id);
        if (entry) entry.alive = false;
        if (r) {
          if (r.hasState) hooks.spawnFX(r.obj.position, 20, 'death', '💥');
          r.alive = false;
          r.obj.visible = false;
        }
        break;
      }

      case 'respawned': {
        const r = remotes.get(msg.id);
        const entry = roster.find((p) => p.id === msg.id);
        if (entry) entry.alive = true;
        if (r) {
          r.alive = true;
          r.hasState = false; // attend le prochain paquet d'état pour réapparaître au bon endroit
          r.obj.visible = false;
        }
        break;
      }

      case 'ammo':
      case 'respawn-ack': {
        if (typeof msg.ammo === 'number') hooks.onAmmo(msg.ammo);
        break;
      }

      case 'error': {
        lobbyError = msg.message || 'Erreur serveur.';
        break;
      }

      default:
        break;
    }
  }

  // ---------- hiboux distants ----------

  function addRemote(p) {
    if (remotes.has(p.id)) return;
    const visual = hooks.makeRemoteOwlVisual();
    const aura = hooks.makeAuraSprite(auraColorHex(p.color));
    visual.obj.add(aura.sprite);
    visual.obj.visible = false; // invisible jusqu'au premier paquet d'état
    scene.add(visual.obj);
    remotes.set(p.id, {
      id: p.id,
      pseudo: p.pseudo,
      color: p.color,
      obj: visual.obj,
      mixer: visual.mixer || null,
      auraMat: aura.mat,
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      timeSincePacket: 0,
      hasState: false,
      alive: p.alive !== false,
    });
  }

  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.obj);
    r.auraMat.dispose(); // l'aura est propre à chaque hibou ; le GLB partage ses matériaux
    remotes.delete(id);
  }

  function clearRoomState() {
    for (const id of Array.from(remotes.keys())) removeRemote(id);
    roomId = null;
    myColor = null;
    roster = [];
  }

  // ---------- API ----------

  const _predPos = new THREE.Vector3();

  return {
    // — cycle de vie —
    enterLobby() {
      wantConnection = true;
      lobbyError = '';
      if (!ensurePseudo(false)) {
        // Pas de pseudo : le lobby s'affichera avec l'invite en statut.
        statusMessage = 'Choisissez un pseudo ([P]) pour vous connecter.';
        return;
      }
      connect();
      if (ws && ws.readyState === WebSocket.OPEN) send({ type: 'list-lobby' });
    },

    leaveMultiplayer() {
      // Retour au solo : on quitte la partie et on coupe la connexion.
      send({ type: 'leave-room' });
      clearRoomState();
      wantConnection = false;
      clearTimeout(reconnectTimer);
      if (ws) { ws.close(); ws = null; }
      statusMessage = 'Non connecté';
    },

    quickJoin() {
      if (!ensurePseudo(false)) return;
      connect();
      send({ type: 'quick-join' });
    },

    joinRoom(id) {
      if (!ensurePseudo(false)) return;
      send({ type: 'join-room', roomId: id });
    },

    leaveRoom() {
      send({ type: 'leave-room' });
      clearRoomState();
    },

    changePseudo() {
      ensurePseudo(true);
    },

    // — messages de jeu —
    sendFire() { send({ type: 'fire', seq: seq++ }); },
    sendHit(targetId, location) { send({ type: 'hit', targetId, location }); },
    sendDied(cause) { send({ type: 'died', cause }); },
    sendRespawn() { send({ type: 'respawn-request' }); },
    sendPickupAmmo() { send({ type: 'pickup-ammo' }); },

    // — état consultable par le jeu —
    inRoom() { return roomId !== null; },
    myColor() { return myColor; },
    roster() { return roster; },
    remotesList() {
      const out = [];
      for (const r of remotes.values()) {
        if (r.hasState) out.push(r);
      }
      return out;
    },

    // — boucle —
    update(dt) {
      // Interpolation des hiboux distants (extrapolation courte via la vélocité
      // reçue, puis lissage exponentiel vers la position prédite).
      for (const r of remotes.values()) {
        if (!r.hasState || !r.alive) continue;
        r.timeSincePacket = Math.min(r.timeSincePacket + dt, REMOTE_EXTRAP_MAX);
        _predPos.copy(r.targetPos).addScaledVector(r.vel, r.timeSincePacket);
        const k = 1 - Math.exp(-12 * dt);
        r.obj.position.lerp(_predPos, k);
        r.obj.quaternion.slerp(r.targetQuat, 1 - Math.exp(-10 * dt));
        if (r.mixer) r.mixer.update(dt);
      }

      // Envoi périodique de l'état local (15 Hz), seulement en partie et vivant.
      if (roomId !== null && ws && ws.readyState === WebSocket.OPEN) {
        sendAccum += dt;
        if (sendAccum >= 1 / SEND_HZ) {
          sendAccum %= 1 / SEND_HZ;
          const s = hooks.getMyState();
          if (s && s.alive) {
            send({
              type: 'state',
              pos: [round2(s.pos.x), round2(s.pos.y), round2(s.pos.z)],
              quat: [round3(s.quat.x), round3(s.quat.y), round3(s.quat.z), round3(s.quat.w)],
              vel: [round2(s.vel.x), round2(s.vel.y), round2(s.vel.z)],
              seq: seq++,
            });
          }
        }
      }
    },

    // — HUD en jeu : indicateurs ESP (mode triche dev) —
    drawEsp() {
      for (const r of remotes.values()) {
        if (!r.hasState || !r.alive) continue;
        drawTargetIndicator(r.obj.position, AURA_COLOR_CSS[r.color] || '#ffffff', '🦉');
      }
    },

    // — écran lobby (dessiné sur le canvas HUD, comme drawStart/drawPaused) —
    drawLobby() {
      const W = hudCanvas.width, H = hudCanvas.height;
      hctx.save();
      hctx.fillStyle = 'rgba(4,4,18,0.8)';
      hctx.fillRect(0, 0, W, H);

      const pw = Math.min(720, W - 40), ph = Math.min(520, H - 40);
      const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
      rrect(px, py, pw, ph, 24, 'rgba(12,12,48,0.96)', 'rgba(110,90,255,0.45)');

      hctx.textAlign = 'center'; hctx.textBaseline = 'middle';
      hctx.fillStyle = '#cbc3ff'; hctx.font = '900 24px system-ui';
      hctx.fillText('🦉 MULTIJOUEUR', W / 2, py + 34);

      // Bannière contenu mixte : la page HTTPS ne peut pas joindre le relais ws://
      if (isMixedContentBlocked()) {
        rrect(px + 20, py + 58, pw - 40, 56, 12, 'rgba(60,10,10,0.9)', 'rgba(255,90,60,0.9)');
        hctx.fillStyle = '#ffd0c0'; hctx.font = 'bold 13px system-ui';
        hctx.fillText('Multijoueur indisponible en HTTPS (contenu mixte).', W / 2, py + 78);
        hctx.fillText('Utilisez http://bear.servebeer.com/hibou-3d.html', W / 2, py + 98);
        hctx.fillStyle = '#cbc3dd'; hctx.font = '13px system-ui';
        hctx.fillText('[Échap] Retour', W / 2, py + ph - 22);
        hctx.restore();
        quickJoinRect = null; roomRects = []; pseudoRect = null;
        return;
      }

      // Statut + pseudo
      hctx.fillStyle = '#9fb0d8'; hctx.font = '13px system-ui';
      hctx.fillText(statusMessage, W / 2, py + 60);
      hctx.font = 'bold 13px system-ui'; hctx.fillStyle = '#e8ecff';
      const pseudoLine = pseudo ? ('Pseudo : ' + pseudo + '   [P] changer') : '[P] Choisir un pseudo';
      hctx.fillText(pseudoLine, W / 2, py + 82);
      pseudoRect = { x: W / 2 - 140, y: py + 70, w: 280, h: 24 };

      if (lobbyError) {
        hctx.fillStyle = '#ff8866'; hctx.font = 'bold 13px system-ui';
        hctx.fillText(lobbyError, W / 2, py + 104);
      }

      const colTop = py + 124;
      const colH = ph - 124 - 110;
      const leftX = px + 20, leftW = pw * 0.42 - 30;
      const rightX = px + pw * 0.42 + 10, rightW = pw * 0.58 - 30;

      // — Colonne gauche : joueurs connectés —
      rrect(leftX, colTop, leftW, colH, 12, 'rgba(8,8,35,0.7)', 'rgba(100,90,220,0.3)');
      hctx.textAlign = 'left';
      hctx.fillStyle = '#cbc3ff'; hctx.font = 'bold 14px system-ui';
      hctx.fillText('Joueurs en ligne (' + presenceUsers.length + ')', leftX + 14, colTop + 20);
      hctx.font = '13px system-ui';
      let uy = colTop + 44;
      for (const u of presenceUsers.slice(0, Math.floor((colH - 50) / 20))) {
        hctx.fillStyle = u.away ? '#777799' : '#8fe06a';
        hctx.fillText('●', leftX + 14, uy);
        hctx.fillStyle = '#e8ecff';
        hctx.fillText(u.pseudo + (u.you ? ' (vous)' : ''), leftX + 30, uy);
        uy += 20;
      }
      if (!presenceUsers.length) {
        hctx.fillStyle = '#9fb0d8';
        hctx.fillText('Personne pour le moment…', leftX + 14, colTop + 44);
      }

      // — Colonne droite : parties en cours (cliquables) —
      rrect(rightX, colTop, rightW, colH, 12, 'rgba(8,8,35,0.7)', 'rgba(100,90,220,0.3)');
      hctx.fillStyle = '#cbc3ff'; hctx.font = 'bold 14px system-ui';
      hctx.fillText('Parties en cours (' + lobbyRooms.length + ')', rightX + 14, colTop + 20);
      roomRects = [];
      let ry = colTop + 40;
      for (const room of lobbyRooms.slice(0, Math.floor((colH - 50) / 44))) {
        const rowH = 38;
        const full = room.count >= room.max;
        rrect(rightX + 10, ry, rightW - 20, rowH, 8,
          full ? 'rgba(60,60,80,0.5)' : 'rgba(40,40,110,0.55)',
          full ? 'rgba(120,120,140,0.4)' : 'rgba(130,110,255,0.5)');
        hctx.fillStyle = '#e8ecff'; hctx.font = 'bold 12px system-ui';
        hctx.fillText('Partie #' + room.id + ' — ' + room.count + '/' + room.max +
          (full ? ' (complète)' : '  → rejoindre'), rightX + 22, ry + 13);
        hctx.fillStyle = '#b8c0e8'; hctx.font = '11px system-ui';
        const names = room.players.map((p) => p.pseudo + ' (' + (AURA_COLOR_LABEL[p.color] || p.color) + ')').join(', ');
        hctx.fillText(names.length > 60 ? names.slice(0, 57) + '…' : names, rightX + 22, ry + 28);
        if (!full) roomRects.push({ x: rightX + 10, y: ry, w: rightW - 20, h: rowH, roomId: room.id });
        ry += rowH + 6;
      }
      if (!lobbyRooms.length) {
        hctx.fillStyle = '#9fb0d8'; hctx.font = '13px system-ui';
        hctx.fillText('Aucune partie — lancez-en une !', rightX + 14, colTop + 44);
      }

      // — Bouton rejoindre (quick-join) —
      const bw = 320, bh = 46;
      const bx = W / 2 - bw / 2, by = py + ph - 84;
      rrect(bx, by, bw, bh, 14, 'rgba(70,50,200,0.9)', 'rgba(160,140,255,0.9)', 2);
      hctx.textAlign = 'center';
      hctx.fillStyle = '#fff'; hctx.font = '900 17px system-ui';
      hctx.fillText('REJOINDRE UNE PARTIE  [Entrée]', W / 2, by + bh / 2);
      quickJoinRect = { x: bx, y: by, w: bw, h: bh };

      hctx.fillStyle = '#cbc3dd'; hctx.font = '13px system-ui';
      hctx.fillText('[Échap] Retour au menu   —   [K] Test solo (sans ours)', W / 2, py + ph - 20);
      hctx.restore();
    },

    // Clic dans le lobby : bouton quick-join, ligne de partie, ou zone pseudo.
    onLobbyClick(x, y) {
      const inside = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (inside(quickJoinRect)) { this.quickJoin(); return; }
      if (inside(pseudoRect)) { this.changePseudo(); return; }
      for (const rr of roomRects) {
        if (inside(rr)) { this.joinRoom(rr.roomId); return; }
      }
    },

    colorCss(name) { return AURA_COLOR_CSS[name] || '#ffffff'; },
  };
}

function round2(v) { return Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
