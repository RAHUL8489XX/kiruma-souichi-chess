import React from 'react';
import { Piece } from './Pieces.jsx';

export default function Board({ eng, pc, flipped, sel, legalTargets, lastMove, onSquareClick }) {
  const squares = [];
  const sideInCheck = eng.check(eng.t);

  for (let i = 0; i < 64; i++) {
    const r = flipped ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
    const c = flipped ? 7 - (i % 8) : i % 8;
    const isLight = (r + c) % 2 === 0;
    const piece = eng.at(r, c);
    const isSel = sel && sel.r === r && sel.c === c;
    const targetMove = legalTargets.find(m => m.tr === r && m.tc === c);
    const isTarget = !!targetMove;
    const isCapture = isTarget && piece !== '.';
    const isLast = lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c));
    const pieceColor = piece !== '.' ? (piece === piece.toUpperCase() ? 'w' : 'b') : null;
    const kingInCheck = piece.toLowerCase() === 'k' && pieceColor === eng.t && sideInCheck;

    const cls = ['sq', isLight ? 'l' : 'd'];
    if (isSel) cls.push('sel');
    if (isLast) cls.push('last');
    if (kingInCheck) cls.push('chk');
    if (isTarget && isCapture) cls.push('cap');

    squares.push(
      <div key={i} className={cls.join(' ')} onClick={() => onSquareClick(r, c)}>
        {c === (flipped ? 7 : 0) && (
          <span className={'coord rank ' + (isLight ? 'on-l' : 'on-d')}>{'87654321'[r]}</span>
        )}
        {r === (flipped ? 0 : 7) && (
          <span className={'coord file ' + (isLight ? 'on-l' : 'on-d')}>{'abcdefgh'[c]}</span>
        )}
        {isTarget && !isCapture && <span className="dot" />}
        {isTarget && isCapture && <span className="cap-ring" />}
        {piece !== '.' && (
          <div className={'pc ' + pieceColor}>
            <Piece type={piece.toLowerCase()} color={pieceColor} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bwrap">
      <div className="board">{squares}</div>
    </div>
  );
}
