const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const WebSocket = require('ws');
const url = require('url');
const { RoomManager } = require('./rooms');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(helmet());
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const rooms = new RoomManager();

wss.on('connection', (ws, req, clientInfo) => {
  // clientInfo supplied by our upgrade handler
  rooms.addClient(ws, clientInfo.room, clientInfo.username, req);
});

server.on('upgrade', (req, socket, head) => {
  // parse query for room and username
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const room = parsed.query.room || 'lobby';
  const username = parsed.query.username || `anon-${Math.floor(Math.random() * 10000)}`;

  // Basic origin check - allow all on LAN; you can restrict this in production
  // const origin = req.headers.origin;
  // if (origin && !allowedOrigins.includes(origin)) return socket.destroy();

  wss.handleUpgrade(req, socket, head, (ws) => {
    // attach client info and emit connection
    wss.emit('connection', ws, req, { room, username });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint ws://localhost:${PORT}/ws?room=ROOM&username=NAME`);
});

