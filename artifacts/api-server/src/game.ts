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

function calculateScores(): Map<string, number> {
  const roundScores = new Map<string, number>();
  const categories: (keyof Omit<RoundEntry, "finishedFirst">)[] = [
    "name",
    "place",
    "thing",
    "animal",
  ];

  for (const category of categories) {
    const wordCounts = new Map<string, string[]>();

    for (const [playerId, entry] of state.roundEntries) {
      const word = (entry[category] || "").trim().toLowerCase();
      if (!word) continue;
      if (!wordCounts.has(word)) wordCounts.set(word, []);
      wordCounts.get(word)!.push(playerId);
    }

    for (const [, playerIds] of wordCounts) {
      let pts = 0;
      if (playerIds.length === 1) pts = 10;
      else if (playerIds.length === 2) pts = 5;
      else pts = 2.5;

      for (const pid of playerIds) {
        roundScores.set(pid, (roundScores.get(pid) || 0) + pts);
      }
    }
  }

  return roundScores;
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

  const roundScores = calculateScores();
  const resultsData: Array<{
    playerId: string;
    playerName: string;
    entry: RoundEntry;
    roundScore: number;
    totalScore: number;
  }> = [];

  for (const [playerId, player] of state.players) {
    const entry = state.roundEntries.get(playerId) || {
      name: "",
      place: "",
      thing: "",
      animal: "",
    };
    const roundScore = roundScores.get(playerId) || 0;
    player.score += roundScore;

    resultsData.push({
      playerId,
      playerName: player.name,
      entry,
      roundScore,
      totalScore: player.score,
    });
  }

  io.emit("round_results", {
    results: resultsData,
    players: getPublicPlayers(),
  });
}
