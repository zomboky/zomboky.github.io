(function () {
  'use strict';

  const els = {
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game'),
    createBtn: document.getElementById('create-btn'),
    joinBtn: document.getElementById('join-btn'),
    joinInput: document.getElementById('join-code'),
    lobbyError: document.getElementById('lobby-error'),
    board: document.getElementById('board'),
    roomCode: document.getElementById('room-code'),
    roomCodeRow: document.getElementById('room-code-row'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    connStatus: document.getElementById('conn-status'),
    myColor: document.getElementById('my-color'),
    status: document.getElementById('status'),
    resignBtn: document.getElementById('resign-btn'),
    rematchBtn: document.getElementById('rematch-btn'),
    quitBtn: document.getElementById('quit-btn'),
    movesList: document.getElementById('moves-list'),
    promoModal: document.getElementById('promo-modal'),
    endOverlay: document.getElementById('end-overlay'),
    endMessage: document.getElementById('end-message'),
    endRematchBtn: document.getElementById('end-rematch-btn'),
    endQuitBtn: document.getElementById('end-quit-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    pseudoDisplay: document.getElementById('pseudo-display'),
    editPseudoBtn: document.getElementById('edit-pseudo-btn'),
    pseudoModal: document.getElementById('pseudo-modal'),
    pseudoInput: document.getElementById('pseudo-input'),
    pseudoError: document.getElementById('pseudo-error'),
    pseudoConfirmBtn: document.getElementById('pseudo-confirm-btn'),
    presenceList: document.getElementById('presence-list'),
    playAiBtn: document.getElementById('play-ai-btn'),
    opponentBar: document.getElementById('opponent-bar'),
    opponentBadge: document.getElementById('opponent-badge'),
    opponentName: document.getElementById('opponent-name'),
    opponentStatus: document.getElementById('opponent-status'),
    owlLogo: document.getElementById('owl-logo'),
    premoveBadge: document.getElementById('premove-badge'),
    resumeBanner: document.getElementById('resume-banner'),
    resumeBtn: document.getElementById('resume-btn'),
  };

  const SESSION_KEY = 'chess-mp-session';
  const PSEUDO_KEY = 'chess-mp-pseudo';
  const THEME_KEY = 'chess-theme';
  const PIECE_NAMES = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' };

  const game = new Chess();
  let ground = null;
  let ws = null;
  let roomCode = null;
  let myColor = null;
  let opponentPresent = false;
  let gameFinished = false;
  let pendingPromotion = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let pseudo = null;
  let vsBot = false;
  let inGame = false; // becomes true once the player has actually entered a game this page-load
  let opponentAway = false;
  let premoveOrig = null;
  let premoveDest = null;

  // ---------- session persistence (survives page reloads) ----------

  function saveSession(code, color) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ code, color }));
    } catch {
      /* localStorage unavailable, ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  // ---------- pseudo ----------

  function loadPseudo() {
    try {
      return localStorage.getItem(PSEUDO_KEY);
    } catch {
      return null;
    }
  }

  function savePseudo(value) {
    pseudo = value;
    try {
      localStorage.setItem(PSEUDO_KEY, value);
    } catch {
      /* ignore */
    }
    if (els.pseudoDisplay) els.pseudoDisplay.textContent = pseudo;
    sendHello();
  }

  function sendHello() {
    if (pseudo) send({ type: 'hello', pseudo });
  }

  function openPseudoModal() {
    if (!els.pseudoModal) return;
    if (els.pseudoInput) els.pseudoInput.value = pseudo || '';
    if (els.pseudoError) els.pseudoError.textContent = '';
    els.pseudoModal.classList.remove('hidden');
    if (els.pseudoInput) els.pseudoInput.focus();
  }

  function closePseudoModal() {
    if (els.pseudoModal) els.pseudoModal.classList.add('hidden');
  }

  function confirmPseudo() {
    const value = (els.pseudoInput && els.pseudoInput.value || '').trim().slice(0, 24);
    if (!value) {
      if (els.pseudoError) els.pseudoError.textContent = 'Choisissez un pseudo.';
      return;
    }
    savePseudo(value);
    closePseudoModal();
  }

  if (els.pseudoConfirmBtn) els.pseudoConfirmBtn.addEventListener('click', confirmPseudo);
  if (els.editPseudoBtn) els.editPseudoBtn.addEventListener('click', openPseudoModal);
  if (els.pseudoInput) {
    els.pseudoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmPseudo();
    });
  }

  pseudo = loadPseudo();
  if (pseudo && els.pseudoDisplay) {
    els.pseudoDisplay.textContent = pseudo;
  } else {
    openPseudoModal();
  }

  // ---------- theme ----------

  function applyTheme(dark) {
    document.documentElement.classList.toggle('theme-dark', dark);
    if (els.themeToggle) els.themeToggle.checked = dark;
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  if (els.themeToggle) {
    els.themeToggle.checked = document.documentElement.classList.contains('theme-dark');
    els.themeToggle.addEventListener('change', () => applyTheme(els.themeToggle.checked));
  }

  // ---------- presence ----------

  function renderPresence(users) {
    if (!els.presenceList) return;
    els.presenceList.innerHTML = '';
    (users || []).forEach((user) => {
      const li = document.createElement('li');
      li.className = 'presence-item';

      const dot = document.createElement('span');
      dot.className = 'presence-dot' + (user.away ? ' away' : ' present');
      dot.title = user.away ? 'Absent' : 'Présent';
      li.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'presence-name';
      name.textContent = user.pseudo + (user.you ? ' (vous)' : '');
      li.appendChild(name);

      els.presenceList.appendChild(li);
    });
  }

  // ---------- presence: present / away via the Page Visibility API ----------

  function sendAwayStatus(away) {
    send({ type: 'away-status', away: !!away });
  }

  document.addEventListener('visibilitychange', () => {
    sendAwayStatus(document.hidden);
  });

  // ---------- opponent bar (human name or GM Hibou Chess) ----------

  function renderOpponentStatus() {
    if (!els.opponentStatus) return;
    if (vsBot || !opponentPresent) {
      els.opponentStatus.classList.add('hidden');
      return;
    }
    els.opponentStatus.classList.remove('hidden');
    els.opponentStatus.className = 'presence-dot ' + (opponentAway ? 'away' : 'present');
    els.opponentStatus.title = opponentAway ? 'Absent' : 'Présent';
  }

  function updateOpponentBar(opponentPseudo, away) {
    opponentAway = !!away;
    if (!els.opponentBar) return;
    if (vsBot) {
      els.opponentBar.classList.remove('hidden');
      if (els.opponentBadge) els.opponentBadge.classList.remove('hidden');
      if (els.owlLogo) els.owlLogo.classList.remove('hidden');
      if (els.opponentName) els.opponentName.textContent = 'Hibou Chess';
    } else if (opponentPseudo) {
      els.opponentBar.classList.remove('hidden');
      if (els.opponentBadge) els.opponentBadge.classList.add('hidden');
      if (els.owlLogo) els.owlLogo.classList.add('hidden');
      if (els.opponentName) els.opponentName.textContent = opponentPseudo;
    } else {
      els.opponentBar.classList.add('hidden');
    }
    if (els.roomCodeRow) els.roomCodeRow.classList.toggle('hidden', vsBot);
    if (els.copyLinkBtn) els.copyLinkBtn.classList.toggle('hidden', vsBot);
    renderOpponentStatus();
  }

  // ---------- websocket plumbing ----------

  // The relay only speaks plain ws:// (no TLS in front of it — the Oracle
  // Cloud security list blocks inbound 443, so wss:// just times out).
  // That means this page must itself be loaded over http:// to reach it:
  // a page served over https (e.g. GitHub Pages) is not allowed by
  // browsers to open an insecure ws:// connection (mixed content).
  const PRODUCTION_WS_URL = 'ws://bear.servebeer.com/chess-ws';

  function wsUrl() {
    const override = new URLSearchParams(location.search).get('ws');
    if (override) return override;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      return proto + location.host + '/chess-ws';
    }
    // Always point at the Oracle-hosted relay, regardless of which copy of
    // the static files served this page (GitHub Pages or the Oracle host
    // itself) — GitHub Pages has no backend of its own.
    return PRODUCTION_WS_URL;
  }

  function warnIfMixedContent() {
    if (location.protocol !== 'https:') return false;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return false;
    if (new URLSearchParams(location.search).get('ws')) return false;
    const banner = document.getElementById('https-warning');
    if (banner) banner.classList.remove('hidden');
    setConnStatus('Multijoueur indisponible en HTTPS.');
    return true;
  }

  function connect() {
    if (warnIfMixedContent()) return;
    setConnStatus('Connexion au serveur...');
    ws = new WebSocket(wsUrl());
    ws.addEventListener('open', onOpen);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
  }

  function onOpen() {
    reconnectAttempts = 0;
    setConnStatus('Connecté');
    sendHello();
    sendAwayStatus(document.hidden);
    // Only auto-rejoin the saved game across a *reconnect* while we're
    // already sitting in the game view (network blip, tab woken up after
    // being backgrounded, ...). On a fresh page load we always land on the
    // lobby — resuming a past game is then an explicit click, see
    // updateResumeBanner()/resumeBtn.
    const saved = loadSession();
    if (inGame && saved && saved.code && saved.color) {
      roomCode = saved.code;
      send({ type: 'rejoin', code: saved.code, color: saved.color });
    }
  }

  function onClose() {
    setConnStatus('Connexion perdue — nouvelle tentative...');
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function setConnStatus(text) {
    if (els.connStatus) els.connStatus.textContent = text;
  }

  // ---------- server message handling ----------

  function onMessage(evt) {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'created':
        roomCode = msg.code;
        myColor = msg.color;
        vsBot = !!msg.vsBot;
        opponentPresent = vsBot;
        saveSession(msg.code, msg.color);
        enterGameView();
        ensureBoard();
        game.load(msg.fen);
        updateOpponentBar(msg.opponentPseudo, msg.opponentAway);
        refreshBoard(msg);
        setStatus(vsBot ? 'Partie lancée contre GM Hibou Chess.' : 'Partie créée : partagez le code ci-dessus avec votre adversaire.');
        break;

      case 'joined':
        roomCode = msg.code;
        myColor = msg.color;
        vsBot = false;
        opponentPresent = false;
        saveSession(msg.code, msg.color);
        enterGameView();
        ensureBoard();
        game.load(msg.fen);
        updateOpponentBar(msg.opponentPseudo, msg.opponentAway);
        refreshBoard(msg);
        setStatus('En attente du démarrage de la partie...');
        break;

      case 'start':
        myColor = msg.color;
        vsBot = !!msg.vsBot;
        saveSession(roomCode, msg.color);
        opponentPresent = true;
        gameFinished = false;
        clearMovesList();
        enterGameView();
        ensureBoard();
        game.load(msg.fen);
        ground.set({ orientation: myColor });
        hideEndOverlay();
        updateOpponentBar(msg.opponentPseudo, msg.opponentAway);
        refreshBoard(msg);
        break;

      case 'opponent-joined':
        opponentPresent = true;
        game.load(msg.fen);
        updateOpponentBar(msg.opponentPseudo, msg.opponentAway);
        refreshBoard(msg);
        break;

      case 'presence':
        renderPresence(msg.users);
        break;

      case 'opponent-status':
        opponentAway = !!msg.away;
        renderOpponentStatus();
        break;

      case 'opponent-left':
        opponentPresent = false;
        renderOpponentStatus();
        setStatus('Votre adversaire s’est déconnecté. En attente de reconnexion...');
        lockBoard();
        break;

      case 'move': {
        const move = game.move({ from: msg.from, to: msg.to, promotion: msg.promotion || undefined });
        if (!move) {
          send({ type: 'resync', code: roomCode });
          break;
        }
        appendMoveToList(move.san);
        refreshBoard(msg, { from: msg.from, to: msg.to });
        break;
      }

      case 'state':
        myColor = msg.color || myColor;
        game.load(msg.fen);
        refreshBoard(msg);
        break;

      case 'game-over':
        gameFinished = true;
        showEndOverlay(describeResult(msg.reason, msg.winner));
        lockBoard();
        break;

      case 'rematch-requested':
        setStatus('Votre adversaire propose une revanche. Cliquez sur "Revanche" pour accepter.');
        break;

      case 'error':
        handleServerError(msg.message);
        break;

      default:
        break;
    }
  }

  function handleServerError(message) {
    const inLobby = !els.lobby || !els.lobby.classList.contains('hidden');
    if (inLobby) {
      if (els.lobbyError) els.lobbyError.textContent = message || 'Une erreur est survenue.';
      if (roomCode) {
        // A create/join/resume attempt failed before the game view even
        // opened (e.g. the saved game expired) — drop it instead of
        // resyncing forever against a room that no longer exists.
        clearSession();
        roomCode = null;
        myColor = null;
        inGame = false;
        updateResumeBanner();
      }
      return;
    }
    setStatus(message || 'Une erreur est survenue.');
    send({ type: 'resync', code: roomCode });
  }

  // ---------- board rendering ----------

  function getDests() {
    const dests = new Map();
    game.SQUARES.forEach((square) => {
      const moves = game.moves({ square, verbose: true });
      if (moves.length) dests.set(square, [...new Set(moves.map((m) => m.to))]);
    });
    return dests;
  }

  function isPromotion(orig, dest) {
    return game
      .moves({ square: orig, verbose: true })
      .some((m) => m.to === dest && m.flags.indexOf('p') !== -1);
  }

  function ensureBoard() {
    if (ground) return;
    ground = Chessground(els.board, {
      fen: game.fen(),
      orientation: myColor || 'white',
      movable: { free: false, color: undefined, dests: new Map(), events: { after: onUserMove } },
      premovable: { enabled: false, showDests: true, events: { set: onSetPremove, unset: onUnsetPremove } },
      events: { select: onSquareSelect },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true },
    });
  }

  function canMove(msg) {
    return opponentPresent && !msg.gameOver && msg.turn === myColor;
  }

  function refreshBoard(msg, lastMove) {
    ensureBoard();
    const active = opponentPresent && !msg.gameOver;
    const isMyTurn = canMove(msg);
    const movableConfig = active
      ? { color: myColor, dests: isMyTurn ? getDests() : new Map() }
      : { color: undefined, dests: new Map() };

    ground.set({
      fen: game.fen(),
      turnColor: msg.turn,
      check: !!msg.check,
      lastMove: lastMove ? [lastMove.from, lastMove.to] : undefined,
      movable: movableConfig,
      premovable: { enabled: active },
    });

    // A queued premove becomes playable the instant it's our turn again —
    // chessground validates it against the fresh dests set just above and,
    // if still legal, fires onUserMove exactly like a manual move.
    const premovePlayed = isMyTurn && ground.playPremove();

    if (!premovePlayed) updateStatusText(msg);

    if (msg.gameOver && msg.result) {
      gameFinished = true;
      showEndOverlay(describeResult(msg.result.reason, msg.result.winner));
      lockBoard();
    }
  }

  function lockBoard() {
    if (!ground) return;
    ground.cancelPremove();
    ground.set({ movable: { color: undefined, dests: new Map() }, premovable: { enabled: false } });
  }

  function onUserMove(orig, dest) {
    if (isPromotion(orig, dest)) {
      pendingPromotion = { orig, dest };
      openPromoModal();
      return;
    }
    submitMove(orig, dest, null);
  }

  // ---------- premoves ----------

  function onSetPremove(orig, dest) {
    premoveOrig = orig;
    premoveDest = dest;
    if (els.premoveBadge) els.premoveBadge.classList.remove('hidden');
  }

  function onUnsetPremove() {
    premoveOrig = null;
    premoveDest = null;
    if (els.premoveBadge) els.premoveBadge.classList.add('hidden');
  }

  // Clicking a second, unrelated empty square cancels the pending premove
  // (chessground only replaces/clears it on a fresh drag by itself).
  function onSquareSelect(key) {
    if (!ground || !premoveDest) return;
    if (!ground.state.pieces.get(key)) ground.cancelPremove();
  }

  // Clicking anywhere outside the board also cancels the pending premove.
  document.addEventListener('pointerdown', (e) => {
    if (!premoveDest || !ground) return;
    if (els.board && !els.board.contains(e.target)) ground.cancelPremove();
  });

  function submitMove(from, to, promotion) {
    send({ type: 'move', code: roomCode, from, to, promotion: promotion || undefined });
    lockBoard();
    setStatus('Coup envoyé...');
  }

  // ---------- promotion modal ----------

  function openPromoModal() {
    if (els.promoModal) els.promoModal.classList.remove('hidden');
  }

  function closePromoModal() {
    if (els.promoModal) els.promoModal.classList.add('hidden');
    pendingPromotion = null;
  }

  if (els.promoModal) {
    els.promoModal.querySelectorAll('[data-piece]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!pendingPromotion) return;
        const { orig, dest } = pendingPromotion;
        const piece = btn.getAttribute('data-piece');
        closePromoModal();
        submitMove(orig, dest, piece);
      });
    });
  }

  // ---------- status / moves / end overlay ----------

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function updateStatusText(msg) {
    if (els.myColor) els.myColor.textContent = myColor === 'white' ? 'Blancs' : myColor === 'black' ? 'Noirs' : '—';
    if (msg.gameOver) return;
    if (!opponentPresent) {
      setStatus('En attente d’un adversaire...');
      return;
    }
    const amTurn = msg.turn === myColor;
    if (amTurn) setStatus(msg.check ? 'Échec ! À vous de jouer.' : 'À vous de jouer.');
    else setStatus(msg.check ? 'Échec ! Au tour de l’adversaire.' : 'Au tour de l’adversaire.');
  }

  function clearMovesList() {
    if (els.movesList) els.movesList.innerHTML = '';
  }

  function appendMoveToList(san) {
    if (!els.movesList) return;
    const isWhiteMove = els.movesList.children.length % 2 === 0;
    if (isWhiteMove) {
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = String(Math.floor(els.movesList.children.length / 2) + 1) + '.';
      const w = document.createElement('span');
      w.className = 'move-white';
      w.textContent = san;
      li.appendChild(num);
      li.appendChild(w);
      els.movesList.appendChild(li);
    } else {
      const li = els.movesList.lastElementChild;
      const b = document.createElement('span');
      b.className = 'move-black';
      b.textContent = san;
      if (li) li.appendChild(b);
    }
    els.movesList.scrollTop = els.movesList.scrollHeight;
  }

  function describeResult(reason, winner) {
    const iWon = winner && winner === myColor;
    const iLost = winner && winner !== myColor;
    switch (reason) {
      case 'checkmate':
        return iWon ? 'Échec et mat — vous avez gagné !' : iLost ? 'Échec et mat — vous avez perdu.' : 'Échec et mat.';
      case 'resign':
        return iWon ? 'Votre adversaire a abandonné — vous avez gagné !' : 'Vous avez abandonné la partie.';
      case 'stalemate':
        return 'Pat — partie nulle.';
      case 'threefold':
        return 'Nulle par répétition de position.';
      case 'insufficient-material':
        return 'Nulle — matériel insuffisant.';
      default:
        return 'Partie nulle.';
    }
  }

  function showEndOverlay(message) {
    if (!els.endOverlay) return;
    els.endMessage.textContent = message;
    els.endOverlay.classList.remove('hidden');
  }

  function hideEndOverlay() {
    if (els.endOverlay) els.endOverlay.classList.add('hidden');
  }

  // ---------- lobby wiring ----------

  function enterGameView() {
    inGame = true;
    if (els.lobby) els.lobby.classList.add('hidden');
    if (els.game) els.game.classList.remove('hidden');
    if (els.roomCode) els.roomCode.textContent = roomCode;
    updateInviteUrl();
  }

  function returnToLobby() {
    clearSession();
    roomCode = null;
    myColor = null;
    vsBot = false;
    opponentPresent = false;
    gameFinished = false;
    inGame = false;
    premoveOrig = null;
    premoveDest = null;
    if (els.premoveBadge) els.premoveBadge.classList.add('hidden');
    game.reset();
    clearMovesList();
    hideEndOverlay();
    if (els.opponentBar) els.opponentBar.classList.add('hidden');
    if (els.roomCodeRow) els.roomCodeRow.classList.remove('hidden');
    if (els.copyLinkBtn) els.copyLinkBtn.classList.remove('hidden');
    if (ground) {
      ground.destroy();
      ground = null;
    }
    if (els.game) els.game.classList.add('hidden');
    if (els.lobby) els.lobby.classList.remove('hidden');
    if (els.lobbyError) els.lobbyError.textContent = '';
    updateResumeBanner();
    history.replaceState(null, '', location.pathname);
  }

  // ---------- resume banner (return to a game left running server-side) ----------

  function updateResumeBanner() {
    if (!els.resumeBanner) return;
    const saved = loadSession();
    els.resumeBanner.classList.toggle('hidden', !saved || !saved.code || !saved.color);
  }

  if (els.resumeBtn) {
    els.resumeBtn.addEventListener('click', () => {
      const saved = loadSession();
      if (!saved || !saved.code || !saved.color) {
        updateResumeBanner();
        return;
      }
      if (els.lobbyError) els.lobbyError.textContent = '';
      roomCode = saved.code;
      inGame = true;
      send({ type: 'rejoin', code: saved.code, color: saved.color });
    });
  }

  updateResumeBanner();

  function updateInviteUrl() {
    if (!roomCode) return;
    const url = new URL(location.href);
    url.searchParams.set('code', roomCode);
    history.replaceState(null, '', url.toString());
  }

  function copyInviteLink() {
    const url = new URL(location.href);
    url.searchParams.set('code', roomCode);
    const text = url.toString();
    const done = () => {
      if (!els.copyLinkBtn) return;
      const original = els.copyLinkBtn.textContent;
      els.copyLinkBtn.textContent = 'Copié !';
      setTimeout(() => {
        els.copyLinkBtn.textContent = original;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      /* ignore */
    }
    document.body.removeChild(input);
  }

  if (els.createBtn) {
    els.createBtn.addEventListener('click', () => {
      if (els.lobbyError) els.lobbyError.textContent = '';
      send({ type: 'create' });
    });
  }

  if (els.joinBtn) {
    els.joinBtn.addEventListener('click', () => {
      const code = (els.joinInput.value || '').trim().toUpperCase();
      if (!code) {
        els.lobbyError.textContent = 'Entrez un code de partie.';
        return;
      }
      els.lobbyError.textContent = '';
      send({ type: 'join', code });
    });
  }

  if (els.joinInput) {
    els.joinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') els.joinBtn.click();
    });
  }

  if (els.playAiBtn) {
    els.playAiBtn.addEventListener('click', () => {
      if (els.lobbyError) els.lobbyError.textContent = '';
      const choice = document.querySelector('input[name="ai-color"]:checked');
      const color = choice ? choice.value : 'random';
      send({ type: 'create-ai', color });
    });
  }

  if (els.copyLinkBtn) els.copyLinkBtn.addEventListener('click', copyInviteLink);
  if (els.resignBtn) {
    els.resignBtn.addEventListener('click', () => {
      if (roomCode && !gameFinished) send({ type: 'resign', code: roomCode });
    });
  }
  if (els.rematchBtn) {
    els.rematchBtn.addEventListener('click', () => {
      if (roomCode) send({ type: 'rematch', code: roomCode });
    });
  }
  if (els.endRematchBtn) {
    els.endRematchBtn.addEventListener('click', () => {
      if (roomCode) send({ type: 'rematch', code: roomCode });
    });
  }
  if (els.quitBtn) els.quitBtn.addEventListener('click', returnToLobby);
  if (els.endQuitBtn) els.endQuitBtn.addEventListener('click', returnToLobby);

  // ---------- boot ----------

  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode && els.joinInput) els.joinInput.value = urlCode.toUpperCase();

  connect();
})();
