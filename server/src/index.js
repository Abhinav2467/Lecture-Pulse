import http from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { createApp } from './app.js';
import { db } from './db.js';
import { attachSockets } from './sockets.js';
import { endStaleSessions } from './lib/sessionService.js';

const STALE_CHECK_MS = 10 * 60 * 1000;

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientOrigin } });
const sockets = attachSockets(io);

// Auto-end sessions with no activity for 3h (also catches ones left open across a restart).
endStaleSessions();
const staleTimer = setInterval(() => {
  const ended = endStaleSessions();
  if (ended > 0) console.log(`[cleanup] auto-ended ${ended} inactive session(s)`);
}, STALE_CHECK_MS);
staleTimer.unref();

server.listen(config.port, () => {
  console.log(`[server] Lecture Pulse listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

function shutdown() {
  clearInterval(staleTimer);
  sockets.stop();
  io.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
