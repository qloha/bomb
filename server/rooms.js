const { v4: uuidv4 } = require('uuid');
const { RateLimiter } = require('./rateLimiter');

class Room {
  constructor(name) {
    this.name = name;
    this.clients = new Map(); // id -> client {id, username, ws}
    this.history = [];
    this.historyLimit = 200;
  }

  addClient(client) {
    this.clients.set(client.id, client);
    console.debug && console.debug(`[room:${this.name}] addClient`, client.id, client.username, `now ${this.clients.size}`);
    this.broadcastSystem(`${client.username} joined (${this.clients.size} online)`);
    this.sendPresence();
  }

  removeClient(client) {
    this.clients.delete(client.id);
    console.debug && console.debug(`[room:${this.name}] removeClient`, client.id, client.username, `now ${this.clients.size}`);
    this.broadcastSystem(`${client.username} left (${this.clients.size} online)`);
    this.sendPresence();
  }

  pushHistory(msg) {
    this.history.push(msg);
    if (this.history.length > this.historyLimit) this.history.shift();
  }

  broadcast(obj) {
    // log lightweight info to server console for debugging
    try { console.debug && console.debug(`[room:${this.name}] broadcast`, obj.type, obj.username || '', (obj.text || '').slice(0,80)); } catch(e){}
    const data = JSON.stringify(obj);
    for (const [, client] of this.clients) {
      try {
        client.ws.send(data);
      } catch (e) {
        // ignore individual client errors
      }
    }
  }

  broadcastSystem(text) {
    const msg = { type: 'system', text, ts: Date.now() };
    this.broadcast(msg);
  }

  sendPresence() {
    // include remoteAddress for each user so clients receive IPs when users are present
    const users = Array.from(this.clients.values()).map(c => ({ id: c.id, username: c.username, remoteAddress: c.remoteAddress }));
    this.broadcast({ type: 'presence', room: this.name, users });
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.rateLimiter = new RateLimiter({ tokens: 20, refillIntervalMs: 10000 });
  }

  getRoom(name) {
    if (!this.rooms.has(name)) this.rooms.set(name, new Room(name));
    return this.rooms.get(name);
  }

  addClient(ws, roomName, username, req) {
    const room = this.getRoom(roomName);
    const id = uuidv4();
    ws._clientId = id;
    const client = { id, username: String(username).slice(0, 64), ws, remoteAddress: req.socket.remoteAddress };

    // send joined ack with history and the client's remote address
    const joined = { type: 'joined', room: roomName, me: { id, username: client.username, remoteAddress: client.remoteAddress }, history: room.history };
    try { ws.send(JSON.stringify(joined)); } catch (e) {}

    // add to room
    room.addClient(client);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return ws.send(JSON.stringify({ type: 'error', reason: 'invalid_json' })); }

      if (msg.type === 'message') {
        const text = String(msg.text || '').slice(0, 2000);
        if (!text) return;

        // rate limit
        const allowed = this.rateLimiter.allow(id);
        if (!allowed) {
          ws.send(JSON.stringify({ type: 'error', reason: 'rate_limited' }));
          return;
        }

        const out = { type: 'message', id: uuidv4(), room: roomName, username: client.username, text, ts: Date.now() };
        room.pushHistory(out);
        room.broadcast(out);
      }
    });

    ws.on('close', () => {
      room.removeClient(client);
      // cleanup empty rooms optionally
      if (room.clients.size === 0) {
        this.rooms.delete(roomName);
      }
    });

    ws.on('error', () => {
      // ignore
    });
  }
}

module.exports = { RoomManager };
