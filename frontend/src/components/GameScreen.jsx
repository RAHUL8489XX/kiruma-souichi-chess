import React from 'react';
import Board from './Board.jsx';
import { PCS, PVAL } from '../engine/ChessEngine.js';

const KIRUMA_PHOTO = 'https://kimi-web-img.moonshot.cn/img/static.wikia.nocookie.net/9634788fe121dfd34d456e8d17a4d4f427d9f9c2';

function materialDiff(captured) {
  const whiteGain = captured.w.reduce((s, p) => s + (PVAL[p.toLowerCase()] || 0) / 100, 0);
  const blackGain = captured.b.reduce((s, p) => s + (PVAL[p.toLowerCase()] || 0) / 100, 0);
  return whiteGain - blackGain;
}

function clockClass(ms, ticking) {
  let cls = 'clock';
  if (ticking) cls += ' ticking';
  if (ms <= 30_000) cls += ' danger';
  else if (ms <= 60_000) cls += ' warn';
  return cls;
}

export default function GameScreen({ game, onOpenDashboard }) {
  const { eng, active, thinking, pc, elo, moveList, captured, chat, stats, flipped,
    sel, legalTargets, lastMove, selectSquare, resign, flip,
    playerMs, botMs, formatClock } = game;

  const diff = materialDiff(captured);
  const evalScore = eng.eval() / 100;
  const playerToMove = active && eng.t === pc;
  const botToMove = active && eng.t !== pc;

  return (
    <div className="game-screen">
      <div className="game-top-nav">
        <button type="button" className="nav-link" onClick={onOpenDashboard}>📊 Winners Dashboard</button>
        <span className="time-control-badge">⏱ 10+0 · Sudden death</span>
      </div>
      <div className="game-grid">
        <div className="board-col">
          <div className="player-bar top">
            <div className="info">
              <div className="avwrap">
                <img src={KIRUMA_PHOTO} alt="Kiruma" />
                <span className="onl-dot" />
              </div>
              <div>
                <div className="n">Kiruma Souichi <span className="side-tag">({pc === 'w' ? 'Black' : 'White'})</span></div>
                <div className="c">{elo}+ ELO • GM</div>
              </div>
            </div>
            <div className="bar-right">
              <div className={clockClass(botMs, botToMove)}>{formatClock(botMs)}</div>
              <div className="status-pill">
                <span className={'sdot' + (thinking ? ' th' : '')} />
                {thinking ? 'Kiruma is calculating…' : (active ? (eng.t === pc ? 'Your move' : "Kiruma's turn") : 'Game over')}
              </div>
            </div>
          </div>

          <div className="board-with-eval">
            <div className="eval-bar">
              <div className="eval-fill" style={{ height: `${50 + Math.min(Math.max(evalScore * 3, -45), 45)}%` }} />
            </div>
            <Board eng={eng} pc={pc} flipped={flipped} sel={sel} legalTargets={legalTargets}
              lastMove={lastMove} onSquareClick={selectSquare} />
          </div>

          <div className="player-bar bottom">
            <div className="info">
              <div className="n">{game.playerName} <span className="side-tag">({pc === 'w' ? 'White' : 'Black'})</span></div>
              <div className="c">{stats.w}W · {stats.l}L · {stats.d}D</div>
            </div>
            <div className="bar-right">
              <div className={clockClass(playerMs, playerToMove)}>{formatClock(playerMs)}</div>
              <div className="eval-tag" style={{ color: evalScore > 0.5 ? '#22c55e' : evalScore < -0.5 ? '#ef4444' : '#94a3b8' }}>
                {(evalScore > 0 ? '+' : '') + evalScore.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="ctrls">
            <button onClick={flip}>🔄 Flip</button>
            <button className="dg" onClick={resign} disabled={!active}>🏳 Resign</button>
            <button onClick={() => window.location.reload()}>➕ New</button>
          </div>
        </div>

        <div className="side-col">
          <div className="bot-h">
            <div className="avwrap"><img src={KIRUMA_PHOTO} alt="Kiruma" /><span className="onl-dot" /></div>
            <div>
              <div className="n">Kiruma Souichi</div>
              <div className="r">{elo}+ ELO</div>
              <div className="onl-txt"><span className="onl-dot2" />Online · 10 min</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Captured</div>
            <div className="cap-row">
              <div className="cap-pieces">{captured.w.map((p, i) => <span key={i}>{PCS[p === p.toUpperCase() ? 'w' : 'b'][p.toLowerCase()]}</span>)}</div>
              <div className="cap-pieces">{captured.b.map((p, i) => <span key={i}>{PCS[p === p.toUpperCase() ? 'w' : 'b'][p.toLowerCase()]}</span>)}</div>
            </div>
            <div className="mat-score" style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : '#94a3b8' }}>
              {diff > 0 ? `+${diff}` : diff < 0 ? diff : '+0'} material
            </div>
          </div>

          <div className="panel moves">
            <div className="panel-title">Moves</div>
            <div className="move-list">
              {moveList.map((row, i) => (
                <div className="move-row" key={i}>
                  <span className="mn">{row.num}.</span>
                  <span className="mw">{row.w}</span>
                  <span className="mb">{row.b || ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel chat-panel">
            <div className="panel-title">Kiruma says</div>
            <div className="chat-box">
              {chat.map((m, i) => <div className="msg bot" key={i}><b>{m.who}</b> {m.text}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
