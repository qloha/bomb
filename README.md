# Bomb Chat (minimal)

This is a minimal WebSocket chat server inspired by hack.chat. It serves a static client and provides simple room and message handling.

Quick start:

1. Install deps: npm install
2. Start: node server/index.js
3. Open http://localhost:3000 in your browser

Notes:
- This is intentionally minimal (in-memory rooms and history). For production use TLS and a pub/sub layer (Redis) for scaling.

