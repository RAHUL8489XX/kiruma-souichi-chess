import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, bestMove, parseUCIMove } from './engine/ChessEngine.js';
import { requestBestMove, recordGame } from './api.js';

// Kiruma Souichi personality — cold, clinical, aristocratic prodigy energy
const CHAT = {
  open: [
    "Predictable. I expected more from your first move.",
    "Every opening has a weakness. I'll find yours before you finish developing.",
    "Let's see what you're made of. Don't waste my time.",
    "So you chose to sit across from me. How… optimistic.",
    "I already calculated three ways this ends. Try to surprise me.",
  ],
  mid: [
    "Interesting… but flawed. Recalculating.",
    "You're stalling the inevitable. I can taste the collapse.",
    "A clever try. Not clever enough.",
    "Your pieces look busy. Mine look inevitable.",
    "You leave holes. I only need one.",
    "That was almost good. Almost.",
    "I don't bluff. You just misread the board.",
  ],
  end: [
    "The end draws near. Can you feel it?",
    "I can already see the mate. You just haven't accepted it.",
    "Resign now and spare yourself the humiliation.",
    "Your king is drowning. Stop thrashing.",
    "This position was decided ten moves ago. You're only catching up.",
    "Quiet now. Watch how cleanly it ends.",
  ],
  capture: [
    "Mine now.",
    "You won't need that piece.",
    "Careless.",
    "I take what I want.",
  ],
  check: [
    "Check. Breathe carefully.",
    "Your king is exposed. How quaint.",
    "Did you feel that? That was the noose.",
  ],
  win: [
    "Impossible… recalculating.",
    "This changes nothing. Next time, I won't hold back.",
    "You… you actually did it. Remember this feeling. It won't last.",
    "…Fine. Claim your paper. You've earned one moment of arrogance.",
    "So the board finally lies to me. How rare.",
  ],
  lose: [
    "As expected. You were never my equal.",
    "I told you the end was near. You just refused to listen.",
    "Cold. Clean. Inevitable. That is how I win.",
    "You played like someone who wanted hope more than truth.",
    "Don't look so surprised. I calculated this while you still believed.",
    "Your pieces died for nothing. How theatrical of you.",
    "Stay down. The board has already forgotten your name.",
  ],
  timeout: [
    "Time ran out. Even your clock knew you were finished.",
    "You ran out of minutes. I never run out of moves.",
    "The sand is gone. So is your chance.",
  ],
  draw: [
    "A draw? How… unsatisfying. Next time, finish what you start.",
    "Neither of us fell. How dull.",
  ],
};

const F = 'abcdefgh', RK = '87654321';
const INITIAL_MS = 10 * 60 * 1000; // 10 minutes per side

function eloBudget(elo) {
  if (elo >= 3000) return { time: 2200, depth: 8, elo: 2850 };
  if (elo >= 2500) return { time: 1500, depth: 7, elo: 2500 };
  if (elo >= 2200) return { time: 1000, depth: 6, elo: 2200 };
  return { time: 600, depth: 5, elo: 1500 };
}

function formatClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useGame() {
  const engRef = useRef(new Engine());
  const activeRef = useRef(false);
  const pcRef = useRef('w');
  const clockRef = useRef({ playerMs: INITIAL_MS, botMs: INITIAL_MS, lastTick: null });
  const startAtRef = useRef(0);
  const finishOnceRef = useRef(false);
  const [, force] = useState(0);
  const rerender = () => force(v => v + 1);

  const [pc, setPc] = useState('w');       // player's color
  const [elo, setElo] = useState(2400);
  const [playerName, setPlayerName] = useState('Player');
  const [active, setActive] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [sel, setSel] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [moveList, setMoveList] = useState([]); // [{num, w, b}]
  const [captured, setCaptured] = useState({ w: [], b: [] });
  const [chat, setChat] = useState([]);
  const [stats, setStats] = useState({ w: 0, l: 0, d: 0, t: 0 });
  const [modal, setModal] = useState(null); // {kind:'win'|'lose'|'draw', why, dialogue}
  const [flipped, setFlipped] = useState(false);
  const [playerMs, setPlayerMs] = useState(INITIAL_MS);
  const [botMs, setBotMs] = useState(INITIAL_MS);
  const [savedGameId, setSavedGameId] = useState(null);

  const pushChat = (text) => setChat(c => [...c.slice(-9), { who: 'Kiruma', text }]);
  const kchat = (phase) => {
    const m = CHAT[phase];
    if (!m || !m.length) return;
    pushChat(m[Math.floor(Math.random() * m.length)]);
  };
  const pickLine = (phase) => {
    const m = CHAT[phase];
    if (!m || !m.length) return '';
    return m[Math.floor(Math.random() * m.length)];
  };

  const san = (m) => F[m.fc] + RK[m.fr] + '-' + F[m.tc] + RK[m.tr];

  const recordMove = (m, whiteJustMoved) => {
    const s = san(m);
    setMoveList(list => {
      if (whiteJustMoved) return [...list, { num: Math.ceil(engRef.current.mh.length / 2), w: s, b: null }];
      const copy = [...list];
      if (copy.length) copy[copy.length - 1] = { ...copy[copy.length - 1], b: s };
      return copy;
    });
  };

  /** Applies a move to the live engine, updates move list + captured pieces. Returns the move-result. */
  const applyMove = (mv) => {
    const eng = engRef.current;
    const mover = eng.t; // color making this move, captured before move() flips turn
    const r = eng.move(mv);
    if (r.cap && r.cap !== '.') {
      setCaptured(c => ({ ...c, [mover]: [...c[mover], r.cap] }));
    }
    setLastMove(mv);
    recordMove(mv, mover === 'w');
    return r;
  };

  const startGame = useCallback((side, eloVal, name) => {
    engRef.current = new Engine();
    setPc(side); setElo(eloVal); setPlayerName(name || 'Player');
    pcRef.current = side;
    setActive(true); setThinking(false); setSel(null); setLegalTargets([]);
    setLastMove(null); setMoveList([]); setCaptured({ w: [], b: [] });
    setChat([]); setModal(null); setFlipped(side === 'b');
    setPlayerMs(INITIAL_MS); setBotMs(INITIAL_MS); setSavedGameId(null);
    clockRef.current = { playerMs: INITIAL_MS, botMs: INITIAL_MS, lastTick: Date.now() };
    startAtRef.current = Date.now();
    finishOnceRef.current = false;
    activeRef.current = true;
    rerender();
    // Opening jab
    setTimeout(() => kchat('open'), 350);
    if (side === 'b') setTimeout(() => botMove(), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishGame = useCallback((result) => {
    if (finishOnceRef.current) return;
    finishOnceRef.current = true;
    activeRef.current = false;
    setActive(false); setThinking(false);
    clockRef.current.lastTick = null;

    const playerColor = pcRef.current;
    let kind;
    let dialoguePhase;
    if (result.res === 'draw') {
      kind = 'draw';
      dialoguePhase = 'draw';
      setStats(s => ({ ...s, d: s.d + 1, t: s.t + 1 }));
    } else if ((result.res === 'white' && playerColor === 'w') || (result.res === 'black' && playerColor === 'b')) {
      kind = 'win';
      dialoguePhase = 'win';
      setStats(s => ({ ...s, w: s.w + 1, t: s.t + 1 }));
    } else {
      kind = 'lose';
      dialoguePhase = result.why === 'timeout' ? 'timeout' : 'lose';
      setStats(s => ({ ...s, l: s.l + 1, t: s.t + 1 }));
    }

    const dialogue = pickLine(dialoguePhase);
    if (dialogue) pushChat(dialogue);

    setModal({ kind, why: result.why, dialogue });
  }, []);

  // Persist game when modal opens (has final moveList/name/elo)
  useEffect(() => {
    if (!modal || savedGameId) return;
    let cancelled = false;
    (async () => {
      const entry = await recordGame({
        playerName,
        result: modal.kind,
        why: modal.why,
        elo,
        playerColor: pc,
        moveList,
        moveCount: engRef.current.mh.length,
        durationMs: Date.now() - (startAtRef.current || Date.now()),
        playerTimeLeftMs: clockRef.current.playerMs,
        botTimeLeftMs: clockRef.current.botMs,
      });
      if (!cancelled && entry?.id) setSavedGameId(entry.id);
    })();
    return () => { cancelled = true; };
  }, [modal, savedGameId, playerName, elo, pc, moveList]);

  // 10-minute chess clocks — tick every 200ms while game active
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (!activeRef.current) return;
      const now = Date.now();
      const clk = clockRef.current;
      if (!clk.lastTick) {
        clk.lastTick = now;
        return;
      }
      const delta = now - clk.lastTick;
      clk.lastTick = now;
      const eng = engRef.current;
      const playerToMove = eng.t === pcRef.current;
      if (playerToMove) {
        clk.playerMs = Math.max(0, clk.playerMs - delta);
        setPlayerMs(clk.playerMs);
        if (clk.playerMs <= 0) {
          finishGame({
            res: pcRef.current === 'w' ? 'black' : 'white',
            why: 'timeout',
          });
        }
      } else {
        clk.botMs = Math.max(0, clk.botMs - delta);
        setBotMs(clk.botMs);
        if (clk.botMs <= 0) {
          finishGame({
            res: pcRef.current === 'w' ? 'white' : 'black',
            why: 'timeout',
          });
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [active, finishGame]);

  const botMove = useCallback(async () => {
    const eng = engRef.current;
    setThinking(true);
    const cfg = eloBudget(elo);
    let mv = null;
    try {
      const uci = await requestBestMove(eng.toFEN(), cfg.elo, cfg.time);
      mv = parseUCIMove(eng, uci);
    } catch {
      mv = null;
    }
    if (!activeRef.current) return; // game ended (e.g. resigned / timeout) while waiting
    if (!mv) {
      const bm = bestMove(eng, cfg.time, cfg.depth);
      mv = bm && bm.m;
    }
    if (!mv) {
      const st = eng.over();
      setThinking(false);
      if (st.o) finishGame(st);
      return;
    }
    const r = applyMove(mv);
    // Personality chat based on phase / events
    if (r.chk) kchat('check');
    else if (r.cap && r.cap !== '.') kchat('capture');
    else kchat(eng.mh.length < 10 ? 'open' : eng.mh.length < 30 ? 'mid' : 'end');
    rerender();
    const st = eng.over();
    setThinking(false);
    if (st.o) { finishGame(st); return; }
  }, [elo, finishGame]);

  const selectSquare = useCallback((r, c) => {
    const eng = engRef.current;
    if (!active || thinking || eng.t !== pc) return;
    if (sel) {
      const mv = legalTargets.find(m => m.tr === r && m.tc === c);
      if (mv) {
        applyMove(mv);
        setSel(null); setLegalTargets([]);
        rerender();
        const st = eng.over();
        if (st.o) { finishGame(st); return; }
        setTimeout(() => botMove(), 300);
        return;
      }
    }
    const p = eng.at(r, c);
    if (p !== '.' && (p === p.toUpperCase()) === (pc === 'w')) {
      setSel({ r, c });
      setLegalTargets(eng.legal().filter(m => m.fr === r && m.fc === c));
    } else {
      setSel(null); setLegalTargets([]);
    }
  }, [active, thinking, pc, sel, legalTargets, botMove, finishGame]);

  const resign = useCallback(() => {
    if (!active) return;
    finishGame({ res: pc === 'w' ? 'black' : 'white', why: 'resignation' });
  }, [active, pc, finishGame]);

  const flip = useCallback(() => setFlipped(f => !f), []);

  return {
    eng: engRef.current, active, thinking, pc, elo, playerName, sel, legalTargets,
    lastMove, moveList, captured, chat, stats, modal, flipped,
    playerMs, botMs, formatClock, savedGameId,
    startGame, selectSquare, resign, flip, setModal,
  };
}

export { INITIAL_MS, formatClock };
