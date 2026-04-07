// ─── Hoops Royale Guest Sync ───────────────────────────────
// Runs on guest browsers. Receives state snapshots from host
// (via relay server), buffers them for interpolation, and
// sends local input to the server at 60Hz.

import connection from './connection.js';
import * as MSG from './protocol.js';

const INPUT_RATE = 16; // ms between input sends (~60Hz)
const INTERP_DELAY = 3; // number of snapshots behind to interpolate

// ─── State ─────────────────────────────────────────────────
let active = false;
let inputTimer = null;

// Snapshot buffer (ring buffer of GAME_STATE messages)
const snapshotBuffer = [];
const MAX_SNAPSHOTS = 10;

// Latest input state (set by main.js each frame)
let currentInput = {
    forward: false, backward: false, left: false, right: false,
    jump: false, actionZ: false, actionX: false, actionC: false,
    actionV: false, block: false
};

// Slot assignments and identity
let slotAssignments = {};
let mySessionId = null;
let myTeam = null;
let mySlot = -1;

// Game action callback (for discrete events like score, dunk, etc.)
let onGameAction = null;
let onGameOver = null;

// ─── Init / Teardown ───────────────────────────────────────

/**
 * Start guest sync.
 * @param {Object} opts
 * @param {Object} opts.slotAssignments
 * @param {string} opts.mySessionId
 * @param {Function} [opts.onGameAction] - callback for GAME_ACTION messages
 * @param {Function} [opts.onGameOver] - callback for GAME_OVER messages
 */
export function startGuestSync(opts) {
    slotAssignments = opts.slotAssignments || {};
    mySessionId = opts.mySessionId;
    onGameAction = opts.onGameAction || null;
    onGameOver = opts.onGameOver || null;

    // Find my slot
    const myAssignment = slotAssignments[mySessionId];
    if (myAssignment) {
        myTeam = myAssignment.team;
        mySlot = myAssignment.slot;
    }

    active = true;
    snapshotBuffer.length = 0;

    // Listen for state broadcasts
    connection.on(MSG.GAME_STATE, handleStateSnapshot);
    connection.on(MSG.GAME_ACTION, handleGameAction);
    connection.on(MSG.GAME_OVER, handleGameOver);

    // Start sending input
    inputTimer = setInterval(sendInput, INPUT_RATE);
}

export function stopGuestSync() {
    active = false;
    if (inputTimer) {
        clearInterval(inputTimer);
        inputTimer = null;
    }
    connection.off(MSG.GAME_STATE, handleStateSnapshot);
    connection.off(MSG.GAME_ACTION, handleGameAction);
    connection.off(MSG.GAME_OVER, handleGameOver);
    snapshotBuffer.length = 0;
}

// ─── Input Sending ─────────────────────────────────────────

/**
 * Set the current local input state (called by main.js each frame).
 * @param {Object} input
 */
export function setLocalInput(input) {
    currentInput = input;
}

function sendInput() {
    if (!active || !connection.connected) return;
    connection.send({
        type: MSG.PLAYER_INPUT,
        f: currentInput.forward,
        b: currentInput.backward,
        l: currentInput.left,
        r: currentInput.right,
        j: currentInput.jump,
        z: currentInput.actionZ,
        x: currentInput.actionX,
        c: currentInput.actionC,
        v: currentInput.actionV,
        bk: currentInput.block
    });
}

// ─── State Reception ───────────────────────────────────────

function handleStateSnapshot(msg) {
    snapshotBuffer.push(msg);
    if (snapshotBuffer.length > MAX_SNAPSHOTS) {
        snapshotBuffer.shift();
    }
}

function handleGameAction(msg) {
    if (onGameAction) onGameAction(msg.action, msg.data);
}

function handleGameOver(msg) {
    if (onGameOver) onGameOver(msg.winner, msg.score);
    stopGuestSync();
}

// ─── Interpolation ─────────────────────────────────────────

/**
 * Get the interpolated game state for rendering.
 * Returns null if not enough snapshots buffered yet.
 * @returns {{ players: Array, ball: Object, scores: Object, gamePhase: string }|null}
 */
