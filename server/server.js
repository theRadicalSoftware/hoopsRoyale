import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as MSG from './protocol.js';
import {
    createRoom, joinRoom, leaveRoom, switchTeam, toggleReady,
    startGame, endGame, listPublicRooms, findPlayerRoom,
    relayFromHost, relayInputToHost, relayToRoom,
    handleDisconnect, broadcastToRoom, getRoomForSession, serializeRoom
} from './rooms.js';
import {
    enterPickupWorld, leavePickupWorld, updatePickupPosition,
    enterPickupZone, leavePickupZone, handlePickupDisconnect,
    cleanupAfkPlayers, refreshPickupHeartbeat, isInPickupWorld,
    forwardGameStateToSpectators, handlePickupGameOver,
    isActivePickupGameHost, getPickupWorldStatus,
    broadcastPickupChat
} from './pickup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '8080', 10);

// ─── Security: static file whitelist ───────────────────────
// Only serve index.html and the js/ directory — blocks access to
// .git/, server/ source, CLAUDE.md, config files, etc.
const INDEX_HTML_PATH = join(PROJECT_ROOT, 'index.html');
const JS_DIR_PREFIX  = join(PROJECT_ROOT, 'js') + '/';

// ─── MIME Types ─────────────────────────────────────────────
const MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2'
};

// ─── HTTP Server (static files) ─────────────────────────────
const httpServer = http.createServer(async (req, res) => {
    // Only serve GET requests
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
    }

    let urlPath = req.url.split('?')[0]; // strip query string
    if (urlPath === '/') urlPath = '/index.html';

    // Security: prevent directory traversal
    const filePath = join(PROJECT_ROOT, urlPath);
    if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Security: only serve game assets (index.html + js/ directory)
    if (filePath !== INDEX_HTML_PATH && !filePath.startsWith(JS_DIR_PREFIX)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    try {
        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// ─── WebSocket Server ───────────────────────────────────────
const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 32 * 1024   // 32 KB max message size
});

// Session tracking: sessionId → { ws, nickname, roomCode }
const sessions = new Map();

// ─── Security Limits ───────────────────────────────────────
const MAX_CONNECTIONS   = 100;  // total simultaneous WebSocket connections
const RATE_LIMIT_PER_SEC = 120; // max messages per connection per second

function send(ws, msg) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(msg));
    }
}

