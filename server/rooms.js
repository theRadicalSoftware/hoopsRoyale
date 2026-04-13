import { generateRoomCode, ROOM_UPDATE, ERROR } from './protocol.js';

// ─── Room Manager ───────────────────────────────────────────
// Manages all active rooms: create, join, leave, list, team
// switching, ready state, and game lifecycle.

const rooms = new Map();   // code → Room
const MAX_ROOM_PLAYERS = 6;
const MAX_ROOMS = 50;

/** Serialize a room to a lobby-safe view (no WebSocket refs). */
function serializeRoom(room) {
    const players = [];
    for (const [sid, p] of room.players) {
        players.push({
            sessionId: sid,
            nickname: p.nickname,
            team: p.team,
            slot: p.slot,
            ready: p.ready,
            role: p.role
        });
    }
    return {
        code: room.code,
        name: room.name,
        hostId: room.hostId,
        players,
        settings: { ...room.settings },
        state: room.state,
        playerCount: room.players.size,
        maxPlayers: MAX_ROOM_PLAYERS
    };
}

/** Serialize just enough for the room list (public lobby browser). */
function serializeRoomPreview(room) {
    return {
        code: room.code,
        name: room.name,
        hostNickname: room.players.get(room.hostId)?.nickname || '???',
        playerCount: room.players.size,
        maxPlayers: MAX_ROOM_PLAYERS,
        state: room.state,
        scoreTarget: room.settings.scoreTarget
    };
}

/** Broadcast a message to all players in a room. */
function broadcastToRoom(room, msg, excludeSessionId = null) {
    const raw = JSON.stringify(msg);
    for (const [sid, p] of room.players) {
        if (sid === excludeSessionId) continue;
        if (p.ws.readyState === 1) p.ws.send(raw);
    }
    // Also send to spectators
    if (room.spectators) {
        for (const spec of room.spectators) {
            if (spec.ws.readyState === 1) spec.ws.send(raw);
        }
    }
}

/** Broadcast updated room state to everyone in the room. */
function broadcastRoomUpdate(room) {
    broadcastToRoom(room, { type: ROOM_UPDATE, room: serializeRoom(room) });
}

/** Assign the next available slot on a team. Returns slot index or -1 if full. */
function nextSlot(room, team) {
    const taken = new Set();
    for (const p of room.players.values()) {
        if (p.team === team) taken.add(p.slot);
    }
    for (let i = 0; i < 3; i++) {
        if (!taken.has(i)) return i;
    }
    return -1;
}

/** Count players on a given team. */
function teamCount(room, team) {
    let count = 0;
    for (const p of room.players.values()) {
        if (p.team === team) count++;
    }
    return count;
}

/** Pick the team with fewer players (prefer 'home' on tie). */
function autoAssignTeam(room) {
    const home = teamCount(room, 'home');
    const away = teamCount(room, 'away');
    return away < home ? 'away' : 'home';
}

// ─── Public API ─────────────────────────────────────────────

export function createRoom(sessionId, nickname, ws, options = {}) {
    if (rooms.size >= MAX_ROOMS) {
        return { ok: false, error: 'Server is full. Try again later.' };
    }

    // Generate a unique code
    let code;
    let attempts = 0;
    do {
        code = generateRoomCode();
        attempts++;
    } while (rooms.has(code) && attempts < 20);

    if (rooms.has(code)) {
        return { ok: false, error: 'Could not generate unique room code.' };
    }

    const room = {
        code,
        name: options.name || `${nickname}'s Court`,
        hostId: sessionId,
        players: new Map(),
        spectators: new Set(),
        settings: {
            isPublic: options.isPublic !== false,
            scoreTarget: [11, 15, 21].includes(options.scoreTarget) ? options.scoreTarget : 21,
            teamSize: 3,
            mode: options.mode || 'custom',
            // Game rules (street basketball defaults)
            scoringMode: options.scoringMode === 'nba' ? 'nba' : 'street',
            makeItTakeIt: !!options.makeItTakeIt,
            winByTwo: options.winByTwo !== false,
            shotClockEnabled: !!options.shotClockEnabled,
            shotClockDuration: [8, 10, 12, 14, 16].includes(options.shotClockDuration) ? options.shotClockDuration : 12,
        },
        state: 'lobby',
        createdAt: Date.now()
    };

    // Host joins as home slot 0
    room.players.set(sessionId, {
        ws,
        nickname,
        team: 'home',
        slot: 0,
        ready: false,
        role: 'player'
    });

    rooms.set(code, room);
    return { ok: true, code, room: serializeRoom(room) };
}

export function joinRoom(sessionId, nickname, ws, code, preferredTeam = null) {
    const room = rooms.get(code?.toUpperCase());
    if (!room) {
        return { ok: false, error: 'Room not found.' };
    }
    if (room.state !== 'lobby') {
        return { ok: false, error: 'Game already in progress.' };
    }
    if (room.players.size >= MAX_ROOM_PLAYERS) {
        return { ok: false, error: 'Room is full.' };
    }
    if (room.players.has(sessionId)) {
        return { ok: false, error: 'Already in this room.' };
    }

    const team = (preferredTeam === 'home' || preferredTeam === 'away') ? preferredTeam : autoAssignTeam(room);
    const slot = nextSlot(room, team);
    if (slot < 0) {
        return { ok: false, error: 'No slots available.' };
    }

    room.players.set(sessionId, {
        ws,
        nickname,
        team,
        slot,
        ready: false,
        role: 'player'
    });

    broadcastRoomUpdate(room);
    return { ok: true, room: serializeRoom(room) };
}

