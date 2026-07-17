import React, { useState } from 'react';
import Landing from './components/Landing.jsx';
import GameScreen from './components/GameScreen.jsx';
import VictoryModal from './components/VictoryModal.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analysis from './components/Analysis.jsx';
import { useGame } from './useGame.js';

export default function App() {
  const [screen, setScreen] = useState('landing'); // landing | game | dashboard | analysis
  const [analysisGame, setAnalysisGame] = useState(null);
  const game = useGame();

  const handleEnter = (side, elo, name) => {
    game.startGame(side, elo, name);
    setScreen('game');
  };

  const handleRematch = () => {
    game.setModal(null);
    game.startGame(game.pc, game.elo, game.playerName);
    setScreen('game');
  };

  const handleBackToMenu = () => {
    game.setModal(null);
    setScreen('landing');
  };

  const openDashboard = () => {
    game.setModal(null);
    setScreen('dashboard');
  };

  const openAnalysis = (g) => {
    setAnalysisGame(g);
    setScreen('analysis');
  };

  return (
    <div className="app-root">
      {screen === 'landing' && <Landing onEnter={handleEnter} onOpenDashboard={openDashboard} />}
      {screen === 'game' && <GameScreen game={game} onOpenDashboard={openDashboard} />}
      {screen === 'dashboard' && (
        <Dashboard onBack={() => setScreen('landing')} onAnalyze={openAnalysis} />
      )}
      {screen === 'analysis' && (
        <Analysis
          game={analysisGame}
          onBack={() => setScreen('landing')}
          onDashboard={() => setScreen('dashboard')}
        />
      )}
      <VictoryModal
        modal={game.modal}
        elo={game.elo}
        playerName={game.playerName}
        stats={game.stats}
        onClose={handleBackToMenu}
        onRematch={handleRematch}
        onOpenDashboard={openDashboard}
      />
    </div>
  );
}
