import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer } from "http";
import type { Express } from "express";

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

interface GameState {
  players: Map<string, Player>;
  adminId: string | null;
  currentLetter: string | null;
  roundActive: boolean;
  countdownActive: boolean;
  countdownEndsAt: number | null;
  roundEntries: Map<string, RoundEntry>;
  roundNumber: number;
  firstFinisher: string | null;
  gameStarted: boolean;
  acceptEntriesUntil: number;
  recentLetters: string[];
  pendingRequests: Map<string, { socketId: string; name: string }>;
}

const ALPHABET = "ABCDEFGHIJKLMNOPRSTW";

const state: GameState = {
  players: new Map(),
  adminId: null,
  currentLetter: null,
  roundActive: false,
  countdownActive: false,
  countdownEndsAt: null,
  roundEntries: new Map(),
  roundNumber: 0,
  firstFinisher: null,
  gameStarted: false,
  acceptEntriesUntil: 0,
  recentLetters: [],
  pendingRequests: new Map(),
};

function getPublicPlayers() {
  return Array.from(state.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
  }));
}

let countdownTimer: ReturnType<typeof setTimeout> | null = null;
let submitRequestTimer: ReturnType<typeof setTimeout> | null = null;

export function setupSocketIO(app: Express): ReturnType<typeof createServer> {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    socket.on("join", (name: string) => {
      if (!name || typeof name !== "string") return;
      const playerName = name.trim().slice(0, 20);
      if (!playerName) return;

      const isFirstPlayer = state.players.size === 0;

      if (isFirstPlayer || !state.adminId) {
        state.adminId = socket.id;
        state.players.set(socket.id, { id: socket.id, name: playerName, score: 0 });

        const remainingMs =
          state.countdownActive && state.countdownEndsAt
            ? Math.max(0, state.countdownEndsAt - Date.now())
            : null;

        socket.emit("joined", {
          playerId: socket.id,
          players: getPublicPlayers(),
          currentLetter: state.currentLetter,
          roundActive: state.roundActive,
          countdownActive: state.countdownActive,
          remainingMs,
          roundNumber: state.roundNumber,
          gameStarted: state.gameStarted,
          isAdmin: socket.id === state.adminId,
          adminId: state.adminId,
        });

        io.emit("players_update", getPublicPlayers());
        io.emit("admin_update", { adminId: state.adminId });
      } else {
        const requestId = Math.random().toString(36).substring(2, 9);
        state.pendingRequests.set(requestId, { socketId: socket.id, name: playerName });
        
        io.to(state.adminId).emit("pending_join_request", {
          requestId,
          username: playerName
        });
        
        socket.emit("waiting_for_admin");
      }
    });

    socket.on("admin_join_response", (data: { requestId: string; decision: string }) => {
      if (socket.id !== state.adminId) return;
      
      const request = state.pendingRequests.get(data.requestId);
      if (!request) return;

      const targetSocket = io.sockets.sockets.get(request.socketId);
      
      if (targetSocket) {
        if (data.decision === "accept") {
          state.players.set(request.socketId, { id: request.socketId, name: request.name, score: 0 });
          
          const remainingMs = state.countdownActive && state.countdownEndsAt
            ? Math.max(0, state.countdownEndsAt - Date.now())
            : null;

          targetSocket.emit("joined", {
            playerId: request.socketId,
            players: getPublicPlayers(),
            currentLetter: state.currentLetter,
            roundActive: state.roundActive,
            countdownActive: state.countdownActive,
            remainingMs,
            roundNumber: state.roundNumber,
            gameStarted: state.gameStarted,
            isAdmin: false,
            adminId: state.adminId,
          });

          io.emit("players_update", getPublicPlayers());
        } else {
          targetSocket.emit("join_denied");
        }
      }
      state.pendingRequests.delete(data.requestId);
    });

    socket.on("guess_alphabet", () => {
      if (!state.players.has(socket.id)) return;
      if (state.roundActive || state.countdownActive) return;

      const alphabetArray = ALPHABET.split("");
      const available = alphabetArray.filter(letter => !state.recentLetters.includes(letter));
      
      const letter = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)]
        : alphabetArray[Math.floor(Math.random() * alphabetArray.length)];

      state.recentLetters.push(letter);
      if (state.recentLetters.length >= 15) {
        state.recentLetters.shift();
      }

      state.currentLetter = letter;
      state.roundActive = true;
      state.roundEntries.clear();
      state.firstFinisher = null;
      state.roundNumber += 1;
      state.gameStarted = true;

      io.emit("round_started", { letter, roundNumber: state.roundNumber });
    });

    socket.on("finish_row", (entry: RoundEntry) => {
      if (!state.players.has(socket.id)) return;
      if (!state.roundActive || state.countdownActive) return;

      const cleanEntry = sanitise(entry);

      if (!state.firstFinisher) {
        state.firstFinisher = socket.id;
        cleanEntry.finishedFirst = true;
      }

      state.roundEntries.set(socket.id, cleanEntry);

      state.countdownActive = true;
      const endsAt = Date.now() + 7000;
      state.countdownEndsAt = endsAt;

      io.emit("request_submit_now");

      io.emit("countdown_started", {
        remainingMs: 7000,
        triggeredBy: state.players.get(socket.id)?.name || "Someone",
      });

      submitRequestTimer = setTimeout(() => {
        io.emit("request_submit_now");
      }, 5500);

      countdownTimer = setTimeout(() => {
        lockRound(io);
      }, 7500);
    });

    socket.on("submit_entry", (entry: RoundEntry) => {
      if (!state.players.has(socket.id)) return;
      const withinGrace = Date.now() <= state.acceptEntriesUntil;
      if (!state.countdownActive && !withinGrace) return;

      const cleanEntry = sanitise(entry);
      cleanEntry.finishedFirst = state.roundEntries.get(socket.id)?.finishedFirst || false;
      state.roundEntries.set(socket.id, cleanEntry);
    });

    socket.on("submit_scores", (scores: Array<{ playerId: string; score: number }>) => {
      if (!state.players.has(socket.id)) return;
      if (socket.id !== state.adminId) return;
      if (!Array.isArray(scores)) return;

      for (const { playerId, score } of scores) {
        const player = state.players.get(playerId);
        if (player && typeof score === "number" && score >= 0) {
          player.score += score;
        }
      }

      io.emit("scores_applied", { players: getPublicPlayers() });
    });

    socket.on("reset_game", () => {
      if (socket.id !== state.adminId) return;

      if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
      if (submitRequestTimer) { clearTimeout(submitRequestTimer); submitRequestTimer = null; }

      const adminPlayer = state.players.get(state.adminId);
      
      state.players.clear();
      state.roundEntries.clear();
      state.pendingRequests.clear();
      state.recentLetters = [];
      state.currentLetter = null;
      state.roundActive = false;
      state.countdownActive = false;
      state.countdownEndsAt = null;
      state.roundNumber = 0;
      state.firstFinisher = null;
      state.gameStarted = false;
      state.acceptEntriesUntil = 0;

      if (adminPlayer) {
        adminPlayer.score = 0;
        state.players.set(state.adminId, adminPlayer);
      }

      io.emit("room_reset", {
        adminId: state.adminId,
        players: getPublicPlayers()
      });
    });

    socket.on("disconnect", () => {
      state.players.delete(socket.id);
      state.roundEntries.delete(socket.id);

      if (socket.id === state.adminId) {
        const next = state.players.keys().next().value;
        state.adminId = next || null;
        io.emit("admin_update", { adminId: state.adminId });
      }

      io.emit("players_update", getPublicPlayers());
    });
  });

  return httpServer;
}

function sanitise(entry: RoundEntry): RoundEntry {
  return {
    name:   (entry.name   || "").trim().slice(0, 50),
    place:  (entry.place  || "").trim().slice(0, 50),
    thing:  (entry.thing  || "").trim().slice(0, 50),
    animal: (entry.animal || "").trim().slice(0, 50),
    finishedFirst: false,
  };
}

function lockRound(io: SocketIOServer) {
  if (submitRequestTimer) { clearTimeout(submitRequestTimer); submitRequestTimer = null; }

  state.roundActive = false;
  state.countdownActive = false;
  state.countdownEndsAt = null;
  
  state.acceptEntriesUntil = Date.now() + 1500;

  const entriesData = [];
  for (const [playerId, player] of state.players) {
    const entry = state.roundEntries.get(playerId) || {
      name: "", place: "", thing: "", animal: "",
    };
    entriesData.push({ playerId, playerName: player.name, entry });
  }

  io.emit("round_locked", { entries: entriesData });
}
