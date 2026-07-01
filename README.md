---
title: Name Place Thing Game
emoji: 🎮
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# 🎮 Real-Time Multiplayer: Name, Place, Thing, Animal
# 🎮 Real-Time Multiplayer: Name, Place, Thing, Animal

A modern, web-based, real-time multiplayer adaptation of the classic childhood word game. Built using a decoupled React-Node client-server architecture, this application supports strict role-based state management across multiple concurrent clients using persistent WebSockets.

🔗 **Live Demo:** [Play the Game on Hugging Face Spaces](https://sbd99-sbdgame.hf.space/) 

## 🚀 Key Features

* **Real-Time Synchronization:** Leverages full-duplex WebSocket connections to synchronize lobby data, random letter distributions, and state updates across all clients instantly.
* **The 7-Second Panic Mechanic:** When any player finishes typing and registers their row, an automated 7-second countdown bar propagates to all other active screens, forcing immediate submission.
* **15-Round Letter Memory:** Built-in backend state tracking filters out recently generated characters. A letter cannot be repeated within a window of 15 consecutive rounds, keeping match cycles fresh and unpredictable.
* **Lobby Gatekeeper Handshake:** Implements a defensive entrance flow where incoming players are held in a secure queue. The room Admin receives an instantaneous knocking notification to either accept or reject the candidate before access is granted.
* **Admin Verification Grid:** Consolidated tabular dashboard layout displaying all active submissions side-by-side in real-time when a round locks down. This allows the host to evaluate answers across multiple fields cleanly without vertical page-scrolling fatigue.

## 👑 Role-Based Game Governance (Admin Roles)

To prevent chaotic match flows and griefing in public rooms, the server enforces a strict authority hierarchy:
* **Lobby Creator (Host/Admin):** The first player to initialize the workspace session is granted global privileges. 
* **Exclusive Controls:** Only the Admin can fire the **"Guess Alphabet"** command, edit and apply scores, view the final leaderboard, or execute a **"Reset Room"** sweep.
* **Persistent Session Hosting:** Running a room purge will reset round counts to zero and clear out score memory maps for everyone, but securely retains the current Admin entity in the room state without booting them to the login screen.

## ☁️ Why Hugging Face Spaces for Hosting?

While traditional hosting platforms impose strict limitations on network operations, this project runs on a **Hugging Face Docker Space** for these structural reasons:

1. **Persistent WebSocket support:** Hugging Face custom spaces permit the running TCP pathways required by `Socket.io` to cycle packets without cutting off long-standing idle connections.
2. **Fixed Port Strategy:** Binds directly to container port `7860` to align seamlessly with the platform's automated entry gateway checks, avoiding startup timing errors.
3. **Decoupled Architecture:** Serves compressed asset distributions cleanly while handling state variations smoothly on shared, low-overhead container spaces.

## 🛠️ Tech Stack

* **Backend Environment:** Node.js, Express Framework, tsx runtime compiler
* **Real-Time Layer:** Socket.io (WebSockets)
* **Frontend Interface:** React.js, TypeScript (TSX), Custom Cyberpunk CSS
* **Deployment Tooling:** Monorepo Workspace Engine (pnpm), Docker, Hugging Face Infrastructure

## ⚙️ Local Installation & Setup

Prerequisites: Node.js and pnpm installed locally.

1. Clone the repository:
   ```bash
   git clone [https://github.com/megaop98/name-place-thing-game.git](https://github.com/megaop98/name-place-thing-game.git)
   cd name-place-thing-game
1. Clone the repository:
   ```bash
   git clone [https://github.com/megaop98/name-place-thing-game.git](https://github.com/megaop98/name-place-thing-game.git)
   cd name-place-thing-game
