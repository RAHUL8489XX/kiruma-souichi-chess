import { spawn } from 'child_process';

export class StockfishUCI {
  constructor(enginePath) {
    this.enginePath = enginePath;
    this.process = null;
    this.ready = false;
    this.lines = [];
    this.bestmoveResolvers = [];
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.enginePath);

      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            this.lines.push(line.trim());
            this._processLine(line.trim());
          }
        });
      });

      this.process.stderr.on('data', (data) => {
        console.error('[stockfish stderr]', data.toString());
      });

      this.process.on('error', (err) => {
        console.error('[stockfish error]', err);
        reject(err);
      });

      this.process.on('close', (code) => {
        console.log('[stockfish] Process closed with code', code);
        this.ready = false;
      });

      // Send 'uci' command and wait for 'uciok'
      this._sendCommand('uci');

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        reject(new Error('Stockfish did not respond to uci command within 5 seconds'));
      }, 5000);

      const checkReady = setInterval(() => {
        if (this.ready) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  _processLine(line) {
    if (line === 'uciok') {
      this.ready = true;
      this._sendCommand('isready');
      return;
    }

    if (line === 'readyok') {
      return;
    }

    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const move = parts[1];
      const resolver = this.bestmoveResolvers.shift();
      if (resolver) {
        resolver(move);
      }
    }
  }

  _sendCommand(cmd) {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(cmd + '\n');
    }
  }

  async getBestMove(fen, elo = 1200, movetimeMs = 1000) {
    if (!this.ready || !this.process) {
      throw new Error('Engine not ready');
    }

    return new Promise((resolve) => {
      // Reset before each search
      this._sendCommand('ucinewgame');

      // Set position
      this._sendCommand(`position fen ${fen}`);

      // Set strength
      this._sendCommand('setoption name UCI_LimitStrength value true');
      this._sendCommand(`setoption name UCI_Elo value ${elo}`);

      // Prepare resolver
      this.bestmoveResolvers.push(resolve);

      // Request best move with time limit
      this._sendCommand(`go movetime ${movetimeMs}`);
    });
  }

  stop() {
    if (this.process) {
      this._sendCommand('quit');
      this.process.kill();
      this.ready = false;
    }
  }
}
