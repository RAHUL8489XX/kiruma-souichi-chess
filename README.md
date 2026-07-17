# Kiruma Souichi — Chess (Full Stack)

A full-stack chess app: a **React frontend** (dark/red "shadow prodigy" theme) and a
**Node.js backend** that spawns your real `stockfish.exe` as a subprocess and talks
to it over the UCI protocol — so you get genuine desktop-grade Stockfish strength,
not a browser WASM approximation.

```
kiruma-app/
├── backend/         Node + Express API that runs the real Stockfish engine
│   ├── engine/       <-- put your stockfish.exe here (see below)
│   ├── server.js
│   ├── stockfish-uci.js
│   └── certificate.js
└── frontend/        React (Vite) app — landing screen, board, chat, victory modal
```

## 1. Install Stockfish

Take the `stockfish-windows-x86-64-avx2.exe` you already have and:

1. Rename it to `stockfish.exe`
2. Drop it into `backend/engine/stockfish.exe`

(Or leave it wherever you like and set the `STOCKFISH_PATH` environment variable
to its full path before starting the server — see step 3.)

> This backend must run on the same machine as the engine binary (Windows, since
> that's the build you have). If you ever want to deploy the backend to a Linux
> server, download the Linux build of Stockfish instead from
> https://stockfishchess.org/download/ and point `STOCKFISH_PATH` at that.

## 2. Install dependencies

You need [Node.js](https://nodejs.org) 18+ installed. Then, in two terminals:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 3. Run it

**Terminal 1 — backend:**
```bash
cd backend
npm start
```
You should see `Kiruma Souichi backend listening on http://localhost:4000` and
`Stockfish engine ready at ...`. If instead you see a warning that the binary
wasn't found, double check step 1, or set the path explicitly:

```bash
# Windows (PowerShell)
$env:STOCKFISH_PATH="C:\path\to\stockfish.exe"; npm start

# macOS/Linux
STOCKFISH_PATH=/path/to/stockfish npm start
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```
Open the URL it prints (usually http://localhost:5173).

That's it — pick a difficulty, pick a side, and enter the arena.

## How it fits together

- The frontend always runs full chess rules (legal moves, check/checkmate,
  castling, en passant, promotion) locally in `src/engine/ChessEngine.js` — this
  is instant and needs no network call.
- When it's Kiruma's turn, the frontend sends the current position (as a FEN
  string) to `POST /api/bestmove` on the backend, which asks the real Stockfish
  process for a move at the selected ELO (`UCI_LimitStrength` + `UCI_Elo`).
- If the backend is unreachable for any reason, the frontend automatically
  falls back to a small built-in JS search engine so the game never breaks —
  it'll just be a bit weaker.
- On victory, the frontend calls `POST /api/certificate`, which streams back a
  generated PDF ("You defeated the demon. Congratulations!") using `pdfkit`. If
  the backend is unreachable, it falls back to a plain-text certificate instead
  so the reward flow never dead-ends.
- Winners also unlock `GET /api/reward/strategy-pdf`, which downloads the
  project-root `Kiruma_souchii.pdf` secret strategy file.
- Finished games are stored in `backend/data/games.json`. The **Winners Dashboard**
  (`GET /api/leaderboard`) lists who beat Kiruma and lets you open a game for
  move-history analysis.
- Every game is **10 minutes per side** (sudden death). Timeout flags the loser.

## Deploying somewhere other than your own PC

Since `stockfish.exe` only runs on Windows, the simplest path is to keep running
the backend on your own Windows machine and just deploy the **frontend**
elsewhere (Vercel, Netlify, etc.), pointing it at your backend's address via the
`VITE_API_BASE` environment variable (see `frontend/src/api.js`). If you'd
rather host the backend in the cloud too, swap in a Linux Stockfish binary and
deploy `backend/` to any Node host (Render, Railway, a VPS, etc.) — the code
itself doesn't need to change, only `STOCKFISH_PATH`.

## Notes

- The "Undo" button was intentionally removed per request.
- If you want the exact flat cartoon-icon piece style from your reference
  screenshot (rather than the current bold Unicode glyphs), that's a follow-up
  — just ask and I'll swap in a custom SVG piece set.
