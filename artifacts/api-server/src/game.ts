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
  currentLetter: string | null;
  roundActive: boolean;
  countdownActive: boolean;
  countdownEndsAt: number | null;
  roundEntries: Map<string, RoundEntry>;
  roundNumber: number;
  firstFinisher: string | null;
  gameStarted: boolean;
}

const ALPHABET = "ABCDEFGHIJKLMNOPRSTW";

const state: GameState = {
  players: new Map(),
  currentLetter: null,
  roundActive: false,
  countdownActive: false,
  countdownEndsAt: null,
  roundEntries: new Map(),
  roundNumber: 0,
  firstFinisher: null,
  gameStarted: false,
};

function getPublicPlayers(): Array<{ id: string; name: string; score: number }> {
  return Array.from(state.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
  }));
}

let countdownTimer: ReturnType<typeof setTimeout> | null = null;

export function setupSocketIO(app: Express): ReturnType<typeof createServer> {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", (name: string) => {
      if (!name || typeof name !== "string") return;
      const playerName = name.trim().slice(0, 20);
      if (!playerName) return;

      state.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        score: 0,
      });

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
      });

      io.emit("players_update", getPublicPlayers());
    });

    socket.on("guess_alphabet", () => {
      if (!state.players.has(socket.id)) return;
      if (state.roundActive || state.countdownActive) return;

      const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      state.currentLetter = letter;
      state.roundActive = true;
      state.roundEntries.clear();
      state.firstFinisher = null;
      state.roundNumber += 1;
      state.gameStarted = true;

      io.emit("round_started", {
        letter,
        roundNumber: state.roundNumber,
      });
    });

    socket.on("finish_row", (entry: RoundEntry) => {
      if (!state.players.has(socket.id)) return;
      if (!state.roundActive || state.countdownActive) return;

      const cleanEntry: RoundEntry = {
        name: (entry.name || "").trim().slice(0, 50),
        place: (entry.place || "").trim().slice(0, 50),
        thing: (entry.thing || "").trim().slice(0, 50),
        animal: (entry.animal || "").trim().slice(0, 50),
        finishedFirst: false,
      };

      if (!state.firstFinisher) {
        state.firstFinisher = socket.id;
        cleanEntry.finishedFirst = true;
      }

      state.roundEntries.set(socket.id, cleanEntry);

      if (!state.countdownActive) {
        state.countdownActive = true;
        const endsAt = Date.now() + 7000;
        state.countdownEndsAt = endsAt;

        io.emit("countdown_started", {
          remainingMs: 7000,
          triggeredBy: state.players.get(socket.id)?.name || "Someone",
        });

        countdownTimer = setTimeout(() => {
          lockRound(io);
        }, 7000);
      }
    });

    socket.on("submit_entry", (entry: RoundEntry) => {
      if (!state.players.has(socket.id)) return;
      if (!state.countdownActive) return;

      const cleanEntry: RoundEntry = {
        name: (entry.name || "").trim().slice(0, 50),
        place: (entry.place || "").trim().slice(0, 50),
        thing: (entry.thing || "").trim().slice(0, 50),
        animal: (entry.animal || "").trim().slice(0, 50),
        finishedFirst: state.roundEntries.get(socket.id)?.finishedFirst || false,
      };

      state.roundEntries.set(socket.id, cleanEntry);
    });

    // Manual scoring: any player can submit scores for the round
    socket.on("submit_scores", (scores: Array<{ playerId: string; score: number }>) => {
      if (!state.players.has(socket.id)) return;
      if (!Array.isArray(scores)) return;

      for (const { playerId, score } of scores) {
        const player = state.players.get(playerId);
        if (player && typeof score === "number" && score >= 0) {
          player.score += score;
        }
      }

      io.emit("scores_applied", {
        players: getPublicPlayers(),
      });
    });

    socket.on("final_leaderboard", () => {
      if (!state.players.has(socket.id)) return;
      const sorted = getPublicPlayers().sort((a, b) => b.score - a.score);
      io.emit("show_leaderboard", sorted);
    });

    socket.on("disconnect", () => {
      state.players.delete(socket.id);
      state.roundEntries.delete(socket.id);
      io.emit("players_update", getPublicPlayers());
      console.log("Socket disconnected:", socket.id);
    });
  });

  return httpServer;
}

function lockRound(io: SocketIOServer) {
  state.roundActive = false;
  state.countdownActive = false;
  state.countdownEndsAt = null;

  // Collect all entries — answers are preserved, no auto-scoring
  const entriesData: Array<{
    playerId: string;
    playerName: string;
    entry: RoundEntry;
  }> = [];

  for (const [playerId, player] of state.players) {
    const entry = state.roundEntries.get(playerId) || {
      name: "",
      place: "",
      thing: "",
      animal: "",
    };
    entriesData.push({
      playerId,
      playerName: player.name,
      entry,
    });
  }

  io.emit("round_locked", {
    entries: entriesData,
  });
}
