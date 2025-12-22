// Variable globale pour savoir quel échiquier est "actif" (pour le clavier)
let activeBoardNavigate = null;

function createInteractiveBoard(containerId, pgn, annotations = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const boardElement = container.querySelector('.board');
    const prevBtn = container.querySelector('.prev-btn');
    const nextBtn = container.querySelector('.next-btn');
    const indicator = container.querySelector('.move-indicator');

    const game = new Chess();
    if (!game.load_pgn(pgn)) return;

    const history = game.history();
    const displayGame = new Chess();
    let currentIdx = -1;

    function getValidMoves(chessInstance) {
        const dests = new Map();
        chessInstance.SQUARES.forEach(s => {
            const ms = chessInstance.moves({ square: s, verbose: true });
            if (ms.length) dests.set(s, ms.map(m => m.to));
        });
        return dests;
    }

    const ground = Chessground(boardElement, {
        fen: displayGame.fen(),
        movable: { free: false, dests: getValidMoves(displayGame) },
        drawable: { enabled: true, visible: true, shapes: annotations[-1] || [] }
    });

    function updateUI() {
        ground.set({
            fen: displayGame.fen(),
            movable: { dests: getValidMoves(displayGame) }
        });
        
        if (indicator) {
            if (currentIdx === -1) indicator.innerText = "Position de départ";
            else {
                const moveNum = Math.floor(currentIdx / 2) + 1;
                const dots = currentIdx % 2 === 0 ? "." : "...";
                indicator.innerText = `${moveNum}${dots} ${history[currentIdx]}`;
            }
        }
        ground.set({ drawable: { shapes: annotations[currentIdx] || [] } });
    }

    function navigate(direction) {
        const nextIdx = currentIdx + direction;
        if (nextIdx >= -1 && nextIdx < history.length) {
            currentIdx = nextIdx;
            displayGame.reset();
            for (let i = 0; i <= currentIdx; i++) displayGame.move(history[i]);
            updateUI();
        }
    }

    // Assignation des clics boutons
    if (prevBtn) prevBtn.onclick = () => navigate(-1);
    if (nextBtn) nextBtn.onclick = () => navigate(1);

    // QUAND ON CLIQUE SUR L'ÉCHIQUIER, IL DEVIENT L'ÉCHIQUIER ACTIF POUR LE CLAVIER
    container.addEventListener('mousedown', () => {
        activeBoardNavigate = navigate; 
    });

    // Par défaut, le premier chargé est l'actif
    if (!activeBoardNavigate) activeBoardNavigate = navigate;

    updateUI();
}

// GESTIONNAIRE DE CLAVIER GLOBAL (une seule fois)
window.addEventListener('keydown', (e) => {
    if (activeBoardNavigate) {
        if (e.key === "ArrowLeft") activeBoardNavigate(-1);
        if (e.key === "ArrowRight") activeBoardNavigate(1);
    }
});