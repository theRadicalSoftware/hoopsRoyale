// ─── Hoops Royale Pickup Queue ─────────────────────────────
// Server-side winner-stays-on pickup game system.
// State machine: WAITING → STAGING → PLAYING → RESULT → loop
//
// Queue is FIFO. When 6+ players are available, the first 3
// form the challenger team against the current winners (or
// the first 6 split into two teams for a fresh game).

import {
    createRoom, joinRoom, leaveRoom, broadcastToRoom,
    broadcastRoomUpdate, serializeRoom, getRoomForSession
} from './rooms.js';
import {
    PICKUP_UPDATE, PICKUP_MATCH, JOIN_PICKUP, LEAVE_PICKUP,
    START_GAME, ROOM_UPDATE, ERROR
} from './protocol.js';

// ─── Constants ─────────────────────────────────────────────
const STAGING_COUNTDOWN = 15; // seconds
const TEAM_SIZE = 3;
const MIN_PLAYERS_TO_START = TEAM_SIZE * 2;
const PICKUP_SCORE_TARGET = 11;
const AFK_TIMEOUT = 30_000; // 30 seconds heartbeat timeout

// ─── State ─────────────────────────────────────────────────
// Queue entry: { sessionId, ws, nickname, joinedAt, lastHeartbeat }
const queue = [];

// Current winners (array of { sessionId, ws, nickname })
let winners = [];

// Pickup room code (reused across games)
let pickupRoomCode = null;

// State machine phase
let phase = 'waiting'; // 'waiting' | 'staging' | 'playing' | 'result'

// Staging timer
let stagingTimer = null;
let stagingCountdown = STAGING_COUNTDOWN;

// Spectators watching the current game
const spectators = new Set(); // sessionId set

// ─── Queue Management ──────────────────────────────────────

function send(ws, msg) {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(msg));
    }
}

export function joinPickupQueue(sessionId, nickname, ws) {
    // Check if already in queue
    if (queue.some(q => q.sessionId === sessionId)) {
        send(ws, { type: ERROR, message: 'Already in the pickup queue.' });
        return;
    }

    // Check if already a winner waiting
    if (winners.some(w => w.sessionId === sessionId)) {
        send(ws, { type: ERROR, message: 'You\'re already on court.' });
        return;
    }

    queue.push({
        sessionId,
        ws,
        nickname,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now()
    });

    // Send queue position to the new player
    broadcastQueueUpdate();

    // Check if we can start a game
    tryAdvancePhase();
}

export function leavePickupQueue(sessionId) {
    const idx = queue.findIndex(q => q.sessionId === sessionId);
    if (idx >= 0) {
        queue.splice(idx, 1);
        broadcastQueueUpdate();
    }

    // Also remove from winners if applicable
    const wIdx = winners.findIndex(w => w.sessionId === sessionId);
    if (wIdx >= 0) {
        winners.splice(wIdx, 1);
        // If a winner leaves, check if we need to reset
        if (phase === 'result' || phase === 'waiting') {
            tryAdvancePhase();
        }
    }

    // Remove from spectators
    spectators.delete(sessionId);
}

export function handlePickupDisconnect(sessionId) {
    leavePickupQueue(sessionId);
}

// ─── Phase Machine ─────────────────────────────────────────

function tryAdvancePhase() {
    if (phase === 'waiting') {
        const totalAvailable = queue.length + winners.length;
        if (totalAvailable >= MIN_PLAYERS_TO_START) {
            startStaging();
        }
    } else if (phase === 'result') {
        // After a game ends, try to start the next one
        const challengers = queue.length;
        if (challengers >= TEAM_SIZE) {
            startStaging();
        } else if (winners.length === 0 && challengers >= MIN_PLAYERS_TO_START) {
            // No winners (all left), fresh game
            startStaging();
        } else {
            // Not enough for next game, go to waiting
            phase = 'waiting';
            broadcastQueueUpdate();
        }
    }
}

function startStaging() {
    phase = 'staging';
    stagingCountdown = STAGING_COUNTDOWN;

    // Determine teams
    let homeTeam, awayTeam;

    if (winners.length >= TEAM_SIZE) {
        // Winners stay as home team, next 3 from queue are away
        homeTeam = winners.slice(0, TEAM_SIZE);
        awayTeam = queue.splice(0, TEAM_SIZE);
    } else {
        // Fresh game: first 3 from queue are home, next 3 are away
        // Add any remaining winners back to front of queue
        for (const w of winners) {
            queue.unshift(w);
        }
        winners = [];
        homeTeam = queue.splice(0, TEAM_SIZE);
        awayTeam = queue.splice(0, TEAM_SIZE);
    }

    // Notify matched players
    for (let i = 0; i < homeTeam.length; i++) {
        send(homeTeam[i].ws, {
            type: PICKUP_MATCH,
            team: 'home',
            slot: i,
            nickname: homeTeam[i].nickname,
            countdown: stagingCountdown
        });
    }
    for (let i = 0; i < awayTeam.length; i++) {
        send(awayTeam[i].ws, {
            type: PICKUP_MATCH,
            team: 'away',
            slot: i,
            nickname: awayTeam[i].nickname,
            countdown: stagingCountdown
        });
    }

    // Store matched players for game creation
    const matchedPlayers = { home: homeTeam, away: awayTeam };

    // Remaining queue members become spectators
    for (const q of queue) {
        spectators.add(q.sessionId);
    }

    // Start countdown
    stagingTimer = setInterval(() => {
        stagingCountdown--;

        // Broadcast countdown to all matched players
        const countdownMsg = { type: PICKUP_UPDATE, phase: 'staging', countdown: stagingCountdown };
        for (const p of matchedPlayers.home) send(p.ws, countdownMsg);
        for (const p of matchedPlayers.away) send(p.ws, countdownMsg);

        if (stagingCountdown <= 0) {
            clearInterval(stagingTimer);
            stagingTimer = null;
            startPickupGame(matchedPlayers);
        }
    }, 1000);

    broadcastQueueUpdate();
}

