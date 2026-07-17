// In production the backend serves the built frontend, so API calls are same-origin.
// In dev, Vite runs on its own port, so default to the local backend.
const BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:4000' : '');

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

/** Ask the real Stockfish backend for a move. Returns a UCI move string like "e2e4", or null. */
export async function requestBestMove(fen, elo, movetimeMs) {
  const res = await fetch(`${BASE}/api/bestmove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, elo, movetimeMs }),
    signal: AbortSignal.timeout(movetimeMs + 6000),
  });
  if (!res.ok) throw new Error('bestmove request failed');
  const data = await res.json();
  return data.move;
}

/** Download the victory certificate PDF generated server-side. Falls back to
 *  a simple client-side text file if the backend is unreachable. */
export async function downloadCertificate({ playerName, elo, why }) {
  try {
    const res = await fetch(`${BASE}/api/certificate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, elo, why }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('certificate request failed');
    const blob = await res.blob();
    triggerDownload(URL.createObjectURL(blob), 'kiruma-souichi-victory-certificate.pdf', true);
  } catch {
    const text = `KIRUMA SOUICHI CHESS — Victory Certificate\n\n` +
      `This certifies that ${playerName || 'Player'} defeated the demon, Kiruma Souichi,\n` +
      `at the ${elo}+ ELO difficulty by ${why}.\n\n"You defeated the demon. Congratulations!"\n\n` +
      `(Backend unreachable — this is a plain-text fallback certificate.)`;
    const blob = new Blob([text], { type: 'text/plain' });
    triggerDownload(URL.createObjectURL(blob), 'kiruma-souichi-victory-certificate.txt', false);
  }
}

/** Download Kiruma's secret strategy PDF (Kiruma_souchii.pdf) as a win reward. */
export async function downloadStrategyPdf() {
  try {
    const res = await fetch(`${BASE}/api/reward/strategy-pdf`, {
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error('strategy pdf request failed');
    const blob = await res.blob();
    triggerDownload(URL.createObjectURL(blob), 'Kiruma_Souichi_Secret_Strategy.pdf', true);
    return true;
  } catch {
    return false;
  }
}

/** Persist a finished game for the winners dashboard / analysis. */
export async function recordGame(payload) {
  try {
    const res = await fetch(`${BASE}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error('record game failed');
    return await res.json();
  } catch {
    // Offline fallback: keep a local mirror so the dashboard still works without backend
    try {
      const key = 'kiruma_local_games';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const entry = {
        id: 'local-' + Date.now(),
        ...payload,
        createdAt: new Date().toISOString(),
        localOnly: true,
      };
      existing.unshift(entry);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 200)));
      return entry;
    } catch {
      return null;
    }
  }
}

export async function fetchLeaderboard(limit = 50) {
  try {
    const res = await fetch(`${BASE}/api/leaderboard?limit=${limit}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error('leaderboard failed');
    return await res.json();
  } catch {
    // Build from localStorage if backend is down
    try {
      const games = JSON.parse(localStorage.getItem('kiruma_local_games') || '[]');
      const wins = games.filter(g => g.result === 'win');
      const byName = new Map();
      for (const g of wins) {
        const key = (g.playerName || 'Player').toLowerCase();
        const cur = byName.get(key) || {
          playerName: g.playerName || 'Player',
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
          moveList: g.moveList,
        });
        byName.set(key, cur);
      }
      const leaders = [...byName.values()]
        .sort((a, b) => b.wins - a.wins || b.bestElo - a.bestElo)
        .slice(0, limit);
      return {
        summary: {
          totalGames: games.length,
          wins: wins.length,
          losses: games.filter(g => g.result === 'lose').length,
          draws: games.filter(g => g.result === 'draw').length,
          uniqueWinners: leaders.length,
          offline: true,
        },
        leaders,
      };
    } catch {
      return { summary: { totalGames: 0, wins: 0, losses: 0, draws: 0, uniqueWinners: 0 }, leaders: [] };
    }
  }
}

export async function fetchGame(id) {
  if (String(id).startsWith('local-')) {
    try {
      const games = JSON.parse(localStorage.getItem('kiruma_local_games') || '[]');
      return games.find(g => g.id === id) || null;
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(`${BASE}/api/games/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error('game not found');
    return await res.json();
  } catch {
    // Also check local cache for hybrid records
    try {
      const games = JSON.parse(localStorage.getItem('kiruma_local_games') || '[]');
      return games.find(g => g.id === id) || null;
    } catch {
      return null;
    }
  }
}

function triggerDownload(url, filename, revoke) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(url);
}
