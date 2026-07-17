import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StockfishUCI } from './stockfish-uci.js';
import { streamVictoryCertificate } from './certificate.js';
import { saveGame, getGame, listGames, getLeaderboard, getStatsSummary } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

// Point this at your stockfish executable. Defaults to ./engine/stockfish.exe on
// Windows, or ./engine/stockfish on Linux/macOS (downloaded at deploy time).
const ENGINE_PATH = process.env.STOCKFISH_PATH
  || path.join(__dirname, 'engine', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish');

// Strategy PDF reward (user-provided Kiruma_souchii.pdf at project root)
const STRATEGY_PDF = process.env.STRATEGY_PDF_PATH
  || path.join(__dirname, '..', 'Kiruma_souchii.pdf');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '1mb' }));

let engine = null;
let engineError = null;

async function initEngine() {
  if (!fs.existsSync(ENGINE_PATH)) {
    engineError = `Stockfish binary not found at ${ENGINE_PATH}. Place your stockfish.exe there or set STOCKFISH_PATH.`;
    console.warn('[server] ' + engineError);
    return;
  }
  engine = new StockfishUCI(ENGINE_PATH);
  try {
    await engine.start();
    console.log('[server] Stockfish engine ready at', ENGINE_PATH);
  } catch (err) {
    engineError = err.message;
    console.error('[server] Stockfish failed to start:', err.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    engineReady: !!(engine && engine.ready),
    engineError,
    strategyPdfReady: fs.existsSync(STRATEGY_PDF),
  });
});

// Body: { fen, elo, movetimeMs }
app.post('/api/bestmove', async (req, res) => {
  const { fen, elo, movetimeMs } = req.body || {};
  if (!fen) return res.status(400).json({ error: 'fen is required' });
  if (!engine || !engine.ready) {
    return res.status(503).json({ error: engineError || 'Engine not ready' });
  }
  try {
    const move = await engine.getBestMove(fen, elo || 2400, movetimeMs || 1200);
    res.json({ move });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Body: { playerName, elo, why }
app.post('/api/certificate', (req, res) => {
  const { playerName, elo, why } = req.body || {};
  streamVictoryCertificate(res, { playerName, elo, why });
});

/** Kiruma's secret strategy PDF reward (the user-supplied file). */
app.get('/api/reward/strategy-pdf', (req, res) => {
  if (!fs.existsSync(STRATEGY_PDF)) {
    return res.status(404).json({
      error: 'Strategy PDF not found. Place Kiruma_souchii.pdf in the project root.',
    });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Kiruma_Souichi_Secret_Strategy.pdf"');
  fs.createReadStream(STRATEGY_PDF).pipe(res);
});

// Body: finished game payload — stores wins for the leaderboard + analysis
app.post('/api/games', (req, res) => {
  const body = req.body || {};
  if (!body.result || !['win', 'lose', 'draw'].includes(body.result)) {
    return res.status(400).json({ error: 'result must be win|lose|draw' });
  }
  try {
    const entry = saveGame(body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games', (req, res) => {
  const result = req.query.result;
  const limit = Number(req.query.limit) || 50;
  res.json({ games: listGames({ result, limit }) });
});

app.get('/api/games/:id', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

app.get('/api/leaderboard', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({
    summary: getStatsSummary(),
    leaders: getLeaderboard(limit),
  });
});

// Serve the built frontend if present (npm run build in ../frontend -> dist/)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

initEngine().finally(() => {
  app.listen(PORT, () => console.log(`[server] Kiruma Souichi backend listening on http://localhost:${PORT}`));
});
