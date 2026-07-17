import React, { useState } from 'react';

// Same portrait used on the game screen — Kiruma Souichi
const KIRUMA_PHOTO = 'https://kimi-web-img.moonshot.cn/img/static.wikia.nocookie.net/9634788fe121dfd34d456e8d17a4d4f427d9f9c2';

const TIERS = [
  { max: 2000, label: 'NOVICE', color: '#4ade80' },
  { max: 2300, label: 'EXPERT', color: '#a3e635' },
  { max: 2600, label: 'MASTER', color: '#facc15' },
  { max: 2900, label: 'GRANDMASTER', color: '#f97316' },
  { max: Infinity, label: 'DEMON', color: '#ef4444' },
];

function tierFor(elo) {
  return TIERS.find(t => elo <= t.max) || TIERS[TIERS.length - 1];
}

export default function Landing({ onEnter, onOpenDashboard }) {
  const [elo, setElo] = useState(2400);
  const [side, setSide] = useState('w');
  const [name, setName] = useState('');
  const tier = tierFor(elo);

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-top-actions">
          <button type="button" className="nav-link" onClick={onOpenDashboard}>
            📊 Winners Dashboard
          </button>
        </div>

        <div className="landing-portrait">
          <img src={KIRUMA_PHOTO} alt="Kiruma Souichi" />
          <span className="portrait-ring" aria-hidden="true" />
        </div>
        <h1 className="brand">KIRUMA <span>SOUICHI</span></h1>
        <div className="brand-jp">— 桐間 宗一 ・ CHESS —</div>
        <p className="tagline">Face the shadow prodigy. Every move carved from cold calculation.</p>
        <p className="tagline-sub">Only the worthy shall survive his gambit. 10 minutes. No mercy.</p>

        <div className="arena-card">
          <div className="name-row">
            <label htmlFor="pname">YOUR NAME</label>
            <input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" maxLength={24} />
          </div>

          <div className="diff-row">
            <span>SELECT DIFFICULTY</span>
            <span className="diff-val" style={{ color: tier.color }}>{elo}</span>
          </div>
          <input
            type="range" min={1900} max={3000} step={10} value={elo}
            onChange={e => setElo(Number(e.target.value))}
            className="slider"
            style={{ '--pct': `${((elo - 1900) / (3000 - 1900)) * 100}%` }}
          />
          <div className="diff-marks">
            <span>1900</span><span>2200</span><span>2500</span><span>2800</span><span>3000</span>
          </div>
          <div className="diff-tier" style={{ color: tier.color }}>[ {tier.label} ]</div>

          <div className="time-row">
            <span className="section-label">TIME CONTROL</span>
            <div className="time-pill">⏱ 10 minutes each · Sudden death</div>
          </div>

          <div className="side-row">
            <span className="section-label">CHOOSE YOUR SIDE</span>
            <div className="side-btns">
              <button className={side === 'w' ? 'on' : ''} onClick={() => setSide('w')}>♔ WHITE</button>
              <button className={side === 'b' ? 'on' : ''} onClick={() => setSide('b')}>♚ BLACK</button>
            </div>
          </div>

          <button className="enter-btn" onClick={() => onEnter(side, elo, name.trim() || 'Player')}>
            ⚔ ENTER THE ARENA ›
          </button>
        </div>
      </div>
    </div>
  );
}