wss.on('connection', (ws) => {
    // Reject if server is full
    if (wss.clients.size > MAX_CONNECTIONS) {
        ws.close(1013, 'Server is full');
        return;
    }

    let sessionId = null;
    let msgCount = 0;
    let msgWindowStart = Date.now();

    ws.on('message', (raw) => {
        // Rate limiting: silently drop excess messages
        const now = Date.now();
        if (now - msgWindowStart > 1000) {
            msgCount = 0;
            msgWindowStart = now;
        }
        if (++msgCount > RATE_LIMIT_PER_SEC) return;

        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return; // ignore malformed messages
        }

        const { type } = msg;

        // ── HELLO — establish session ────────────────────
        if (type === MSG.HELLO) {
            const nickname = (msg.nickname || 'Player').slice(0, 20).trim() || 'Player';

            // Reconnect support: if they sent a previous sessionId, try to restore
            if (msg.sessionId && sessions.has(msg.sessionId)) {
                sessionId = msg.sessionId;
                const prev = sessions.get(sessionId);
                prev.ws = ws;
                prev.nickname = nickname;
                ws._sessionId = sessionId;

                // Rejoin their room if they were in one
                const room = getRoomForSession(sessionId);
                if (room) {
                    const player = room.players.get(sessionId);
                    if (player) player.ws = ws;
                }

                send(ws, { type: MSG.HELLO, sessionId, nickname, reconnected: true });
                return;
            }

            sessionId = MSG.generateSessionId();
            sessions.set(sessionId, { ws, nickname });
            ws._sessionId = sessionId;
            send(ws, { type: MSG.HELLO, sessionId, nickname });
            return;
        }

        // All subsequent messages require a valid session
        if (!sessionId) {
            send(ws, { type: MSG.ERROR, message: 'Send HELLO first.' });
            return;
        }

        // ── PING/PONG ───────────────────────────────────
        if (type === MSG.PING) {
            send(ws, { type: MSG.PONG, t: msg.t });
            refreshPickupHeartbeat(sessionId);
            return;
        }

        // ── LIST_ROOMS ──────────────────────────────────
        if (type === MSG.LIST_ROOMS) {
            send(ws, { type: MSG.LIST_ROOMS, rooms: listPublicRooms() });
            return;
        }

        // ── CREATE_ROOM ─────────────────────────────────
        if (type === MSG.CREATE_ROOM) {
            // Leave any existing room first
            leaveRoom(sessionId);

            const session = sessions.get(sessionId);
            const result = createRoom(sessionId, session.nickname, ws, {
                name: (msg.name || '').slice(0, 30),
                isPublic: msg.isPublic !== false,
                scoreTarget: msg.scoreTarget,
                mode: msg.mode
            });

            if (!result.ok) {
                send(ws, { type: MSG.ERROR, message: result.error });
                return;
            }

            send(ws, { type: MSG.CREATE_ROOM, code: result.code, room: result.room });
            return;
        }

        // ── JOIN_ROOM ───────────────────────────────────
        if (type === MSG.JOIN_ROOM) {
            // Leave any existing room first
            leaveRoom(sessionId);

            const session = sessions.get(sessionId);
            const result = joinRoom(sessionId, session.nickname, ws, msg.code);

            if (!result.ok) {
                send(ws, { type: MSG.ERROR, message: result.error });
                return;
            }

            send(ws, { type: MSG.JOIN_ROOM, ok: true, room: result.room });
            return;
        }

        // ── LEAVE_ROOM ──────────────────────────────────
        if (type === MSG.LEAVE_ROOM) {
            leaveRoom(sessionId);
            send(ws, { type: MSG.LEAVE_ROOM, ok: true });
            return;
        }

        // ── SWITCH_TEAM ─────────────────────────────────
        if (type === MSG.SWITCH_TEAM) {
            const result = switchTeam(sessionId);
            if (!result.ok && result.error) {
                send(ws, { type: MSG.ERROR, message: result.error });
            }
            return;
        }

        // ── TOGGLE_READY ────────────────────────────────
        if (type === MSG.TOGGLE_READY) {
            toggleReady(sessionId);
            return;
        }

        // ── CHAT ────────────────────────────────────────
        if (type === MSG.CHAT) {
            const text = (msg.text || '').slice(0, 200).trim();
            if (!text) return;

            const session = sessions.get(sessionId);
            const { room } = findPlayerRoom(sessionId);
            if (!room) return;

            broadcastToRoom(room, {
                type: MSG.CHAT,
                from: session.nickname,
                fromId: sessionId,
                text
            });
            return;
        }

        // ── START_GAME ──────────────────────────────────
        if (type === MSG.START_GAME) {
            const result = startGame(sessionId);
            if (!result.ok) {
                send(ws, { type: MSG.ERROR, message: result.error });
                return;
            }

            // Broadcast start with slot assignments to all players
            const { room } = findPlayerRoom(sessionId);
            if (room) {
                broadcastToRoom(room, {
                    type: MSG.START_GAME,
                    slotAssignments: result.slotAssignments,
                    hostId: room.hostId,
                    settings: room.settings
                });
            }
            return;
        }

        // ── GAME_STATE (host → relay to guests + spectators) ──
        if (type === MSG.GAME_STATE) {
            relayFromHost(sessionId, msg);
            // If this is a pickup game, forward to world spectators
            if (isActivePickupGameHost(sessionId)) {
                forwardGameStateToSpectators(msg);
            }
            return;
        }

        // ── GAME_ACTION (host → relay to guests) ────────
        if (type === MSG.GAME_ACTION) {
            relayFromHost(sessionId, msg);
            return;
        }

        // ── GAME_OVER (host → relay + reset room + cleanup) ──
        if (type === MSG.GAME_OVER) {
            relayFromHost(sessionId, msg);
            endGame(sessionId, msg.winner);
            // Clean up spectator feed if this was a pickup game
            if (isActivePickupGameHost(sessionId)) {
                handlePickupGameOver();
            }
            return;
        }

        // ── PLAYER_INPUT (guest → relay to host) ────────
        if (type === MSG.PLAYER_INPUT) {
            relayInputToHost(sessionId, msg);
            return;
        }

        // ── PICKUP_UPDATE (lobby status query) ──────────
        if (type === MSG.PICKUP_UPDATE) {
            send(ws, { type: MSG.PICKUP_UPDATE, ...getPickupWorldStatus() });
            return;
        }

        // ── JOIN_PICKUP (enter pickup world) ────────────
        if (type === MSG.JOIN_PICKUP) {
            const session = sessions.get(sessionId);
            enterPickupWorld(sessionId, session.nickname, ws);
            send(ws, { type: MSG.PICKUP_ENTER_WORLD, ok: true });
            return;
        }

        // ── LEAVE_PICKUP (leave pickup world) ───────────
        if (type === MSG.LEAVE_PICKUP) {
            leavePickupWorld(sessionId);
            return;
        }

        // ── PICKUP_POSITION ─────────────────────────────
        if (type === MSG.PICKUP_POSITION) {
            updatePickupPosition(sessionId, msg.x || 0, msg.z || 0, msg.a || 0, msg.y, msg.mb, msg.wc, msg.g, msg.j, msg.s);
            return;
        }

        // ── PICKUP_ZONE_ENTER ───────────────────────────
        if (type === MSG.PICKUP_ZONE_ENTER) {
            enterPickupZone(sessionId, msg.team);
            return;
        }

        // ── PICKUP_ZONE_LEAVE ───────────────────────────
        if (type === MSG.PICKUP_ZONE_LEAVE) {
            leavePickupZone(sessionId);
            return;
        }

        // ── PICKUP_CHAT ────────────────────────────────
        if (type === MSG.PICKUP_CHAT) {
            const text = (msg.text || '').slice(0, 200).trim();
            if (!text) return;
            broadcastPickupChat(sessionId, text);
            return;
        }

        // ── KICK_PLAYER ─────────────────────────────────
        if (type === MSG.KICK_PLAYER) {
            const { room } = findPlayerRoom(sessionId);
            if (!room || room.hostId !== sessionId) return;
            if (msg.targetId === sessionId) return; // can't kick yourself

            const target = room.players.get(msg.targetId);
            if (target) {
                send(target.ws, { type: MSG.ERROR, message: 'You were kicked from the room.' });
                leaveRoom(msg.targetId);
            }
            return;
        }
    });

    // ── Connection close ────────────────────────────────
    ws.on('close', () => {
        if (!sessionId) return;

        const result = handleDisconnect(sessionId);
        if (result && !result.roomDeleted && result.room) {
            // Notify remaining players
            broadcastToRoom(result.room, {
                type: MSG.DISCONNECTED,
                sessionId,
                nickname: result.nickname
            });
        }

        // Handle pickup queue disconnect
        handlePickupDisconnect(sessionId);

        // Keep session around briefly for reconnection (60 seconds)
        const session = sessions.get(sessionId);
        if (session) {
            session._disconnectedAt = Date.now();
        }
    });

    ws.on('error', () => {
        // Errors trigger close, handled above
    });
});

// ─── Clean up stale sessions every 60 seconds ───────────────
setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions) {
        if (session._disconnectedAt && now - session._disconnectedAt > 60_000) {
            sessions.delete(sid);
        }
    }
}, 60_000);

// ─── Clean up AFK pickup players every 10 seconds ──────────
setInterval(() => {
    cleanupAfkPlayers();
}, 10_000);

// ─── Start ──────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`\n  🏀 Hoops Royale Server`);
    console.log(`  ──────────────────────`);
    console.log(`  Game:      http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  Ready for connections.\n`);
});
