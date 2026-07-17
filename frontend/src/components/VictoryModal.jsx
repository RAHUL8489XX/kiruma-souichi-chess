import React, { useEffect, useState } from 'react';
import { downloadCertificate, downloadStrategyPdf } from '../api.js';

const KIRUMA_PHOTO = 'https://kimi-web-img.moonshot.cn/img/static.wikia.nocookie.net/9634788fe121dfd34d456e8d17a4d4f427d9f9c2';

function Confetti() {
  const colors = ['#f59e0b', '#dc2626', '#22c55e', '#3b82f6', '#e2e8f0', '#d4af37'];
  const pieces = Array.from({ length: 80 }, (_, i) => {
    const size = 6 + Math.random() * 6;
    return {
      id: i,
      left: Math.random() * 100 + 'vw',
      width: size, height: size * 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      dur: 2.5 + Math.random() * 2, delay: Math.random() * 0.6,
    };
  });
  return (
    <div className="confetti-layer">
      {pieces.map(p => (
        <div key={p.id} className="cfp" style={{
          left: p.left, width: p.width, height: p.height, background: p.color,
          animationDuration: p.dur + 's', animationDelay: p.delay + 's',
        }} />
      ))}
    </div>
  );
}

export default function VictoryModal({ modal, elo, playerName, stats, onClose, onRematch, onOpenDashboard }) {
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [downloadingStrategy, setDownloadingStrategy] = useState(false);
  const [strategyError, setStrategyError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (modal?.kind === 'win') {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 5500);
      return () => clearTimeout(t);
    }
    setStrategyError('');
  }, [modal]);

  if (!modal) return null;
  const isWin = modal.kind === 'win';
  const isDraw = modal.kind === 'draw';
  const isLose = !isWin && !isDraw;

  const handleCert = async () => {
    setDownloadingCert(true);
    await downloadCertificate({ playerName, elo, why: modal.why });
    setDownloadingCert(false);
  };

  const handleStrategy = async () => {
    setDownloadingStrategy(true);
    setStrategyError('');
    const ok = await downloadStrategyPdf();
    setDownloadingStrategy(false);
    if (!ok) {
      setStrategyError('Could not reach the strategy PDF. Is the backend running with Kiruma_souchii.pdf in the project root?');
    }
  };

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="modal-overlay">
        <div className={'modal-box' + (isWin ? ' win' : '') + (isLose ? ' lose' : '')}>
          {isLose && (
            <div className="defeat-portrait">
              <img src={KIRUMA_PHOTO} alt="Kiruma Souichi" />
              <span className="defeat-ring" aria-hidden="true" />
            </div>
          )}

          {!isLose && <div className="em">{isWin ? '🏆' : '🤝'}</div>}

          <h2>{isWin ? 'Victory!' : isDraw ? 'Draw' : 'Defeat'}</h2>

          {isLose && modal.dialogue && (
            <blockquote className="kiruma-cold">
              <span className="kiruma-cold-label">Kiruma Souichi</span>
              “{modal.dialogue}”
            </blockquote>
          )}

          <p className="mdesc">
            {isWin && `You defeated the demon. Congratulations! (${modal.why})`}
            {isDraw && `Game ended: ${modal.why}`}
            {isLose && `Kiruma Souichi wins by ${modal.why}.`}
          </p>

          {isWin && modal.dialogue && (
            <p className="win-aside">“{modal.dialogue}”</p>
          )}

          {isWin && (
            <div className="reward-box">
              <div className="pdf-icon">📜</div>
              <p>Claim your rewards</p>
              <div className="reward-btns">
                <button className="reward-btn" onClick={handleCert} disabled={downloadingCert}>
                  {downloadingCert ? 'Preparing…' : '📥 Victory Certificate'}
                </button>
                <button className="reward-btn strategy" onClick={handleStrategy} disabled={downloadingStrategy}>
                  {downloadingStrategy ? 'Downloading…' : '📕 Secret Strategy PDF'}
                </button>
              </div>
              {strategyError && <p className="reward-error">{strategyError}</p>}
              <p className="reward-hint">Certificate + Kiruma&apos;s secret notes (Kiruma_souchii.pdf)</p>
            </div>
          )}

          <div className="stat-row">
            <span>Wins: {stats.w}</span><span>Losses: {stats.l}</span><span>Draws: {stats.d}</span>
          </div>

          <div className="modal-btns">
            <button className="secondary" onClick={onClose}>Back to Menu</button>
            {onOpenDashboard && (
              <button className="secondary" onClick={onOpenDashboard}>Dashboard</button>
            )}
            <button className="primary" onClick={onRematch}>Rematch</button>
          </div>
        </div>
      </div>
    </>
  );
}
