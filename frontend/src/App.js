/**
 * City Evacuation AI — React Frontend (v2 · Industry-Level)
 * ===========================================================
 *
 * Key upgrades over prototype:
 *
 *  1. SMOOTH TILE SLIDING
 *     Each tile is positioned absolutely inside a CSS Grid wrapper.
 *     On every board change, we compute a pixel-level (dx, dy) delta
 *     for the tile that moved, apply it as a CSS transform, then
 *     instantly snap the transform to 0 with `transition` doing the work.
 *     Result: real physical slide, not a teleport.
 *
 *  2. TECH STATS MODAL
 *     After every AI solve the backend returns nodes_explored,
 *     time_taken_ms, branching_factor, heuristic_start, solution_depth.
 *     A "View Tech Stats" button opens a modal with these metrics —
 *     exactly what a recruiter / interviewer wants to see.
 *
 *  3. DIFFICULTY SELECTOR
 *     Shuffle accepts ?moves=N so users can pick Easy / Medium / Hard.
 *
 *  4. CLEAN STATE MACHINE
 *     Game mode is a single string: "idle" | "human" | "ai" | "solved"
 *     instead of several booleans, making flow easier to reason about.
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import "./App.css";

// ─── Constants ───────────────────────────────────────────────
const API  = "http://localhost:5000";
const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const TILE_SIZE = 112;   // px — must match CSS .board-inner size / 3

const DISTRICTS = {
  1: { name: "Harbor",    icon: "⚓", color: "#c0392b" },
  2: { name: "Central",   icon: "🏛️", color: "#d35400" },
  3: { name: "Uptown",    icon: "🏙️", color: "#b7950b" },
  4: { name: "East Side", icon: "🌅", color: "#1e8449" },
  5: { name: "Market",    icon: "🏪", color: "#148f77" },
  6: { name: "West End",  icon: "🌆", color: "#1a5276" },
  7: { name: "Riverside", icon: "🌊", color: "#6c3483" },
  8: { name: "Airport",   icon: "✈️", color: "#922b21" },
  0: { name: "Route",     icon: "🚨", color: "transparent" },
};

const DIFFICULTY_OPTIONS = [
  { label: "Easy",   moves: 10 },
  { label: "Medium", moves: 25 },
  { label: "Hard",   moves: null },  // null = fully random
];


// ─── Utility ─────────────────────────────────────────────────

/** Convert board index to { row, col } */
const toRC = (idx) => ({ row: Math.floor(idx / 3), col: idx % 3 });

/** Format seconds as MM:SS */
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;


// ─── Sub-components ──────────────────────────────────────────

/** Single animated tile */
const Tile = React.memo(({ value, boardIndex, prevIndex, isHuman, onClick }) => {
  const ref   = useRef(null);
  const moved = prevIndex !== null && prevIndex !== boardIndex;

  useEffect(() => {
    if (!moved || !ref.current) return;

    // Where did this tile come FROM?
    const from = toRC(prevIndex);
    const to   = toRC(boardIndex);
    const dx   = (from.col - to.col) * TILE_SIZE;
    const dy   = (from.row - to.row) * TILE_SIZE;

    // Snap to old position instantly, then animate to new
    ref.current.style.transition = "none";
    ref.current.style.transform  = `translate(${dx}px, ${dy}px)`;

    // Force reflow so the browser registers the starting position
    void ref.current.offsetWidth;

    ref.current.style.transition = "transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)";
    ref.current.style.transform  = "translate(0,0)";
  }, [boardIndex, prevIndex, moved]);

  if (value === 0) {
    return (
      <div ref={ref} className="tile tile-empty" data-idx={boardIndex}>
        <span className="tile-route-icon">🚨</span>
      </div>
    );
  }

  const d  = DISTRICTS[value];
  const ok = GOAL[boardIndex] === value;

  return (
    <div
      ref={ref}
      className={[
        "tile tile-filled",
        ok        ? "tile-correct"   : "",
        isHuman   ? "tile-clickable" : "",
      ].join(" ")}
      style={{ "--tile-color": d.color }}
      data-idx={boardIndex}
      onClick={() => isHuman && onClick(boardIndex)}
      role={isHuman ? "button" : undefined}
      aria-label={isHuman ? `Move ${d.name}` : undefined}
    >
      <span className="tile-icon">{d.icon}</span>
      <span className="tile-name">{d.name}</span>
      <span className="tile-num">{value}</span>
    </div>
  );
});