export function leaveRoom(sessionId) {
    for (const [code, room] of rooms) {
        if (!room.players.has(sessionId)) continue;

        room.players.delete(sessionId);

        // If room is empty, delete it
        if (room.players.size === 0) {
            rooms.delete(code);
            return { ok: true, roomDeleted: true };
        }

        // If host left, transfer to next player
        if (room.hostId === sessionId) {
            const nextHost = room.players.keys().next().value;
            room.hostId = nextHost;
        }

        broadcastRoomUpdate(room);
        return { ok: true, roomDeleted: false };
    }
    return { ok: false };
}

export function switchTeam(sessionId) {
    const { room, player } = findPlayerRoom(sessionId);
    if (!room || !player) return { ok: false };
    if (room.state !== 'lobby') return { ok: false, error: 'Cannot switch during game.' };

    const newTeam = player.team === 'home' ? 'away' : 'home';
    const slot = nextSlot(room, newTeam);
    if (slot < 0) return { ok: false, error: 'Other team is full.' };

    player.team = newTeam;
    player.slot = slot;
    player.ready = false;

    broadcastRoomUpdate(room);
    return { ok: true };
}

export function toggleReady(sessionId) {
    const { room, player } = findPlayerRoom(sessionId);
    if (!room || !player) return { ok: false };
    if (room.state !== 'lobby') return { ok: false };

    player.ready = !player.ready;
    broadcastRoomUpdate(room);
    return { ok: true };
}

export function startGame(sessionId) {
    const { room } = findPlayerRoom(sessionId);
    if (!room) return { ok: false, error: 'Not in a room.' };
    if (room.hostId !== sessionId) return { ok: false, error: 'Only the host can start.' };
    if (room.state !== 'lobby') return { ok: false, error: 'Game already started.' };

    // Require at least 2 human players
    if (room.players.size < 2) {
        return { ok: false, error: 'Need at least 2 players.' };
    }

    // Require all players to be ready (except host)
    for (const [sid, p] of room.players) {
        if (sid === sessionId) continue; // host doesn't need to ready
        if (!p.ready) return { ok: false, error: 'Not all players are ready.' };
    }

    room.state = 'playing';

    // Build slot assignments: { sessionId → { team, slot } }
    const slotAssignments = {};
    for (const [sid, p] of room.players) {
        slotAssignments[sid] = { team: p.team, slot: p.slot, nickname: p.nickname };
    }

    broadcastRoomUpdate(room);
    return { ok: true, slotAssignments };
}

export function endGame(sessionId, winner) {
    const { room } = findPlayerRoom(sessionId);
    if (!room) return;
    if (room.hostId !== sessionId) return;

    room.state = 'lobby';
    // Reset all ready states
    for (const p of room.players.values()) {
        p.ready = false;
    }
    broadcastRoomUpdate(room);
}

export function listPublicRooms() {
    const result = [];
    for (const room of rooms.values()) {
        if (!room.settings.isPublic) continue;
        if (room.players.size >= MAX_ROOM_PLAYERS) continue;
        result.push(serializeRoomPreview(room));
    }
    // Sort: lobby rooms first, then by player count descending
    result.sort((a, b) => {
        if (a.state === 'lobby' && b.state !== 'lobby') return -1;
        if (a.state !== 'lobby' && b.state === 'lobby') return 1;
        return b.playerCount - a.playerCount;
    });
    return result;
}

export function getRoom(code) {
    return rooms.get(code?.toUpperCase()) || null;
}

export function getRoomForSession(sessionId) {
    for (const room of rooms.values()) {
        if (room.players.has(sessionId)) return room;
    }
    return null;
}

export function findPlayerRoom(sessionId) {
    for (const room of rooms.values()) {
        const player = room.players.get(sessionId);
        if (player) return { room, player };
    }
    return { room: null, player: null };
}

/** Relay a message from one player to all others in their room. */
export function relayToRoom(sessionId, msg) {
    const { room } = findPlayerRoom(sessionId);
    if (!room) return;
    broadcastToRoom(room, msg, sessionId);
}

/** Relay a message from host to all guests (and spectators) in the room. */
export function relayFromHost(sessionId, msg) {
    const { room } = findPlayerRoom(sessionId);
    if (!room || room.hostId !== sessionId) return;
    broadcastToRoom(room, msg, sessionId);
}

/** Relay guest input to the host of their room. */
export function relayInputToHost(sessionId, msg) {
    const { room } = findPlayerRoom(sessionId);
    if (!room) return;
    const host = room.players.get(room.hostId);
    if (!host || host.ws.readyState !== 1) return;
    // Tag the message with the sender's session ID so host knows who sent it
    host.ws.send(JSON.stringify({ ...msg, from: sessionId }));
}

/** Handle a player disconnecting — clean up rooms. */
export function handleDisconnect(sessionId) {
    const { room, player } = findPlayerRoom(sessionId);
    if (!room) return null;

    const nickname = player?.nickname || 'Unknown';
    room.players.delete(sessionId);

    if (room.players.size === 0) {
        rooms.delete(room.code);
        return { roomDeleted: true, code: room.code, nickname };
    }

    // Transfer host if needed
    if (room.hostId === sessionId) {
        room.hostId = room.players.keys().next().value;
    }

    broadcastRoomUpdate(room);
    return { roomDeleted: false, code: room.code, nickname, room };
}

export { broadcastToRoom, broadcastRoomUpdate, serializeRoom };
