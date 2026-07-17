import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(GAMES_FILE)) {
    fs.writeFileSync(GAMES_FILE, JSON.stringify({ games: [] }, null, 2), 'utf8');
  }
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(GAMES_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.games)) return { games: [] };
    return data;
  } catch {
    return { games: [] };
  }
}

function writeAll(data) {
  ensureStore();
  fs.writeFileSync(GAMES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** Persist a finished game. Wins are kept forever for the leaderboard. */
export function saveGame(record) {
  const data = readAll();
  const id = crypto.randomUUID();
  const entry = {
    id,
    playerName: (record.playerName || 'Player').trim().slice(0, 40) || 'Player',
    result: record.result, // 'win' | 'lose' | 'draw'
    why: record.why || '',
    elo: Number(record.elo) || 0,
    playerColor: record.playerColor === 'b' ? 'b' : 'w',
    moveList: Array.isArray(record.moveList) ? record.moveList : [],
    moveCount: Number(record.moveCount) || 0,
    durationMs: Number(record.durationMs) || 0,
    playerTimeLeftMs: Number(record.playerTimeLeftMs) || 0,
    botTimeLeftMs: Number(record.botTimeLeftMs) || 0,
    createdAt: new Date().toISOString(),
  };
  data.games.unshift(entry);
  // Cap total stored games to keep the file sane (keep all wins + recent losses/draws)
  if (data.games.length > 500) {
    const wins = data.games.filter(g => g.result === 'win');
    const rest = data.games.filter(g => g.result !== 'win').slice(0, 400);
    data.games = [...wins, ...rest]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 500);
  }
  writeAll(data);
  return entry;
}

export function getGame(id) {
  const data = readAll();
  return data.games.find(g => g.id === id) || null;
}

export function listGames({ result, limit = 50 } = {}) {
  const data = readAll();
  let games = data.games;
  if (result) games = games.filter(g => g.result === result);
  return games.slice(0, Math.min(Math.max(limit, 1), 200));
}

/** Aggregate winners for the dashboard leaderboard. */
export function getLeaderboard(limit = 50) {
  const wins = listGames({ result: 'win', limit: 500 });
  const byName = new Map();
  for (const g of wins) {
    const key = g.playerName.toLowerCase();
    const cur = byName.get(key) || {
      playerName: g.playerName,
      wins: 0,
      bestElo: 0,
      lastWinAt: null,
      games: [],
    };
    cur.wins += 1;
    cur.bestElo = Math.max(cur.bestElo, g.elo || 0);
    if (!cur.lastWinAt || g.createdAt > cur.lastWinAt) cur.lastWinAt = g.createdAt;
    cur.games.push({
      id: g.id,
      elo: g.elo,
      why: g.why,
      moveCount: g.moveCount,
      durationMs: g.durationMs,
      createdAt: g.createdAt,
      playerColor: g.playerColor,
    });
    byName.set(key, cur);
  }
  return [...byName.values()]
    .map(p => ({
      ...p,
      games: p.games
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20),
    }))
    .sort((a, b) => b.wins - a.wins || b.bestElo - a.bestElo || (b.lastWinAt || '').localeCompare(a.lastWinAt || ''))
    .slice(0, Math.min(Math.max(limit, 1), 100));
}

export function getStatsSummary() {
  const data = readAll();
  const games = data.games;
  return {
    totalGames: games.length,
    wins: games.filter(g => g.result === 'win').length,
    losses: games.filter(g => g.result === 'lose').length,
    draws: games.filter(g => g.result === 'draw').length,
    uniqueWinners: new Set(games.filter(g => g.result === 'win').map(g => g.playerName.toLowerCase())).size,
  };
}
