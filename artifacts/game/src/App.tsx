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

interface LockedEntry {
  playerId: string;
  playerName: string;
  entry: RoundEntry;
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
  const [hasFinished, setHasFinished] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);

  const [joinStatus, setJoinStatus] = useState<"idle" | "waiting" | "rejected">("idle");
  const [pendingRequests, setPendingRequests] = useState<{requestId: string, username: string}[]>([]);

  const [ansName, setAnsName] = useState("");
  const [ansPlace, setAnsPlace] = useState("");
  const [ansThing, setAnsThing] = useState("");
  const [ansAnimal, setAnsAnimal] = useState("");
  
  const answersRef = useRef({ name: "", place: "", thing: "", animal: "" });

  const updateAnsName   = (v: string) => { setAnsName(v);   answersRef.current.name   = v; };
  const updateAnsPlace  = (v: string) => { setAnsPlace(v);  answersRef.current.place  = v; };
  const updateAnsThing  = (v: string) => { setAnsThing(v);  answersRef.current.thing  = v; };
  const updateAnsAnimal = (v: string) => { setAnsAnimal(v); answersRef.current.animal = v; };

  const [lockedEntries, setLockedEntries] = useState<LockedEntry[] | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [scoresSubmitted, setScoresSubmitted] = useState(false);

  const [leaderboard, setLeaderboard] = useState<Player[] | null>(null);
  const [notification, setNotification] = useState<string>("");
  const [notifVisible, setNotifVisible] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [countdownPct, setCountdownPct] = useState(100);
  const [countdownSec, setCountdownSec] = useState(7);
  const animFrame = useRef<number | null>(null);

  const autoSubmittedRef = useRef(false);
  const myIdRef = useRef<string | null>(null);

  const showNotif = useCallback((msg: string) => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification(msg);
    setNotifVisible(true);
    notifTimer.current = setTimeout(() => setNotifVisible(false), 3500);
  }, []);

  const runCountdown = useCallback((remainingMs: number) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    autoSubmittedRef.current = false;
    const localEnd = Date.now() + remainingMs;

    const tick = () => {
      const remaining = Math.max(0, localEnd - Date.now());
      setCountdownPct((remaining / 7000) * 100);
      setCountdownSec(Math.ceil(remaining / 1000));

      if (remaining > 0) {
        animFrame.current = requestAnimationFrame(tick);
      } else {
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          const entry = answersRef.current;
          socketRef.current?.emit("submit_entry", {
            name: entry.name,
            place: entry.place,
            thing: entry.thing,
            animal: entry.animal,
          });
        }
      }
    };
    animFrame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const socket = io({ path: `${BASE}/api/socket.io` });
    socketRef.current = socket;

    socket.on("joined", (data) => {
      setMyId(data.playerId);
      myIdRef.current = data.playerId;
      setPlayers(data.players);
      setRoundActive(data.roundActive);
      setCountdownActive(data.countdownActive);
      setGameStarted(data.gameStarted);
      setRoundNumber(data.roundNumber);
      setIsAdmin(!!data.isAdmin);
      setAdminId(data.adminId ?? null);
      if (data.currentLetter) setCurrentLetter(data.currentLetter);
      if (data.countdownActive && data.remainingMs != null) {
        runCountdown(data.remainingMs);
      }
      setJoinStatus("idle");
      setScreen("lobby");
    });

    socket.on("waiting_for_admin", () => {
      setJoinStatus("waiting");
    });

    socket.on("join_denied", () => {
      setJoinStatus("rejected");
    });

    socket.on("pending_join_request", (data: { requestId: string, username: string }) => {
      setPendingRequests(prev => [...prev, data]);
    });

    socket.on("players_update", (p: Player[]) => setPlayers(p));

    socket.on("admin_update", (data: { adminId: string | null }) => {
      setAdminId(data.adminId);
      setIsAdmin(myIdRef.current === data.adminId);
    });

    socket.on("round_started", (data: { letter: string; roundNumber: number }) => {
      setRoundActive(true);
      setCountdownActive(false);
      setHasFinished(false);
      setGameStarted(true);
      setCurrentLetter(data.letter);
      setRoundNumber(data.roundNumber);
      setAnsName(""); setAnsPlace(""); setAnsThing(""); setAnsAnimal("");
      answersRef.current = { name: "", place: "", thing: "", animal: "" };
      setLockedEntries(null);
      setManualScores({});
      setScoresSubmitted(false);
      setLeaderboard(null);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setCountdownPct(100);
      showNotif(`✨ Round ${data.roundNumber} started! Letter: ${data.letter}`);
    });

    socket.on("countdown_started", (data: { remainingMs: number; triggeredBy: string }) => {
      setCountdownActive(true);
      runCountdown(data.remainingMs);
      showNotif(`⏱ ${data.triggeredBy} finished! 7 seconds remaining!`);
      const a = answersRef.current;
      socket.emit("submit_entry", { name: a.name, place: a.place, thing: a.thing, animal: a.animal });
    });

    socket.on("request_submit_now", () => {
      const a = answersRef.current;
      socket.emit("submit_entry", { name: a.name, place: a.place, thing: a.thing, animal: a.animal });
    });

    socket.on("round_locked", (data: { entries: LockedEntry[] }) => {
      setRoundActive(false);
      setCountdownActive(false);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      setCountdownPct(100);

      const myEntry = answersRef.current;
      const merged = data.entries.map((e) => {
        if (e.playerId === myIdRef.current) {
          return {
            ...e,
            entry: {
              name:   e.entry.name   || myEntry.name,
              place:  e.entry.place  || myEntry.place,
              thing:  e.entry.thing  || myEntry.thing,
              animal: e.entry.animal || myEntry.animal,
              finishedFirst: e.entry.finishedFirst,
            },
          };
        }
        return e;
      });

      setLockedEntries(merged);
      const init: Record<string, string> = {};
      for (const e of merged) init[e.playerId] = "0";
      setManualScores(init);
      setScoresSubmitted(false);
      showNotif("🔒 Round locked! Admin is reviewing answers.");
    });

    socket.on("scores_applied", (data: { players: Player[] }) => {
      setPlayers(data.players);
      setScoresSubmitted(true);
      showNotif("✅ Scores saved!");
    });

    socket.on("show_leaderboard", (p: Player[]) => {
      setLeaderboard(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    socket.on("room_reset", (data: { adminId: string, players: Player[] }) => {
      if (myIdRef.current === data.adminId) {
        setPlayers(data.players);
        setCurrentLetter(null);
        setRoundNumber(0);
        setRoundActive(false);
        setCountdownActive(false);
        setHasFinished(false);
        setGameStarted(false);
        setLockedEntries(null);
        setManualScores({});
        setScoresSubmitted(false);
        setLeaderboard(null);
        setPendingRequests([]);
        setAnsName(""); setAnsPlace(""); setAnsThing(""); setAnsAnimal("");
        answersRef.current = { name: "", place: "", thing: "", animal: "" };
        if (animFrame.current) cancelAnimationFrame(animFrame.current);
        showNotif("🔄 Room reset successful. Lobby cleared!");
      } else {
        setScreen("join");
        setMyId(null);
        setPlayers([]);
        setCurrentLetter(null);
        setRoundNumber(0);
        setRoundActive(false);
        setCountdownActive(false);
        setHasFinished(false);
        setGameStarted(false);
        setIsAdmin(false);
        setAdminId(null);
        setLockedEntries(null);
        setManualScores({});
        setScoresSubmitted(false);
        setLeaderboard(null);
        setJoinStatus("idle");
        setPendingRequests([]);
        setAnsName(""); setAnsPlace(""); setAnsThing(""); setAnsAnimal("");
        answersRef.current = { name: "", place: "", thing: "", animal: "" };
        if (animFrame.current) cancelAnimationFrame(animFrame.current);
        showNotif("🔄 The Admin has reset the room.");
      }
    });

    socket.on("connect_error", () => showNotif("⚠️ Connection error. Retrying..."));

    return () => { socket.disconnect(); };
  }, [runCountdown, showNotif]);

  const joinGame = () => {
    const name = nameInput.trim();
    if (!name) { showNotif("Please enter your name!"); return; }
    setJoinStatus("idle");
    socketRef.current?.emit("join", name);
  };

  const handleJoinResponse = (requestId: string, decision: "accept" | "reject") => {
    socketRef.current?.emit("admin_join_response", { requestId, decision });
    setPendingRequests(prev => prev.filter(req => req.requestId !== requestId));
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
      autoSubmittedRef.current = true;
      setHasFinished(true);
    }
  };

  const applyScores = () => {
    const scores = Object.entries(manualScores).map(([playerId, val]) => ({
      playerId,
      score: parseFloat(val) || 0,
    }));
    socketRef.current?.emit("submit_scores", scores);
  };

  const showLeaderboard = () => socketRef.current?.emit("final_leaderboard");

  const resetGame = () => {
    socketRef.current?.emit("reset_game");
  };

  const inputsLocked = (!roundActive && !countdownActive) || hasFinished;
  const canFinish = (roundActive || countdownActive) && !hasFinished;
  const hasValidScores = leaderboard && leaderboard.length > 0 && leaderboard.some(p => p.score > 0);
  
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        :root {
          --bg: #0d0d1a; --surface: #13132b; --surface2: #1a1a38;
          --border: #2a2a5a; --purple: #b44dff; --cyan: #00e5ff;
          --text: #e8e8ff; --text-dim: #8888bb; --green: #00ff88;
          --red: #ff4466; --gold: #ffd700; --radius: 12px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=text] {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-size: 0.95rem;
          padding: 0.6rem 0.9rem; outline: none; transition: border-color 0.2s; width: 100%;
        }
        input[type=text]:focus { border-color: var(--purple); }
        input[type=text]:disabled { opacity: 0.45; cursor: not-allowed; }
        input[type=number] {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 6px; color: var(--cyan); font-size: 1rem;
          font-weight: 700; padding: 0.4rem 0.5rem; outline: none;
          width: 65px; text-align: center;
        }
        input[type=number]:focus { border-color: var(--purple); }
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
        .btn-purple { background: linear-gradient(135deg,#7a1fcc,#b44dff); color:#fff; }
        .btn-red { background: linear-gradient(135deg,#cc1f33,#ff4466); color:#fff; }
        .card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 1.4rem 1.5rem; margin-bottom: 1.1rem;
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
        .chip-admin { border-color: var(--gold) !important; color: var(--gold) !important; }
        .chip-score { color: var(--cyan); font-weight: 700; font-size: 0.72rem; }
        .game-table { width: 100%; border-collapse: collapse; }
        .game-table th { background: var(--surface2); border: 1px solid var(--border); color: var(--cyan); font-size: 0.74rem; padding: 0.5rem 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; }
        .game-table td { border: 1px solid var(--border); padding: 0.5rem 0.6rem; font-size: 0.92rem; }
        .game-table input[type=text] { border: none; background: transparent; padding: 0.25rem 0.3rem; border-radius: 0; }
        .game-table input[type=text]:focus { background: var(--surface2); border-radius: 4px; }
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
        .admin-badge { background: linear-gradient(135deg,#aa8800,#ffd700); color:#000; font-size:0.65rem; font-weight:800; padding:0.15rem 0.5rem; border-radius:999px; text-transform:uppercase; letter-spacing:0.06em; }
        @media(max-width:500px){ .answer-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className={`notif${notifVisible ? " show" : ""}`}>{notification}</div>

      {screen === "join" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem" }}>
          <h1 style={{
            textAlign: "center", fontSize: "clamp(1.6rem,5vw,2.4rem)", fontWeight: 900,
            letterSpacing: "0.03em", marginBottom: "0.3rem",
            background: "linear-gradient(90deg,#b44dff,#00e5ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
          }}>Name, Place, Thing, Animal</h1>
          <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            Real-time multiplayer word game
          </p>

          <svg width="320" height="200" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
            <ellipse cx="80" cy="110" rx="60" ry="40" fill="#b44dff" opacity="0.08"/>
            <ellipse cx="240" cy="90" rx="60" ry="40" fill="#00e5ff" opacity="0.08"/>
            <ellipse cx="160" cy="150" rx="50" ry="30" fill="#00ff88" opacity="0.06"/>
            <text x="18" y="28" fontSize="14" fill="#b44dff" opacity="0.9">✦</text>
            <text x="290" y="40" fontSize="12" fill="#00e5ff" opacity="0.9">✦</text>
            <text x="8" y="160" fontSize="10" fill="#00ff88" opacity="0.8">★</text>
            <text x="300" y="170" fontSize="10" fill="#b44dff" opacity="0.8">★</text>
            <text x="155" y="18" fontSize="8" fill="#00e5ff" opacity="0.7">✦</text>
            <text x="260" y="185" fontSize="9" fill="#00ff88" opacity="0.7">✦</text>
            <rect x="8" y="42" width="120" height="72" rx="14" fill="#1a1038" stroke="#b44dff" strokeWidth="2.5"/>
            <circle cx="38" cy="68" r="10" fill="none" stroke="#b44dff" strokeWidth="2"/>
            <path d="M22 98 Q38 84 54 98" fill="none" stroke="#b44dff" strokeWidth="2" strokeLinecap="round"/>
            <text x="60" y="72" fontSize="15" fontWeight="800" fill="#b44dff" fontFamily="system-ui">NAME</text>
            <text x="60" y="90" fontSize="10" fill="#8888bb" fontFamily="system-ui">👤 People</text>
            <rect x="192" y="42" width="120" height="72" rx="14" fill="#001a20" stroke="#00e5ff" strokeWidth="2.5"/>
            <circle cx="222" cy="66" r="10" fill="none" stroke="#00e5ff" strokeWidth="2"/>
            <path d="M222 76 L222 93" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="222" cy="66" r="4" fill="#00e5ff"/>
            <text x="240" y="72" fontSize="15" fontWeight="800" fill="#00e5ff" fontFamily="system-ui">PLACE</text>
            <text x="240" y="90" fontSize="10" fill="#8888bb" fontFamily="system-ui">🗺️ Cities</text>
            <rect x="8" y="126" width="120" height="66" rx="14" fill="#001a10" stroke="#00ff88" strokeWidth="2.5"/>
            <circle cx="33" cy="148" r="7" fill="none" stroke="#00ff88" strokeWidth="2"/>
            <circle cx="24" cy="141" r="3.5" fill="#00ff88" opacity="0.7"/>
            <circle cx="42" cy="141" r="3.5" fill="#00ff88" opacity="0.7"/>
            <circle cx="34" cy="139" r="3" fill="#00ff88" opacity="0.7"/>
            <text x="50" y="152" fontSize="14" fontWeight="800" fill="#00ff88" fontFamily="system-ui">ANIMAL</text>
            <text x="50" y="168" fontSize="10" fill="#8888bb" fontFamily="system-ui">🐾 Creatures</text>
            <rect x="192" y="126" width="120" height="66" rx="14" fill="#200010" stroke="#ff77cc" strokeWidth="2.5"/>
            <circle cx="222" cy="148" r="9" fill="none" stroke="#ff77cc" strokeWidth="2"/>
            <path d="M218 157 L226 157 M219 161 L225 161" stroke="#ff77cc" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M222 139 L222 135" stroke="#ff77cc" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M215 142 L212 139" stroke="#ff77cc" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M229 142 L232 139" stroke="#ff77cc" strokeWidth="1.5" strokeLinecap="round"/>
            <text x="240" y="152" fontSize="14" fontWeight="800" fill="#ff77cc" fontFamily="system-ui">THING</text>
            <text x="240" y="168" fontSize="10" fill="#8888bb" fontFamily="system-ui">💡 Objects</text>
            <rect x="134" y="78" width="52" height="52" rx="12" fill="#13132b" stroke="#b44dff" strokeWidth="2.5" strokeDasharray="5 3"/>
            <text x="160" y="112" fontSize="32" fontWeight="900" textAnchor="middle" fill="url(#letter-grad)" fontFamily="system-ui">A</text>
            <defs>
              <linearGradient id="letter-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b44dff"/>
                <stop offset="100%" stopColor="#00e5ff"/>
              </linearGradient>
            </defs>
          </svg>

          <div className="card" style={{ boxShadow: "0 0 24px #7a1fcc66", width: "100%", maxWidth: 420 }}>
            <div className="card-title">Join the Lobby</div>
            <div style={{ display: "flex", gap: "0.7rem" }}>
              <input type="text" placeholder="Enter your name..." maxLength={20}
                value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && joinGame()} style={{ flex: 1 }}
                disabled={joinStatus === "waiting"}
              />
              <button className="btn-primary" onClick={joinGame} disabled={joinStatus === "waiting"}>
                {joinStatus === "waiting" ? "Waiting..." : "Join"}
              </button>
            </div>
            
            {joinStatus === "rejected" && (
              <p style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: "0.75rem", fontWeight: 700 }}>
                ❌ Access Denied: The Admin rejected your request.
              </p>
            )}
            
            <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
              💡 The first player to join becomes the <span style={{ color: "var(--gold)", fontWeight: 700 }}>Admin</span> and can score each round.
            </p>
          </div>
        </div>
      )}

      {screen === "lobby" && (
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 1rem 3rem" }}>

          <h1 style={{
            textAlign: "center", fontSize: "clamp(1.2rem,4vw,1.8rem)", fontWeight: 900,
            letterSpacing: "0.03em", padding: "1.2rem 1rem 0.3rem",
            background: "linear-gradient(90deg,#b44dff,#00e5ff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
          }}>Name, Place, Thing, Animal</h1>
          <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            Real-time multiplayer word game
          </p>

          {isAdmin && pendingRequests.length > 0 && (
            <div className="card" style={{ border: "1px solid var(--gold)", boxShadow: "0 0 16px #aa880044" }}>
              <div className="card-title" style={{ color: "var(--gold)", margin: 0, marginBottom: "0.8rem" }}>
                🔔 Pending Join Requests
              </div>
              {pendingRequests.map(req => (
                <div key={req.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)", padding: "0.8rem 1rem", borderRadius: "8px", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem" }}><strong style={{ color: "var(--cyan)" }}>{req.username}</strong> wants to join.</span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-green" style={{ padding: "0.4rem 0.8rem" }} onClick={() => handleJoinResponse(req.requestId, "accept")}>Accept</button>
                    <button className="btn-red" style={{ padding: "0.4rem 0.8rem" }} onClick={() => handleJoinResponse(req.requestId, "reject")}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
              <div className="card-title" style={{ margin: 0 }}>Players</div>
              <span style={{
                background: countdownActive ? "#3a1a1a" : roundActive ? "#1a3a1a" : "var(--surface2)",
                color: countdownActive ? "var(--red)" : roundActive ? "var(--green)" : "var(--text-dim)",
                border: `1px solid ${countdownActive ? "var(--red)" : roundActive ? "var(--green)" : "var(--border)"}`,
                borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700,
                padding: "0.2rem 0.6rem", textTransform: "uppercase"
              }}>
                {countdownActive ? "Countdown!" : roundActive ? "Round Active" : lockedEntries ? "Admin Scoring" : gameStarted ? "Between Rounds" : "Waiting"}
              </span>
              {isAdmin && <span className="admin-badge">👑 You are Admin</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
              {players.map(p => (
                <div key={p.id} className={`chip${p.id === myId ? " chip-me" : ""}${p.id === adminId ? " chip-admin" : ""}`}>
                  {p.id === adminId ? "👑 " : p.id === myId ? "👤 " : ""}{p.name}
                  {p.id === adminId && <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>admin</span>}
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
                  {roundNumber > 0 ? `Round ${roundNumber}` : 'Waiting for Admin to control round...'}
                  {roundActive && !countdownActive && " — Fill in your answers!"}
                  {lockedEntries && !roundActive && (isAdmin ? " — Review & score below" : " — Waiting for admin to score")}
                </div>
              </div>
              
              {isAdmin ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <button className="btn-cyan" onClick={guessAlphabet} disabled={roundActive || countdownActive}>
                    🎲 Guess Alphabet
                  </button>
                  <button className="btn-gold" onClick={showLeaderboard} disabled={roundActive || countdownActive}>
                    🏆 Final Leaderboard
                  </button>
                  <button className="btn-red" onClick={resetGame} style={{ marginTop: "0.25rem" }}>
                    🔄 Reset Room
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <span style={{ color: "var(--text-dim)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    Admin controls the game flow.
                  </span>
                </div>
              )}
              
            </div>

            {countdownActive && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ color: "var(--red)", fontWeight: 700, textAlign: "center", fontSize: "1rem", marginBottom: "0.3rem" }}>
                  ⏱ Round ends in {countdownSec}s — your answers will be saved automatically!
                </div>
                <div className="countdown-wrap">
                  <div className="countdown-bar" style={{ width: `${countdownPct}%` }} />
                </div>
              </div>
            )}
          </div>
                          {leaderboard !== null ? (
            <div className="card" style={{ border: "1px solid var(--gold)", boxShadow: "0 0 30px #aa880044" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                
                <div className="card-title" style={{ margin: 0 }}>🏆 Final Leaderboard</div>
                {isAdmin && (
                  <button className="btn-cyan" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }} onClick={() => setLeaderboard(null)}>
                    ⬅️ Back to Board
                  </button>
                )}
              </div>
              {leaderboard!.map((p, i) => (
                <div key={p.id} className={`lb-item${p.id === myId ? " lb-me" : ""}`}>
                  <div style={{
                    fontSize: "1.5rem", fontWeight: 900, minWidth: "2rem", textAlign: "center",
                    color: i === 0 ? "var(--gold)" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "var(--text-dim)"
                  }}>
                    {["🥇","🥈","🥉"][i] || `#${i+1}`}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600 }}>
                    {p.name}{p.id === myId && <span style={{ color: "var(--purple)", fontSize: "0.78rem" }}> (you)</span>}
                    {p.id === adminId && <span style={{ color: "var(--gold)", fontSize: "0.75rem" }}> 👑</span>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--cyan)" }}>{p.score} pts</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-title">Your Answers — Letter: {currentLetter || "?"}</div>
                <table className="game-table">
                  <thead>
                    <tr><th>Name</th><th>Place</th><th>Thing</th><th>Animal</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><input type="text" placeholder="Name..." maxLength={50} value={ansName}   onChange={e => updateAnsName(e.target.value)}   disabled={inputsLocked} /></td>
                      <td><input type="text" placeholder="Place..." maxLength={50} value={ansPlace}  onChange={e => updateAnsPlace(e.target.value)}  disabled={inputsLocked} /></td>
                      <td><input type="text" placeholder="Thing..." maxLength={50} value={ansThing}  onChange={e => updateAnsThing(e.target.value)}  disabled={inputsLocked} /></td>
                      <td><input type="text" placeholder="Animal..." maxLength={50} value={ansAnimal} onChange={e => updateAnsAnimal(e.target.value) } disabled={inputsLocked} /></td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  <button className="btn-green" onClick={finishRow} disabled={!canFinish}>
                    {hasFinished ? "✅ Submitted" : countdownActive ? "⚡ Submit Now" : "✅ Finish Row"}
                  </button>
                  {hasFinished && !lockedEntries && (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>Waiting for round to end...</span>
                  )}
                  {countdownActive && !hasFinished && (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Your answers save automatically when time runs out</span>
                  )}
                  {lockedEntries && (
                    <span style={{ color: "var(--red)", fontSize: "0.82rem", fontWeight: 700 }}>🔒 Round locked</span>
                  )}
                </div>
              </div>

              {lockedEntries && (
                <div className="card" style={{ border: isAdmin ? "1px solid var(--gold)" : "1px solid var(--border)", boxShadow: isAdmin ? "0 0 20px #aa880044" : "0 0 16px #ffffff11", overflowX: "auto" }}>
                  

                  <div className="card-title" style={{ color: isAdmin ? "var(--gold)" : "var(--cyan)" }}>
                    {isAdmin ? "👑 Admin Panel — Review Answers Dashboard" : "🔍 Review Dashboard — Waiting for Admin"}
                  </div>
                  <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "1rem" }}>
                    {isAdmin ? "Review answers and directly key points into the scoreboard layout." : "Review what everyone wrote while the Admin scores the round."}
                  </p>

                  <table className="game-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Name</th>
                        <th>Place</th>
                        <th>Thing</th>
                        <th>Animal</th>
                        <th>Score Panel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lockedEntries.map(({ playerId, playerName, entry }) => {
                        const isMe = playerId === myId;
                        return (
                          <tr key={playerId} style={{ background: isMe ? "var(--surface2)" : "transparent" }}>
                            <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                              {playerName} {entry.finishedFirst && <span style={{ color: "var(--green)" }}>⚡</span>}
                            </td>
                            <td style={{ color: entry.name ? "var(--text)" : "var(--text-dim)", fontStyle: entry.name ? "normal" : "italic" }}>
                              {entry.name || "—"}
                            </td>
                            <td style={{ color: entry.place ? "var(--text)" : "var(--text-dim)", fontStyle: entry.place ? "normal" : "italic" }}>
                              {entry.place || "—"}
                            </td>
                            <td style={{ color: entry.thing ? "var(--text)" : "var(--text-dim)", fontStyle: entry.thing ? "normal" : "italic" }}>
                              {entry.thing || "—"}
                            </td>
                            <td style={{ color: entry.animal ? "var(--text)" : "var(--text-dim)", fontStyle: entry.animal ? "normal" : "italic" }}>
                              {entry.animal || "—"}
                            </td>
                                                                                <td>
                              {isAdmin ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                  <input type="number" min={0} max={999} step={0.5}
                                    value={manualScores[playerId] ?? "0"}
                                    onChange={e => setManualScores(prev => ({ ...prev, [playerId]: e.target.value }))}
                                    disabled={scoresSubmitted}
                                  />
                                  <span style={{ color: "var(--cyan)", fontSize: "0.78rem" }}>pts</span>
                                </div>
                              ) : (
                                <span style={{ color: scoresSubmitted ? "var(--green)" : "var(--text-dim)", fontSize: "0.85rem", fontStyle: "italic", fontWeight: scoresSubmitted ? 700 : "normal" }}>
                                  {scoresSubmitted ? "✅ Scored!" : "Pending..."}
                                </span>
                              )}
                            </td>
                            
                          
                            
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {isAdmin && (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1.25rem" }}>
                      <button className="btn-purple" onClick={applyScores} disabled={scoresSubmitted}>
                        {scoresSubmitted ? "✅ Scores Applied" : "💾 Apply Scores"}
                      </button>
                      {scoresSubmitted && (
                        <button className="btn-cyan" style={{ fontSize: "0.8rem" }} onClick={() => setScoresSubmitted(false)}>
                          ✏️ Edit Scores
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
      
