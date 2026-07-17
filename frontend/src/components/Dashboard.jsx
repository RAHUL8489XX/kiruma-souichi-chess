import React, { useEffect, useState } from 'react';
import { fetchLeaderboard, fetchGame } from '../api.js';

const KIRUMA_PHOTO = 'https://kimi-web-img.moonshot.cn/img/static.wikia.nocookie.net/9634788fe121dfd34d456e8d17a4d4f427d9f9c2';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Dashboard({ onBack, onAnalyze }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const data = await fetchLeaderboard(50);
      if (cancelled) return;
      setSummary(data.summary || {});
      setLeaders(data.leaders || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const openAnalysis = async (gameMeta) => {
    // Prefer full game record (has moveList); leaderboard games may already embed moveList offline
    let full = gameMeta;
    if (!gameMeta.moveList || !gameMeta.moveList.length) {
      const fetched = await fetchGame(gameMeta.id);
      if (fetched) full = fetched;
    }
    onAnalyze(full);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <header className="dash-header">
          <div className="dash-title-block">
            <img src={KIRUMA_PHOTO} alt="" className="dash-avatar" />
            <div>
              <h1>Winners Dashboard</h1>
              <p>Those who survived Kiruma Souichi — and the games they left behind.</p>
            </div>
          </div>
          <button type="button" className="secondary dash-back" onClick={onBack}>← Back to Arena</button>
        </header>

        <div className="dash-summary">
          <div className="dash-stat"><span className="num">{summary?.uniqueWinners ?? '—'}</span><span className="lbl">Winners</span></div>
          <div className="dash-stat"><span className="num">{summary?.wins ?? '—'}</span><span className="lbl">Total Wins</span></div>
          <div className="dash-stat"><span className="num">{summary?.totalGames ?? '—'}</span><span className="lbl">Games Logged</span></div>
          <div className="dash-stat"><span className="num">{summary?.losses ?? '—'}</span><span className="lbl">Defeats</span></div>
        </div>

        {summary?.offline && (
          <p className="dash-offline">Showing offline/local records — start the backend for the full shared leaderboard.</p>
        )}

        {loading && <p className="dash-loading">Loading leaderboard…</p>}
        {error && <p className="dash-error">{error}</p>}

        {!loading && leaders.length === 0 && (
          <div className="dash-empty">
            <p>No victors yet.</p>
            <p className="dim">Defeat Kiruma to carve your name into the board.</p>
          </div>
        )}

        <div className="leader-list">
          {leaders.map((p, idx) => (
            <div className="leader-card" key={p.playerName + idx}>
              <button
                type="button"
                className="leader-main"
                onClick={() => setExpanded(expanded === p.playerName ? null : p.playerName)}
              >
                <span className="rank">#{idx + 1}</span>
                <span className="lname">{p.playerName}</span>
                <span className="lwins">{p.wins} win{p.wins === 1 ? '' : 's'}</span>
                <span className="lelo">Best {p.bestElo}+</span>
                <span className="llast">{formatDate(p.lastWinAt)}</span>
              </button>
              {expanded === p.playerName && (
                <div className="leader-games">
                  <div className="panel-title">Games to analyze</div>
                  {(p.games || []).length === 0 && <p className="dim">No game details stored.</p>}
                  {(p.games || []).map(g => (
                    <div className="leader-game-row" key={g.id}>
                      <div className="lg-meta">
                        <span>{g.elo}+ ELO</span>
                        <span>{g.why || '—'}</span>
                        <span>{g.moveCount || 0} plies</span>
                        <span>{formatDuration(g.durationMs)}</span>
                        <span>{formatDate(g.createdAt)}</span>
                      </div>
                      <button type="button" className="analyze-btn" onClick={() => openAnalysis(g)}>
                        Analyze
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