/** Tech Stats modal — shown after AI solves */
const TechStatsModal = ({ stats, onClose }) => (
  <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h2 className="modal-title">🧪 Algorithm Observability</h2>
      <p className="modal-subtitle">A* · Manhattan Distance · heapq + closed-set O(1)</p>

      <div className="tech-grid">
        <div className="tech-card">
          <span className="tech-label">Solution Depth</span>
          <span className="tech-value">{stats.solution_depth}</span>
          <span className="tech-desc">Optimal moves (proven minimum)</span>
        </div>
        <div className="tech-card">
          <span className="tech-label">Nodes Explored</span>
          <span className="tech-value">{stats.nodes_explored.toLocaleString()}</span>
          <span className="tech-desc">States expanded by A*</span>
        </div>
        <div className="tech-card">
          <span className="tech-label">Compute Time</span>
          <span className="tech-value">{stats.time_taken_ms} ms</span>
          <span className="tech-desc">Wall-clock solver latency</span>
        </div>
        <div className="tech-card">
          <span className="tech-label">Branching Factor</span>
          <span className="tech-value">{stats.branching_factor}</span>
          <span className="tech-desc">nodes ^ (1 / depth) — effective b*</span>
        </div>
        <div className="tech-card">
          <span className="tech-label">h(start)</span>
          <span className="tech-value">{stats.heuristic_start}</span>
          <span className="tech-desc">Manhattan distance at initial state</span>
        </div>
        <div className="tech-card">
          <span className="tech-label">Heuristic</span>
          <span className="tech-value">Admissible</span>
          <span className="tech-desc">Never overestimates → optimal solution</span>
        </div>
      </div>

      <button className="btn btn-close-modal" onClick={onClose}>Close</button>
    </div>
  </div>
);


/** Victory popup */
const VictoryPopup = ({ steps, elapsed, techStats, onNew, onShowStats }) => (
  <div className="popup-overlay">
    <div className="popup">
      <div className="popup-emoji">🏆</div>
      <h2 className="popup-title">CITY SAVED!</h2>
      <p className="popup-sub">All districts successfully evacuated</p>
      <div className="popup-row">
        <div className="popup-stat"><span>⏱ Time</span><strong>{fmt(elapsed)}</strong></div>
        <div className="popup-stat"><span>👣 Moves</span><strong>{steps}</strong></div>
        {techStats && (
          <div className="popup-stat">
            <span>🧠 AI in</span>
            <strong>{techStats.time_taken_ms} ms</strong>
          </div>
        )}
      </div>
      <div className="popup-actions">
        {techStats && (
          <button className="btn btn-stats" onClick={onShowStats}>
            📊 View Tech Stats
          </button>
        )}
        <button className="btn btn-start" onClick={onNew}>🚀 New Emergency</button>
      </div>
    </div>
  </div>
);


// ─── Main App ────────────────────────────────────────────────

