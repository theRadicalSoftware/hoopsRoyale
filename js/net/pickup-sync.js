// ─── Hoops Royale Pickup World Sync ──────────────────────
// Client-side networking for the pickup world mode.
// Sends player position at 10 Hz, receives world state
// (other player positions + queue rosters), and manages
// zone enter/leave messages.

import connection from './connection.js';
import * as MSG from './protocol.js';

const POSITION_RATE = 100; // ms between position sends (10 Hz)

// ─── State ─────────────────────────────────────────────────
let active = false;
let positionTimer = null;
let mySessionId = null;
let myTeam = null;       // null | 'home' | 'away'

// Current local position (set by main.js each frame)
const currentPos = { x: 0, z: 0, a: 0 };

// Callbacks
let onWorldState = null; // (msg) => void

// ─── Init / Teardown ───────────────────────────────────────

/**
 * Start pickup world sync.
 * @param {Object} opts
 * @param {string} opts.mySessionId
 * @param {Function} opts.onWorldState - receives PICKUP_WORLD_STATE messages
 */
export function startPickupSync(opts) {
    mySessionId = opts.mySessionId;
    onWorldState = opts.onWorldState || null;
    active = true;
    myTeam = null;

    connection.on(MSG.PICKUP_WORLD_STATE, handleWorldState);
    positionTimer = setInterval(sendPosition, POSITION_RATE);
}

export function stopPickupSync() {
    active = false;
    myTeam = null;
    if (positionTimer) {
        clearInterval(positionTimer);
        positionTimer = null;
    }
    connection.off(MSG.PICKUP_WORLD_STATE, handleWorldState);
}

// ─── Position Broadcasting ─────────────────────────────────

/**
 * Set current local position (called by main.js each frame).
 */
export function setPosition(x, z, angle) {
    currentPos.x = x;
    currentPos.z = z;
    currentPos.a = angle;
}

function sendPosition() {
    if (!active || !connection.connected) return;
    connection.send({
        type: MSG.PICKUP_POSITION,
        x: Math.round(currentPos.x * 100) / 100,
        z: Math.round(currentPos.z * 100) / 100,
        a: Math.round(currentPos.a * 100) / 100
    });
}

// ─── World State Reception ─────────────────────────────────

function handleWorldState(msg) {
    if (!active) return;
    if (onWorldState) onWorldState(msg);
}

// ─── Zone Enter / Leave ────────────────────────────────────

export function enterZone(team) {
    if (!active || myTeam === team) return;
    myTeam = team;
    connection.send({ type: MSG.PICKUP_ZONE_ENTER, team });
}

export function leaveZone() {
    if (!active || !myTeam) return;
    myTeam = null;
    connection.send({ type: MSG.PICKUP_ZONE_LEAVE });
}

// ─── Leave Pickup World ────────────────────────────────────

export function sendLeavePickup() {
    connection.send({ type: MSG.LEAVE_PICKUP });
    stopPickupSync();
}

// ─── Query ─────────────────────────────────────────────────

export function getMyTeam() { return myTeam; }
export function getMySessionId() { return mySessionId; }
export function isPickupSyncActive() { return active; }
