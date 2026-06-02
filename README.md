---
title: Name Place Thing Game
emoji: 🎮
colorFrom: purple
colorTo: cyans
sdk: docker
app_port: 3000
pinned: false
---

# 🎮 Real-Time Multiplayer: Name, Place, Thing, Animal
... [Rest of your README content continues here] ...


# 🎮 Real-Time Multiplayer: Name, Place, Thing, Animal

A modern, web-based, real-time multiplayer adaptation of the classic childhood word game. Built using a decoupled client-server architecture, this application supports synchronized state management across multiple concurrent clients using WebSockets.

🔗 **Live Demo:** [Play the Game on Hugging Face Spaces](https://sbd99-sbdgame.hf.space/) 

## 🚀 Key Features

* **Real-Time Synchronization:** Leverages persistent WebSocket connections to synchronize the lobby state, random letter generation, and round timers across all active players instantly.
* **The 7-Second Panic Mechanic:** When any player completes their fields for a row and triggers the finish event, an automated 7-second countdown banner propagates to all other active screens, locking down input textareas upon expiration.
* **Automated Server-Side Scoring (Anti-Cheat):** Eliminates manual user-input vulnerabilities. Submissions are processed and evaluated directly on the server backend based on spelling and uniqueness metrics:
  * **Unique Word:** 10 Points
  * **Two Shared Matching Words:** 5 Points
  * **Three or More Shared Matching Words:** 2.5 Points
* **Dynamic Visual Layout:** Formatted with a dark cyberpunk-inspired theme featuring fluid CSS hover micro-interactions and auto-expanding input heights to preserve mobile responsiveness.

## 👑 Role-Based Game Governance (Admin Roles)

To prevent chaotic match flows and griefing in public lobbies, the server enforces a role-based permission system:
* **Lobby Creator (Host/Admin):** The first player to connect or initialize the room is automatically assigned the Admin role.
* **Exclusive Controls:** Only the designated Admin possesses the authorization to click the **"Guess Alphabet"** button to start a round, or the **"Final Leaderboard"** button to terminate the session. 
* Normal peers see a synchronized UI but cannot trigger these state transitions globally.

## ☁️ Why Hugging Face Spaces for Hosting?

While traditional options for Node.js applications present limitations on free tiers, this project uses **Hugging Face Spaces** running a custom **Docker container** for the following architectural benefits:

1. **Persistent WebSocket Support:** Unlike standard static hosting platforms, Hugging Face Docker spaces fully support the persistent, full-duplex TCP connections required by `Socket.io`.
2. **No Aggressive Cold Starts:** Free-tier cloud infrastructure often forces applications into a deep sleep after 15 minutes of inactivity, causing 30+ second delays for players joining a new lobby. Hugging Face maintains container availability more reliably.
3. **No Short-Term Expiration:** Avoids temporary URL deprecation cycles, providing a permanent home for the application configuration.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express Framework
* **Real-Time Protocol:** Socket.io (WebSockets)
* **Frontend:** Semantic HTML5, Vanilla JavaScript, Custom Responsive CSS3
* **Deployment:** Docker, Hugging Face Spaces

## ⚙️ Local Installation & Setup

Prerequisites: Node.js installed locally.

1. Clone the repository:
   ```bash
   git clone [https://github.com/megaop98/name-place-thing-game.git](https://github.com/megaop98/name-place-thing-game.git)
   cd name-place-thing-game
