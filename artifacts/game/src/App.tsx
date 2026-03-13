import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Player {
  id: string;
  name: string;
  score: number;
}

interface RoundEntry {
  name: string;
  place: string;
  thing: string;
  animal: string;
  finishedFirst?: boolean;
}

interface RoundResult {
  playerId: string;
  playerName: string;
  entry: RoundEntry;
  roundScore: number;
  totalScore: number;
}

type Screen = "join" | "lobby";

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [screen, setScreen] = useState<Screen>("join");
  const [myId, setMyId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [hasFinished, setHasFinished] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const [ansName, setAnsName] = useState("");
  const [ansPlace, setAnsPlace] = useState("");
  const [ansThing, setAnsThing] = useState("");
  const [ansAnimal, setAnsAnimal] = useState("");

  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[] | null>(null);
  const [notification, setNotification] = useState<string>("");
  const [notifVisible, setNotifVisible] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [countdownPct, setCountdownPct] = useState(100);
  const [countdownSec, setCountdownSec] = useState(7);
  const animFrame = useRef<number | null>(null);

  const showNotif = useCallback((msg: string) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification(msg);
    setNotifVisible(true);
    notifTimer.current = setTimeout(() => setNotifVisible(false), 3500);
  }, []);

  const runCountdown = useCallback((endsAt: number) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      setCountdownPct((remaining / 7000) * 100);
      setCountdownSec(Math.ceil(remaining / 1000));
      if (remaining > 0) animFrame.current = requestAnimationFrame(tick);
    };
    animFrame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const socket = io({ path: `${BASE}/api/socket.io` });
    socketRef.current = socket;

    socket.on("joined", (data) => {
      setMyId(data.playerId);
      setPlayers(data.players);
      setRoundActive(data.roundActive);
      setCountdownActive(data.countdownActive);
      setGameStarted(data.gameStarted);
      setRoundNumber(data.roundNumber);
      if (data.currentLetter) setCurrentLetter(data.currentLetter);
      if (data.countdownActive && data.countdownEndsAt) {
        setCountdownEndsAt(data.countdownEndsAt);
        runCountdown(data.countdownEndsAt);
      }
      setScreen("lobby");
    });

    socket.on("players_update", (p: Player[]) => setPlayers(p));

    socket.on("round_started", (data: { letter: string; roundNumber: number }) => {
      setRoundActive(true);
      setCountdownActive(false);
      setHasFinished(false);
      setGameStarted(true);
      setCurrentLetter(data.letter);
      setRoundNumber(data.roundNumber);
      setAnsName(""); setAnsPlace(""); setAnsThing(""); setAnsAnimal("");
      setRoundResults(null);
      setLeaderboard(null);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setCountdownPct(100);
      showNotif(`✨ Round ${data.roundNumber} started! Letter: ${data.letter}`);
    });

    socket.on("countdown_started", (data: { endsAt: number; triggeredBy: string }) => {
      setCountdownActive(true);
      setCountdownEndsAt(data.endsAt);
      runCountdown(data.endsAt);
      showNotif(`⏱ ${data.triggeredBy} finished! 7 seconds remaining!`);
    });

    socket.on("round_results", (data: { results: RoundResult[]; players: Player[] }) => {
      setRoundActive(false);
      setCountdownActive(false);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setCountdownPct(100);
      setRoundResults(data.results);
      setPlayers(data.players);
      setHasFinished(false);
      showNotif("🎉 Round over! Scores updated!");
    });

    socket.on("show_leaderboard", (p: Player[]) => {
      setLeaderboard(p);
    });

    socket.on("connect_error", () => showNotif("⚠️ Connection error. Retrying..."));

    return () => { socket.disconnect(); };
  }, [runCountdown, showNotif]);

  const joinGame = () => {
    const name = nameInput.trim();
    if (!name) { showNotif("Please enter your name!"); return; }
    socketRef.current?.emit("join", name);
  };

  const guessAlphabet = () => {
    if (roundActive || countdownActive) { showNotif("A round is already in progress!"); return; }
    socketRef.current?.emit("guess_alphabet");
  };

  const finishRow = () => {
    const entry = { name: ansName, place: ansPlace, thing: ansThing, animal: ansAnimal };
    if (roundActive && !countdownActive) {
      socketRef.current?.emit("finish_row", entry);
      setHasFinished(true);
    } else if (countdownActive) {
      socketRef.current?.emit("submit_entry", entry);
      setHasFinished(true);
    }
  };

  const showLeaderboard = () => socketRef.current?.emit("final_leaderboard");

  const inputsDisabled = !roundActive || hasFinished;
  const canFinish = (roundActive || countdownActive) && !hasFinished;

  const rankIcons = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        :root {
          --bg: #0d0d1a;
          --surface: #13132b;
          --surface2: #1a1a38;
          --border: #2a2a5a;
          --purple: #b44dff;
          --purple-dim: #7a1fcc;
          --cyan: #00e5ff;
          --cyan-dim: #0098aa;
          --text: #e8e8ff;
          --text-dim: #8888bb;
          --green: #00ff88;
          --red: #ff4466;
          --gold: #ffd700;
          --radius: 12px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=text] {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.95rem;
          padding: 0.6rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        input[type=text]:focus { border-color: var(--purple); }
        input[type=text]:disabled { opacity: 0.45; cursor: not-allowed; }
        button {
          border: none; border-radius: 8px; cursor: pointer;
          font-size: 0.9rem; font-weight: 700; letter-spacing: 0.02em;
          padding: 0.65rem 1.3rem; transition: opacity 0.15s, transform 0.1s;
        }
        button:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg,#7a1fcc,#00aacc); color:#fff; }
        .btn-cyan { background: linear-gradient(135deg,#0098aa,#00e5ff); color:#000; }
        .btn-green { background: linear-gradient(135deg,#00aa55,#00ff88); color:#000; }
        .btn-gold { background: linear-gradient(135deg,#aa8800,#ffd700); color:#000; }
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.4rem 1.5rem;
          margin-bottom: 1.1rem;
        }
        .card-title {
          font-size: 0.75rem; color: var(--cyan); text-transform: uppercase;
          letter-spacing: 0.1em; font-weight: 700; margin-bottom: 1rem;
        }
        .chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 999px; padding: 0.35rem 0.85rem; font-size: 0.82rem;
        }
        .chip-me { border-color: var(--purple); color: var(--purple); }
        .chip-score { color: var(--cyan); font-weight: 700; font-size: 0.72rem; }
        .game-table { width: 100%; border-collapse: collapse; }
        .game-table th { background: var(--surface2); border: 1px solid var(--border); color: var(--cyan); font-size: 0.74rem; padding: 0.5rem 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; }
        .game-table td { border: 1px solid var(--border); padding: 0.4rem 0.5rem; }
        .game-table input { border: none; background: transparent; padding: 0.25rem 0.3rem; width: 100%; color: var(--text); font-size: 0.9rem; outline: none; }
        .game-table input:focus { background: var(--surface2); border-radius: 4px; }
        .res-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .res-table th { background: var(--surface2); border: 1px solid var(--border); color: var(--purple); padding: 0.5rem 0.6rem; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; text-align: left; }
        .res-table td { border: 1px solid var(--border); padding: 0.5rem 0.6rem; }
        .res-table tr:nth-child(even) td { background: #0e0e20; }
        .lb-item { display:flex; align-items:center; gap:1rem; background: var(--surface2); border: 1px solid var(--border); border-radius:10px; padding: 0.85rem 1.1rem; margin-bottom:0.55rem; }
        .lb-me { border-color: var(--purple); }
        .notif {
          position: fixed; top: 1rem; left: 50%; transform: translateX(-50%) translateY(-120%);
          background: var(--surface); border: 1px solid var(--purple); border-radius: 10px;
          padding: 0.7rem 1.4rem; font-weight: 700; font-size: 0.9rem; color: var(--text);
          transition: transform 0.3s; z-index: 9999; white-space: nowrap;
          box-shadow: 0 0 20px #7a1fcc66;
        }
        .notif.show { transform: translateX(-50%) translateY(0); }
        .countdown-wrap { background: var(--surface2); border-radius: 999px; height: 9px; overflow: hidden; margin: 0.6rem 0; }
        .countdown-bar { height: 100%; background: linear-gradient(90deg,#ff4466,#b44dff); border-radius:999px; transition: width 0.1s linear; }
        @media(max-width:600px){ .res-table { font-size: 0.75rem; } }
      `}</style>

      <div className={`notif${notifVisible ? " show" : ""}`}>{notification}</div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 1rem 3rem" }}>
        <h1 style={{
          textAlign: "center", fontSize: "clamp(1.4rem,4vw,2rem)", fontWeight: 900,
          letterSpacing: "0.03em", padding: "1.4rem 1rem 0.4rem",
          background: "linear-gradient(90deg,#b44dff,#00e5ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
        }}>Name, Place, Thing, Animal</h1>
        <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.8rem" }}>
          Real-time multiplayer word game
        </p>

        {screen === "join" && (
          <div className="card" style={{ boxShadow: "0 0 16px #7a1fcc55" }}>
            <div className="card-title">Join the Lobby</div>
            <div style={{ display: "flex", gap: "0.7rem" }}>
              <input
                type="text"
                placeholder="Enter your name..."
                maxLength={20}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && joinGame()}
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={joinGame}>Join</button>
            </div>
          </div>
        )}

        {screen === "lobby" && (
          <>
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" }}>
                <div className="card-title" style={{ margin: 0 }}>Players</div>
                <span style={{
                  background: countdownActive ? "#3a1a1a" : roundActive ? "#1a3a1a" : "var(--surface2)",
                  color: countdownActive ? "var(--red)" : roundActive ? "var(--green)" : "var(--text-dim)",
                  border: `1px solid ${countdownActive ? "var(--red)" : roundActive ? "var(--green)" : "var(--border)"}`,
                  borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", textTransform: "uppercase"
                }}>
                  {countdownActive ? "Countdown!" : roundActive ? "Round Active" : gameStarted ? "Between Rounds" : "Waiting"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                {players.map(p => (
                  <div key={p.id} className={`chip${p.id === myId ? " chip-me" : ""}`}>
                    {p.id === myId && "👤 "}{p.name}
                    <span className="chip-score">{p.score}pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ boxShadow: "0 0 16px #0098aa44" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <div style={{
                    fontSize: "clamp(3rem,10vw,5rem)", fontWeight: 900, lineHeight: 1,
                    background: "linear-gradient(135deg,#b44dff,#00e5ff)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                    filter: currentLetter ? "drop-shadow(0 0 20px #b44dff)" : "none",
                    marginBottom: "0.4rem"
                  }}>
                    {currentLetter || "?"}
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                    {roundNumber > 0 ? `Round ${roundNumber}` : 'Press "Guess Alphabet" to start'}
                    {roundActive && !countdownActive && " — Fill in your answers!"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <button className="btn-cyan" onClick={guessAlphabet} disabled={roundActive || countdownActive}>
                    🎲 Guess Alphabet
                  </button>
                  <button className="btn-gold" onClick={showLeaderboard}>
                    🏆 Final Leaderboard
                  </button>
                </div>
              </div>

              {countdownActive && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ color: "var(--red)", fontWeight: 700, textAlign: "center", fontSize: "1rem", marginBottom: "0.3rem" }}>
                    ⏱ Round ends in {countdownSec}s
                  </div>
                  <div className="countdown-wrap">
                    <div className="countdown-bar" style={{ width: `${countdownPct}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Your Answers — Letter: {currentLetter || "?"}</div>
              <table className="game-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Place</th>
                    <th>Thing</th>
                    <th>Animal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><input type="text" placeholder="Name..." maxLength={50} value={ansName} onChange={e => setAnsName(e.target.value)} disabled={inputsDisabled} /></td>
                    <td><input type="text" placeholder="Place..." maxLength={50} value={ansPlace} onChange={e => setAnsPlace(e.target.value)} disabled={inputsDisabled} /></td>
                    <td><input type="text" placeholder="Thing..." maxLength={50} value={ansThing} onChange={e => setAnsThing(e.target.value)} disabled={inputsDisabled} /></td>
                    <td><input type="text" placeholder="Animal..." maxLength={50} value={ansAnimal} onChange={e => setAnsAnimal(e.target.value)} disabled={inputsDisabled} /></td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem" }}>
                <button className="btn-green" onClick={finishRow} disabled={!canFinish}>
                  {countdownActive && !hasFinished ? "⚡ Submit Now" : hasFinished ? "✅ Submitted" : "✅ Finish Row"}
                </button>
                {hasFinished && <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>Answers saved!</span>}
              </div>
            </div>

            {roundResults && (
              <div className="card">
                <div className="card-title">Round Results</div>
                <div style={{ overflowX: "auto" }}>
                  <table className="res-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Name</th>
                        <th>Place</th>
                        <th>Thing</th>
                        <th>Animal</th>
                        <th style={{ color: "var(--green)" }}>Round +</th>
                        <th style={{ color: "var(--cyan)" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundResults.map(r => (
                        <tr key={r.playerId} style={r.playerId === myId ? { background: "rgba(180,77,255,0.07)" } : {}}>
                          <td>
                            {r.playerName}
                            {r.playerId === myId && <span style={{ color: "var(--purple)", fontSize: "0.72rem" }}> (you)</span>}
                          </td>
                          <td>{r.entry.name || "—"}</td>
                          <td>{r.entry.place || "—"}</td>
                          <td>{r.entry.thing || "—"}</td>
                          <td>{r.entry.animal || "—"}</td>
                          <td style={{ color: "var(--green)", fontWeight: 700 }}>+{r.roundScore}</td>
                          <td style={{ color: "var(--cyan)", fontWeight: 700 }}>{r.totalScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {leaderboard && (
              <div className="card">
                <div className="card-title">🏆 Final Leaderboard</div>
                {leaderboard.map((p, i) => (
                  <div key={p.id} className={`lb-item${p.id === myId ? " lb-me" : ""}`}>
                    <div style={{
                      fontSize: "1.5rem", fontWeight: 900, minWidth: "2rem", textAlign: "center",
                      color: i === 0 ? "var(--gold)" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "var(--text-dim)"
                    }}>
                      {rankIcons[i] || `#${i + 1}`}
                    </div>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: "1rem" }}>
                      {p.name}{p.id === myId && <span style={{ color: "var(--purple)", fontSize: "0.78rem" }}> (you)</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--cyan)" }}>
                      {p.score} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
