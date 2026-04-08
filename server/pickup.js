// ─── Hoops Royale Pickup World ─────────────────────────────
// Persistent world where players walk around the park, approach
// court gate entrances to queue for teams, and auto-start games
// when both teams fill up.
//
// Players enter the 3D world, walk to glowing queue zones at
// each court gate (home = -Z gate, away = +Z gate), and stand
// in the zone to claim a slot. When 3 players queue on each
// side the countdown starts and a game begins.

import {
    createRoom, joinRoom, startGame,
    getRoomForSession, broadcastToRoom
} from './rooms.js';
import {
    PICKUP_WORLD_STATE, PICKUP_ENTER_WORLD, START_GAME, ERROR
} from './protocol.js';

// ─── Constants ─────────────────────────────────────────────
const TEAM_SIZE = 3;
const COUNTDOWN_SEC = 5;
const BROADCAST_MS = 100;         // 10 Hz world state broadcast
const AFK_TIMEOUT = 45_000;       // 45 seconds without heartbeat
const PICKUP_SCORE_TARGET = 11;

// ─── World State ──────────────────────────────────────────
// sessionId → { ws, nickname, x, z, angle, team, queued, lastHeartbeat }
const worldPlayers = new Map();

const homeQueue = [];   // ordered sessionIds queued for home (−Z gate)
const awayQueue = [];   // ordered sessionIds queued for away (+Z gate)

let countdown = -1;           // seconds remaining, -1 = inactive
let countdownTimer = null;
let broadcastTimer = null;

// ─── Helpers ──────────────────────────────────────────────

function send(ws, msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function removeFromArray(arr, value) {
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
}

// ─── Enter / Leave World ──────────────────────────────────

export function enterPickupWorld(sessionId, nickname, ws) {
    if (worldPlayers.has(sessionId)) {
        // Already in world — update ws in case of reconnect
        const p = worldPlayers.get(sessionId);
        p.ws = ws;
        return;
    }

    worldPlayers.set(sessionId, {
        ws,
        nickname,
        x: 0,
        z: -28,
        angle: 0,
        team: null,
        queued: false,
        lastHeartbeat: Date.now()
    });

    ensureBroadcasting();
}

export function leavePickupWorld(sessionId) {
    leaveZoneInternal(sessionId);
    worldPlayers.delete(sessionId);
    stopBroadcastIfEmpty();
}

// ─── Position Updates ─────────────────────────────────────

export function updatePickupPosition(sessionId, x, z, angle) {
    const p = worldPlayers.get(sessionId);
    if (!p) return;
    p.x = x;
    p.z = z;
    p.angle = angle;
    p.lastHeartbeat = Date.now();
}

// ─── Zone Queuing ─────────────────────────────────────────

export function enterPickupZone(sessionId, team) {
    const p = worldPlayers.get(sessionId);
    if (!p) return;
    if (team !== 'home' && team !== 'away') return;

    // Leave previous zone if in one
    leaveZoneInternal(sessionId);

    const queue = team === 'home' ? homeQueue : awayQueue;
    if (queue.length >= TEAM_SIZE) {
        send(p.ws, { type: ERROR, message: 'That side is full.' });
        return;
    }

    queue.push(sessionId);
    p.team = team;
    p.queued = true;

    checkGameReady();
}

export function leavePickupZone(sessionId) {
    leaveZoneInternal(sessionId);
}

function leaveZoneInternal(sessionId) {
    const p = worldPlayers.get(sessionId);
    if (!p || !p.queued) return;

    removeFromArray(homeQueue, sessionId);
    removeFromArray(awayQueue, sessionId);
    p.team = null;
    p.queued = false;

    // Cancel countdown if teams no longer full
    if (countdown > 0 && (homeQueue.length < TEAM_SIZE || awayQueue.length < TEAM_SIZE)) {
        cancelCountdown();
    }
}

// ─── Game Readiness ───────────────────────────────────────

function checkGameReady() {
    if (homeQueue.length >= TEAM_SIZE && awayQueue.length >= TEAM_SIZE && countdown < 0) {
        startCountdown();
    }
}

function startCountdown() {
    countdown = COUNTDOWN_SEC;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            launchPickupGame();
        }
    }, 1000);
}