function startPickupGame(matchedPlayers) {
    phase = 'playing';

    // The first home player is the host
    const host = matchedPlayers.home[0];

    // Build slot assignments
    const slotAssignments = {};
    for (let i = 0; i < matchedPlayers.home.length; i++) {
        const p = matchedPlayers.home[i];
        slotAssignments[p.sessionId] = { team: 'home', slot: i, nickname: p.nickname };
    }
    for (let i = 0; i < matchedPlayers.away.length; i++) {
        const p = matchedPlayers.away[i];
        slotAssignments[p.sessionId] = { team: 'away', slot: i, nickname: p.nickname };
    }

    // Send START_GAME to all matched players
    const startMsg = {
        type: START_GAME,
        slotAssignments,
        hostId: host.sessionId,
        settings: {
            scoreTarget: PICKUP_SCORE_TARGET,
            mode: 'pickup'
        }
    };
    for (const p of matchedPlayers.home) send(p.ws, startMsg);
    for (const p of matchedPlayers.away) send(p.ws, startMsg);

    // Store current players for result phase
    winners = []; // Will be set after game ends
    broadcastQueueUpdate();
}

/**
 * Called when a pickup game ends.
 * @param {string} winnerTeam - 'home' or 'away'
 * @param {Object} slotAssignments - the slot assignments from the game
 */
export function handlePickupGameOver(winnerTeam, slotAssignments) {
    phase = 'result';

    if (!slotAssignments) {
        winners = [];
        tryAdvancePhase();
        return;
    }

    // Determine winners and losers
    const newWinners = [];
    const losers = [];

    for (const [sid, assignment] of Object.entries(slotAssignments)) {
        const entry = { sessionId: sid, nickname: assignment.nickname };
        // Try to find their ws from queue entries or existing tracking
        const queueEntry = queue.find(q => q.sessionId === sid);
        if (queueEntry) entry.ws = queueEntry.ws;

        if (assignment.team === winnerTeam) {
            newWinners.push(entry);
        } else {
            losers.push(entry);
        }
    }

    // Winners stay on court
    winners = newWinners;

    // Losers go to back of queue
    for (const loser of losers) {
        if (loser.ws) {
            queue.push({
                sessionId: loser.sessionId,
                ws: loser.ws,
                nickname: loser.nickname,
                joinedAt: Date.now(),
                lastHeartbeat: Date.now()
            });
        }
    }

    broadcastQueueUpdate();

    // Short delay before trying next game
    setTimeout(() => tryAdvancePhase(), 3000);
}

// ─── Queue Broadcast ───────────────────────────────────────

function broadcastQueueUpdate() {
    const courtStatus = getCourtStatus();

    // Update everyone in queue
    for (let i = 0; i < queue.length; i++) {
        send(queue[i].ws, {
            type: PICKUP_UPDATE,
            phase,
            queuePos: i + 1,
            queueLen: queue.length,
            court: courtStatus
        });
    }

    // Update spectators
    for (const sid of spectators) {
        const entry = queue.find(q => q.sessionId === sid);
        if (entry) {
            send(entry.ws, {
                type: PICKUP_UPDATE,
                phase,
                queuePos: queue.indexOf(entry) + 1,
                queueLen: queue.length,
                court: courtStatus
            });
        }
    }
}

function getCourtStatus() {
    if (phase === 'playing') {
        return {
            state: 'playing',
            winnersCount: winners.length,
            queueCount: queue.length
        };
    } else if (phase === 'staging') {
        return {
            state: 'staging',
            countdown: stagingCountdown,
            queueCount: queue.length
        };
    } else {
        return {
            state: 'waiting',
            queueCount: queue.length,
            winnersCount: winners.length
        };
    }
}

// ─── AFK Cleanup ───────────────────────────────────────────

export function cleanupAfkPlayers() {
    const now = Date.now();
    let removed = false;

    for (let i = queue.length - 1; i >= 0; i--) {
        if (now - queue[i].lastHeartbeat > AFK_TIMEOUT) {
            send(queue[i].ws, { type: ERROR, message: 'Removed from pickup queue (AFK).' });
            queue.splice(i, 1);
            removed = true;
        }
    }

    if (removed) broadcastQueueUpdate();
}

export function refreshPickupHeartbeat(sessionId) {
    const entry = queue.find(q => q.sessionId === sessionId);
    if (entry) entry.lastHeartbeat = Date.now();
}

// ─── Query ─────────────────────────────────────────────────

export function getPickupStatus() {
    return {
        phase,
        queueLength: queue.length,
        winnersCount: winners.length,
        court: getCourtStatus()
    };
}

export function isInPickup(sessionId) {
    return queue.some(q => q.sessionId === sessionId) ||
           winners.some(w => w.sessionId === sessionId);
}