export function getInterpolatedState() {
    if (snapshotBuffer.length < 2) {
        // Not enough data — return latest if available
        if (snapshotBuffer.length === 1) {
            return extractState(snapshotBuffer[0]);
        }
        return null;
    }

    // Use the two most recent snapshots for interpolation
    // With INTERP_DELAY=3, we render behind the latest to absorb jitter
    const targetIdx = Math.max(0, snapshotBuffer.length - INTERP_DELAY);
    const fromIdx = Math.max(0, targetIdx - 1);
    const from = snapshotBuffer[fromIdx];
    const to = snapshotBuffer[Math.min(targetIdx, snapshotBuffer.length - 1)];

    if (from.t === to.t) {
        return extractState(to);
    }

    // Interpolation factor (0 = from, 1 = to)
    // We always interpolate fully to `to` since we're rendering behind
    const alpha = 1.0;

    return interpolateStates(from, to, alpha);
}

/**
 * Get the latest raw snapshot (for client-side prediction comparison).
 * @returns {Object|null}
 */
export function getLatestSnapshot() {
    return snapshotBuffer.length > 0 ? snapshotBuffer[snapshotBuffer.length - 1] : null;
}

function extractState(snapshot) {
    return {
        tick: snapshot.t,
        players: snapshot.p || [],
        ball: snapshot.b || null,
        scores: snapshot.s || {},
        gamePhase: snapshot.gp || 'playing'
    };
}

function interpolateStates(from, to, alpha) {
    const players = [];
    const fromPlayers = from.p || [];
    const toPlayers = to.p || [];
    const maxLen = Math.max(fromPlayers.length, toPlayers.length);

    for (let i = 0; i < maxLen; i++) {
        const fp = fromPlayers[i];
        const tp = toPlayers[i];

        if (!fp && !tp) {
            players.push(null);
        } else if (!fp) {
            players.push(tp);
        } else if (!tp) {
            players.push(fp);
        } else {
            players.push(interpolateEntity(fp, tp, alpha));
        }
    }

    // Interpolate ball
    let ball = to.b;
    if (from.b && to.b) {
        ball = interpolateBall(from.b, to.b, alpha);
    }

    return {
        tick: to.t,
        players,
        ball,
        scores: to.s || {},
        gamePhase: to.gp || 'playing'
    };
}

function interpolateEntity(from, to, alpha) {
    return {
        p: lerpArr(from.p, to.p, alpha),
        r: lerpAngle(from.r, to.r, alpha),
        v: lerpArr(from.v, to.v, alpha),
        vy: lerp(from.vy, to.vy, alpha),
        g: to.g,
        j: to.j,
        mb: lerp(from.mb, to.mb, alpha),
        wc: lerp(from.wc, to.wc, alpha),
        st: to.st,
        si: to.si,
        pa: to.pa,
        pp: to.pp,
        ph: to.ph,
        bl: to.bl,
        sm: to.sm,
        fa: lerpAngle(from.fa, to.fa, alpha)
    };
}

function interpolateBall(from, to, alpha) {
    return {
        p: lerpArr(from.p, to.p, alpha),
        v: lerpArr(from.v, to.v, alpha),
        h: to.h,
        dp: lerp(from.dp, to.dp, alpha),
        ss: to.ss,
        ps: to.ps,
        sl: to.sl,
        ac: to.ac
    };
}

// ─── My Slot Info ──────────────────────────────────────────

/**
 * Get which player index in the state array corresponds to this guest.
 * Home: 0=slot0, 1=slot1, 2=slot2. Away: 3=slot0, 4=slot1, 5=slot2.
 * @returns {number} index into players array, or -1 if unknown
 */
export function getMyPlayerIndex() {
    if (myTeam === 'home') return mySlot;
    if (myTeam === 'away') return 3 + mySlot;
    return -1;
}

export function getMyTeam() { return myTeam; }
export function getMySlot() { return mySlot; }
export function isGuestSyncActive() { return active; }

// ─── Math Helpers ──────────────────────────────────────────

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpArr(a, b, t) {
    const result = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        result.push(lerp(a[i], b[i], t));
    }
    return result;
}

function lerpAngle(a, b, t) {
    let diff = b - a;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}
