'use strict';

const { spawn } = require('child_process');
const readline = require('readline');

const DEFAULT_PATH = process.env.STOCKFISH_PATH || '/opt/stockfish/stockfish';

/** Thin UCI wrapper around a single Stockfish process (one per room). */
class StockfishEngine {
  constructor(path = DEFAULT_PATH) {
    this.proc = spawn(path, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.waiters = [];
    this.rl.on('line', (line) => this._onLine(line));
    this.proc.on('error', (err) => this._failAll(err));
    this.ready = this._handshake();
  }

  _onLine(line) {
    if (this.waiters.length && this.waiters[0].test(line)) {
      this.waiters.shift().resolve(line);
    }
  }

  _failAll(err) {
    while (this.waiters.length) this.waiters.shift().reject(err);
  }

  _waitFor(test, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const entry = {
        test,
        resolve: (line) => {
          clearTimeout(timer);
          resolve(line);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(entry);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('Stockfish timeout'));
      }, timeoutMs);
      this.waiters.push(entry);
    });
  }

  _write(cmd) {
    if (this.proc.stdin.writable) this.proc.stdin.write(cmd + '\n');
  }

  async _handshake() {
    this._write('uci');
    await this._waitFor((l) => l.trim() === 'uciok');
    this._write('setoption name Threads value 2');
    this._write('setoption name Hash value 128');
    this._write('isready');
    await this._waitFor((l) => l.trim() === 'readyok');
  }

  async bestMove(fen, depth = 18) {
    await this.ready;
    this._write(`position fen ${fen}`);
    this._write(`go depth ${depth}`);
    const line = await this._waitFor((l) => l.startsWith('bestmove'), 30000);
    const uciMove = line.trim().split(/\s+/)[1];
    if (!uciMove || uciMove === '(none)') return null;
    return {
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove.length > 4 ? uciMove.slice(4, 5) : undefined,
    };
  }

  destroy() {
    try {
      this._write('quit');
    } catch {
      /* ignore */
    }
    try {
      this.proc.kill();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { StockfishEngine };
