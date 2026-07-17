import React, { useEffect, useMemo, useState } from 'react';
import Board from './Board.jsx';
import { Engine } from '../engine/ChessEngine.js';

const FILES = 'abcdefgh';
const RANKS = '87654321';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function formatClock(ms) {
  if (ms == null) return '—';
  const t = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse stored SAN-ish coords: "e2-e4" or "e2e4". */
function parseCoordMove(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().toLowerCase().match(/^([a-h])([1-8])-?([a-h])([1-8])$/);
  if (!m) return null;
  return {
    fc: FILES.indexOf(m[1]),
    fr: RANKS.indexOf(m[2]),
    tc: FILES.indexOf(m[3]),
    tr: RANKS.indexOf(m[4]),
  };
}

function resolveLegal(eng, coords) {
  if (!coords) return null;
  return eng.legal().find(
    mv => mv.fr === coords.fr && mv.fc === coords.fc && mv.tr === coords.tr && mv.tc === coords.tc
  ) || null;
}

/** Flatten moveList rows into ordered half-move strings, then replay into positions. */
function buildReplay(moveList) {
  const halfMoves = [];
  for (const row of moveList || []) {
    if (row?.w) halfMoves.push({ label: row.w, num: row.num, color: 'w' });
    if (row?.b) halfMoves.push({ label: row.b, num: row.num, color: 'b' });
  }

  const frames = [{ eng: new Engine(), lastMove: null, label: 'Start', ply: 0 }];
  let eng = new Engine();

  for (let i = 0; i < halfMoves.length; i++) {
    const hm = halfMoves[i];
    const coords = parseCoordMove(hm.label);
    const legal = resolveLegal(eng, coords);
    if (!legal) {
      // Stop replay if a move can't be reconstructed (corrupt/partial history)
      break;
    }
    eng = eng.clone();
    eng.move(legal);
    frames.push({
      eng,
      lastMove: legal,
      label: hm.label,
      ply: i + 1,
      num: hm.num,
      color: hm.color,
    });
  }

  return { frames, halfMoves, complete: frames.length === halfMoves.length + 1 };
}

export default function Analysis({ game, onBack, onDashboard }) {
  const moves = game?.moveList || [];
  const replay = useMemo(() => buildReplay(moves), [moves]);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setPly(0);
    setFlipped(game?.playerColor === 'b');
  }, [game?.id, game?.playerColor]);

  if (!game) {
    return (
      <div className="analysis">
        <div className="analysis-inner">
          <p>Game not found.</p>
          <button type="button" className="secondary" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  const resultLabel =
    game.result === 'win' ? 'Victory vs Kiruma' :
    game.result === 'lose' ? 'Defeat' :
    game.result === 'draw' ? 'Draw' : (game.result || '—');

  const maxPly = Math.max(0, replay.frames.length - 1);
  const frame = replay.frames[Math.min(ply, maxPly)] || replay.frames[0];
  const halfMoves = replay.halfMoves;

  const go = (next) => setPly(p => Math.max(0, Math.min(maxPly, next)));

  return (
    <div className="analysis">
      <div className="analysis-inner">
        <header className="analysis-header">
          <div>
            <h1>Game Analysis</h1>
            <p className="analysis-sub">{game.playerName} · {resultLabel}</p>
          </div>
          <div className="analysis-nav">
            <button type="button" className="secondary" onClick={onDashboard}>Dashboard</button>
            <button type="button" className="secondary" onClick={onBack}>← Arena</button>
          </div>
        </header>

        <div className="analysis-grid analysis-grid-replay">
          <div className="analysis-board-col">
            <div className="analysis-board-wrap">
              <Board
                eng={frame.eng}
                pc={game.playerColor === 'b' ? 'b' : 'w'}
                flipped={flipped}
                sel={null}
                legalTargets={[]}
                lastMove={frame.lastMove}
                onSquareClick={() => {}}
              />
            </div>

            <div className="replay-controls">
              <button type="button" className="secondary" onClick={() => go(0)} disabled={ply <= 0} title="Start">⏮</button>
              <button type="button" className="secondary" onClick={() => go(ply - 1)} disabled={ply <= 0} title="Previous">◀</button>
              <div className="replay-status">
                <span className="replay-ply">Ply {ply}/{maxPly}</span>
                <span className="replay-label">{frame.label || 'Start'}</span>
              </div>
              <button type="button" className="secondary" onClick={() => go(ply + 1)} disabled={ply >= maxPly} title="Next">▶</button>
              <button type="button" className="secondary" onClick={() => go(maxPly)} disabled={ply >= maxPly} title="End">⏭</button>
              <button type="button" className="secondary" onClick={() => setFlipped(f => !f)} title="Flip board">🔄</button>
            </div>

            <input
              className="replay-slider"
              type="range"
              min={0}
              max={maxPly}
              value={Math.min(ply, maxPly)}
              onChange={e => go(Number(e.target.value))}
              disabled={maxPly === 0}
            />

            {!replay.complete && halfMoves.length > 0 && (
              <p className="analysis-note warn">
                Replay stopped early — some stored moves could not be reconstructed.
              </p>
            )}
            {halfMoves.length === 0 && (
              <p className="analysis-note">No move list was stored for this game.</p>
            )}
          </div>

          <div className="analysis-side">
            <div className="panel analysis-meta">
              <div className="panel-title">Overview</div>
              <dl className="meta-dl">
                <div><dt>Player</dt><dd>{game.playerName}</dd></div>
                <div><dt>Result</dt><dd className={'res-' + (game.result || '')}>{resultLabel}</dd></div>
                <div><dt>How</dt><dd>{game.why || '—'}</dd></div>
                <div><dt>Difficulty</dt><dd>{game.elo}+ ELO</dd></div>
                <div><dt>Side</dt><dd>{game.playerColor === 'b' ? 'Black' : 'White'}</dd></div>
                <div><dt>Plies</dt><dd>{game.moveCount || halfMoves.length}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(game.durationMs)}</dd></div>
                <div><dt>Player clock left</dt><dd>{formatClock(game.playerTimeLeftMs)}</dd></div>
                <div><dt>Kiruma clock left</dt><dd>{formatClock(game.botTimeLeftMs)}</dd></div>
                <div><dt>Played</dt><dd>{game.createdAt ? new Date(game.createdAt).toLocaleString() : '—'}</dd></div>
              </dl>
            </div>

            <div className="panel analysis-moves">
              <div className="panel-title">Move history</div>
              {moves.length === 0 && (
                <p className="dim">No move list was stored for this game.</p>
              )}
              <div className="move-list analysis-move-list">
                {moves.map((row, i) => {
                  const wPly = (() => {
                    let n = 0;
                    for (let j = 0; j < i; j++) {
                      if (moves[j]?.w) n += 1;
                      if (moves[j]?.b) n += 1;
                    }
                    return row.w ? n + 1 : null;
                  })();
                  const bPly = (() => {
                    let n = 0;
                    for (let j = 0; j < i; j++) {
                      if (moves[j]?.w) n += 1;
                      if (moves[j]?.b) n += 1;
                    }
                    if (row.w) n += 1;
                    return row.b ? n + 1 : null;
                  })();
                  return (
                    <div className="move-row" key={i}>
                      <span className="mn">{row.num || i + 1}.</span>
                      <button
                        type="button"
                        className={'mw clickable' + (wPly != null && ply === wPly ? ' active-ply' : '')}
                        disabled={!row.w}
                        onClick={() => wPly != null && go(wPly)}
                      >
                        {row.w || '—'}
                      </button>
                      <button
                        type="button"
                        className={'mb clickable' + (bPly != null && ply === bPly ? ' active-ply' : '')}
                        disabled={!row.b}
                        onClick={() => bPly != null && go(bPly)}
                      >
                        {row.b || ''}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="analysis-note">
                Step through the board or click any move to jump. Reconstructs the fight from the stored coordinates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