export default function App() {
  // ── Core game state ──
  const [board,      setBoard]      = useState(null);
  const [prevBoard,  setPrevBoard]  = useState(null);   // for slide animation
  const [mode,       setMode]       = useState("idle"); // idle|human|ai|solved
  const [steps,      setSteps]      = useState(0);
  const [elapsed,    setElapsed]    = useState(0);
  const [difficulty, setDifficulty] = useState(DIFFICULTY_OPTIONS[1]);

  // ── AI / solve state ──
  const [aiPath,      setAiPath]      = useState([]);
  const [aiIdx,       setAiIdx]       = useState(0);
  const [techStats,   setTechStats]   = useState(null);

  // ── UI state ──
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [showVictory,   setShowVictory]   = useState(false);
  const [showTechModal, setShowTechModal] = useState(false);

  // ── Refs ──
  const timerRef    = useRef(null);
  const aiRef       = useRef(null);
  const startRef    = useRef(null);

  // ─ Helpers ──────────────────────────────────────────────
  const stopAll = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(aiRef.current);
  }, []);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }, []);

  const applyBoard = useCallback((next) => {
    setPrevBoard((prev) => prev);   // keep prev snapshot for animation delta
    setBoard((cur) => {
      setPrevBoard(cur);
      return next;
    });
  }, []);

  const hardReset = useCallback(() => {
    stopAll();
    setBoard(null);
    setPrevBoard(null);
    setMode("idle");
    setSteps(0);
    setElapsed(0);
    setAiPath([]);
    setAiIdx(0);
    setTechStats(null);
    setError("");
    setShowVictory(false);
    setShowTechModal(false);
  }, [stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  // ─ Build prevIndex map for animation ───────────────────
  // Maps tile VALUE → its index in the previous board
  const prevIndexMap = useMemo(() => {
    if (!prevBoard) return {};
    const m = {};
    prevBoard.forEach((val, idx) => { m[val] = idx; });
    return m;
  }, [prevBoard]);

  // ─── Handlers ──────────────────────────────────────────

  const fetchBoard = async (movesParam) => {
    const url = movesParam
      ? `${API}/shuffle?moves=${movesParam}`
      : `${API}/shuffle`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error("Shuffle failed");
    return res.json();
  };

  const handleStart = async () => {
    hardReset();
    setLoading(true);
    try {
      const data = await fetchBoard(difficulty.moves);
      setPrevBoard(null);
      setBoard(data.board);
    } catch {
      setError("⚠️ Cannot reach backend. Is Flask running on port 5000?");
    }
    setLoading(false);
  };

  const handleShuffle = async () => {
    if (!board) return;
    stopAll();
    setMode("idle");
    setSteps(0);
    setElapsed(0);
    setAiPath([]);
    setTechStats(null);
    setError("");
    setShowVictory(false);
    setLoading(true);
    try {
      const data = await fetchBoard(difficulty.moves);
      setPrevBoard(null);
      setBoard(data.board);
    } catch {
      setError("⚠️ Shuffle failed.");
    }
    setLoading(false);
  };

  const handlePlayHuman = () => {
    if (!board || mode === "solved") return;
    stopAll();
    clearInterval(aiRef.current);
    setMode("human");
    setSteps(0);
    setTechStats(null);
    startTimer();
  };

  const handlePlayAI = async () => {
    if (!board || mode === "ai" || mode === "solved") return;
    stopAll();
    setMode("ai");
    setTechStats(null);
    setLoading(true);

    try {
      const res  = await fetch(`${API}/solve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ board }),
      });
      const data = await res.json();

      if (data.error)          { setError(data.error); setMode("idle"); setLoading(false); return; }
      if (data.already_solved) { setMode("solved"); setShowVictory(true); setLoading(false); return; }

      // Store observability metrics
      setTechStats({
        solution_depth:   data.solution_depth,
        nodes_explored:   data.nodes_explored,
        time_taken_ms:    data.time_taken_ms,
        branching_factor: data.branching_factor,
        heuristic_start:  data.heuristic_start,
      });

      setAiPath(data.solution_path);
      setAiIdx(0);
      startTimer();

      let i = 0;
      aiRef.current = setInterval(() => {
        if (i >= data.solution_path.length) {
          clearInterval(aiRef.current);
          clearInterval(timerRef.current);
          setMode("solved");
          setShowVictory(true);
          return;
        }
        const step = data.solution_path[i];
        setPrevBoard((cur) => cur);
        setBoard((cur) => { setPrevBoard(cur); return step.board; });
        setSteps(step.step);
        setAiIdx(i + 1);
        i++;
      }, 380);

    } catch {
      setError("⚠️ AI solver failed. Is Flask running?");
      setMode("idle");
    }
    setLoading(false);
  };

  const handleTileClick = async (tileIndex) => {
    if (mode !== "human" || !board) return;
    if (board[tileIndex] === 0) return;

    try {
      const res  = await fetch(`${API}/move`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ board, tile_index: tileIndex }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }

      setPrevBoard(board);
      setBoard(data.board);
      setSteps(data.steps);
      setError("");

      if (data.solved) {
        clearInterval(timerRef.current);
        setMode("solved");
        setShowVictory(true);
      }
    } catch {
      setError("⚠️ Move failed. Check backend.");
    }
  };

  // ── Derived ──
  const isAI       = mode === "ai";
  const isHuman    = mode === "human";
  const isSolved   = mode === "solved";
  const hasBoard   = board !== null;
  const aiProgress = aiPath.length > 0 ? (aiIdx / aiPath.length) * 100 : 0;

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="alert-badge">🚨 EMERGENCY DISPATCH ACTIVE</div>
        <h1 className="title">
          <span className="t1">CITY</span>
          <span className="t2">EVACUATION</span>
          <span className="t3">AI COMMAND</span>
        </h1>
        <p className="subtitle">
          Rearrange city district tiles into the optimal evacuation layout.
          Let the AI plan the route — or take command yourself.
        </p>
      </header>

      {/* ── Stats bar ── */}
      <div className="stats-bar">
        <Stat label="⏱ TIME"  value={fmt(elapsed)} />
        <Stat label="👣 MOVES" value={steps} />
        <Stat label="🎚️ LEVEL"  value={difficulty.label} />
        <Stat
          label="🧠 MODE"
          value={isAI ? "AI" : isHuman ? "HUMAN" : isSolved ? "SOLVED" : "STANDBY"}
          accent={isAI ? "blue" : isHuman ? "green" : isSolved ? "gold" : "muted"}
        />
      </div>

      {/* ── Error banner ── */}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* ── Controls ── */}
      <div className="controls">
        <button className="btn btn-start"   onClick={handleStart}      disabled={loading}>
          {loading ? "⏳ Loading…" : "🚀 Start Game"}
        </button>
        <button className="btn btn-shuffle" onClick={handleShuffle}    disabled={!hasBoard || loading || isAI}>
          🔀 Shuffle
        </button>
        <button className="btn btn-human"   onClick={handlePlayHuman}  disabled={!hasBoard || isSolved || isAI}>
          👤 Play as Human
        </button>
        <button className="btn btn-ai"      onClick={handlePlayAI}     disabled={!hasBoard || isSolved || isAI || loading}>
          🤖 Play as AI
        </button>
      </div>

      {/* ── Difficulty ── */}
      <div className="difficulty-row">
        <span className="diff-label">DIFFICULTY:</span>
        {DIFFICULTY_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            className={`diff-btn ${difficulty.label === opt.label ? "diff-active" : ""}`}
            onClick={() => setDifficulty(opt)}
            disabled={isAI}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Goal hint ── */}
      {hasBoard && (
        <div className="goal-hint">
          <span className="goal-label">🎯 TARGET ORDER</span>
          <div className="goal-tiles">
            {GOAL.map((val, i) => (
              <div
                key={i}
                className="goal-tile"
                style={{ background: val ? DISTRICTS[val].color : "rgba(255,45,85,0.1)" }}
              >
                {DISTRICTS[val]?.icon}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Board ── */}
      <div className="board-wrapper">
        {!hasBoard ? (
          <div className="board-placeholder">
            <span className="placeholder-icon">🏙️</span>
            <p>Press <strong>Start Game</strong> to deploy the response system</p>
          </div>
        ) : (
          <div className="board-inner">
            {board.map((val, idx) => (
              <Tile
                key={val === 0 ? "empty" : val}
                value={val}
                boardIndex={idx}
                prevIndex={prevIndexMap[val] ?? null}
                isHuman={isHuman}
                onClick={handleTileClick}
              />
            ))}
          </div>
        )}

        {isAI && aiPath.length > 0 && (
          <div className="ai-progress-wrap">
            <div className="ai-bar">
              <div className="ai-fill" style={{ width: `${aiProgress}%` }} />
            </div>
            <span className="ai-label">AI: step {aiIdx} / {aiPath.length}</span>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      {hasBoard && (
        <div className="legend">
          <span className="leg-item"><span className="leg-dot green" /> Correct position</span>
          <span className="leg-item"><span className="leg-dot gray"  /> Needs moving</span>
          <span className="leg-item">🚨 = Open escape route</span>
        </div>
      )}

      {/* ── Victory popup ── */}
      {showVictory && (
        <VictoryPopup
          steps={steps}
          elapsed={elapsed}
          techStats={techStats}
          onNew={handleStart}
          onShowStats={() => { setShowVictory(false); setShowTechModal(true); }}
        />
      )}

      {/* ── Tech Stats modal ── */}
      {showTechModal && techStats && (
        <TechStatsModal
          stats={techStats}
          onClose={() => setShowTechModal(false)}
        />
      )}

      <footer className="footer">
        City Evacuation AI v2 · A* Algorithm · React 18 + Flask 3
      </footer>
    </div>
  );
}

/* ── Tiny Stat card helper ─────────────────── */
function Stat({ label, value, accent }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${accent ? `accent-${accent}` : ""}`}>{value}</span>
    </div>
  );
}