function cancelCountdown() {
    countdown = -1;
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

// ─── Game Launch ──────────────────────────────────────────

function launchPickupGame() {
    countdown = -1;

    const homeSids = homeQueue.splice(0, TEAM_SIZE);
    const awaySids = awayQueue.splice(0, TEAM_SIZE);

    // Designate host = first home player
    const hostSid = homeSids[0];
    const hostP = worldPlayers.get(hostSid);
    if (!hostP) return;

    // Create room via the room system
    const roomResult = createRoom(hostSid, hostP.nickname, hostP.ws, {
        name: 'Pickup Game',
        isPublic: false,
        scoreTarget: PICKUP_SCORE_TARGET,
        mode: 'pickup'
    });
    if (!roomResult.ok) return;
    const code = roomResult.code;

    // Join remaining home players (host already joined via createRoom)
    for (let i = 1; i < homeSids.length; i++) {
        const sid = homeSids[i];
        const p = worldPlayers.get(sid);
        if (p) joinRoom(sid, p.nickname, p.ws, code, 'home');
    }

    // Join away players
    for (const sid of awaySids) {
        const p = worldPlayers.get(sid);
        if (p) joinRoom(sid, p.nickname, p.ws, code, 'away');
    }

    // Mark all players as ready and start the game
    const room = getRoomForSession(hostSid);
    if (room) {
        for (const pl of room.players.values()) pl.ready = true;
    }
    const gameResult = startGame(hostSid);
    if (!gameResult.ok) return;

    // Broadcast START_GAME to all room players
    if (room) {
        broadcastToRoom(room, {
            type: START_GAME,
            slotAssignments: gameResult.slotAssignments,
            hostId: hostSid,
            settings: room.settings
        });
    }

    // Remove these 6 players from the pickup world
    for (const sid of [...homeSids, ...awaySids]) {
        worldPlayers.delete(sid);
    }

    stopBroadcastIfEmpty();
}

// ─── World State Broadcast ────────────────────────────────

function ensureBroadcasting() {
    if (!broadcastTimer) {
        broadcastTimer = setInterval(broadcastWorldState, BROADCAST_MS);
    }
}

function stopBroadcastIfEmpty() {
    if (worldPlayers.size === 0 && broadcastTimer) {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
    }
}

function broadcastWorldState() {
    if (worldPlayers.size === 0) return;

    // Serialize all players
    const players = [];
    for (const [sid, p] of worldPlayers) {
        players.push({
            id: sid,
            n: p.nickname,
            x: Math.round(p.x * 100) / 100,
            z: Math.round(p.z * 100) / 100,
            a: Math.round(p.angle * 100) / 100,
            t: p.team,
            q: p.queued
        });
    }

    // Queue rosters (nicknames for HUD display)
    const hq = homeQueue.map(sid => worldPlayers.get(sid)?.nickname || '?');
    const aq = awayQueue.map(sid => worldPlayers.get(sid)?.nickname || '?');

    const raw = JSON.stringify({
        type: PICKUP_WORLD_STATE,
        p: players,
        hq,
        aq,
        cd: countdown
    });

    for (const p of worldPlayers.values()) {
        if (p.ws?.readyState === 1) p.ws.send(raw);
    }
}

// ─── AFK Cleanup ──────────────────────────────────────────

export function cleanupAfkPlayers() {
    const now = Date.now();
    let removed = false;

    for (const [sid, p] of worldPlayers) {
        if (now - p.lastHeartbeat > AFK_TIMEOUT) {
            leaveZoneInternal(sid);
            worldPlayers.delete(sid);
            send(p.ws, { type: ERROR, message: 'Removed from pickup world (AFK).' });
            removed = true;
        }
    }

    if (removed) stopBroadcastIfEmpty();
}

export function refreshPickupHeartbeat(sessionId) {
    const p = worldPlayers.get(sessionId);
    if (p) p.lastHeartbeat = Date.now();
}

// ─── Disconnect Handling ──────────────────────────────────

export function handlePickupDisconnect(sessionId) {
    leavePickupWorld(sessionId);
}

// ─── Query ────────────────────────────────────────────────

export function isInPickupWorld(sessionId) {
    return worldPlayers.has(sessionId);
}
