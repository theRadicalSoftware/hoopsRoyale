// ─── Hoops Royale Host Sync ────────────────────────────────
// Runs on the host's browser. Serializes game state at 20Hz
// and broadcasts to all guests via the relay server.
// Receives remote player inputs and provides them to main.js
// for application to the correct entity slots.

import connection from './connection.js';
import * as MSG from './protocol.js';

const BROADCAST_RATE = 50; // ms between state broadcasts (20Hz)

// ─── State ─────────────────────────────────────────────────
let active = false;
let broadcastTimer = null;
let tickNumber = 0;

// Slot → sessionId mapping (set at game start)
// { sessionId: { team: 'home'|'away', slot: 0-2, nickname } }
let slotAssignments = {};

// Remote inputs: sessionId → latest input object
const remoteInputs = new Map();

// References set by main.js
let playerDataRef = null;
let teammatesRef = null;
let opponentsRef = null;
let basketballRef = null;
let getScoresRef = null; // function returning { home, away, homeMakes, homeAttempts, awayMakes, awayAttempts }
let getGamePhaseRef = null; // function returning string

// ─── Init / Teardown ───────────────────────────────────────

/**
 * Start host sync.
 * @param {Object} opts
 * @param {Object} opts.slotAssignments - { sessionId: { team, slot, nickname } }
 * @param {Object} opts.playerData - host player data ref
 * @param {Array}  opts.teammates - teammates array ref
 * @param {Array}  opts.opponents - opponents array ref
 * @param {Object} opts.basketball - basketball data ref
 * @param {Function} opts.getScores - returns score state
 * @param {Function} opts.getGamePhase - returns game phase string
 */
export function startHostSync(opts) {
    slotAssignments = opts.slotAssignments || {};
    playerDataRef = opts.playerData;
    teammatesRef = opts.teammates;
    opponentsRef = opts.opponents;
    basketballRef = opts.basketball;
    getScoresRef = opts.getScores;
    getGamePhaseRef = opts.getGamePhase;

    active = true;
    tickNumber = 0;
    remoteInputs.clear();

    // Listen for guest inputs
    connection.on(MSG.PLAYER_INPUT, handleRemoteInput);

    // Start broadcast timer
    broadcastTimer = setInterval(broadcastState, BROADCAST_RATE);
}

export function stopHostSync() {
    active = false;
    if (broadcastTimer) {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
    }
    connection.off(MSG.PLAYER_INPUT, handleRemoteInput);
    remoteInputs.clear();
}

// ─── Remote Input Reception ────────────────────────────────

function handleRemoteInput(msg) {
    if (!msg.from) return;
    remoteInputs.set(msg.from, {
        forward:  !!msg.f,
        backward: !!msg.b,
        left:     !!msg.l,
        right:    !!msg.r,
        jump:     !!msg.j,
        actionZ:  !!msg.z,
        actionX:  !!msg.x,
        actionC:  !!msg.c,
        actionV:  !!msg.v,
        block:    !!msg.bk
    });
}

/**
 * Get the latest input for a remote player by sessionId.
 * Returns null if no input received yet.
 * @param {string} sessionId
 * @returns {Object|null}
 */
export function getRemoteInput(sessionId) {
    return remoteInputs.get(sessionId) || null;
}

/**
 * Get all slot assignments.
 * @returns {Object}
 */
export function getSlotAssignments() {
    return slotAssignments;
}

/**
 * Find which sessionId is assigned to a given team+slot.
 * @param {string} team - 'home' or 'away'
 * @param {number} slot - 0, 1, or 2
 * @returns {string|null} sessionId or null (AI slot)
 */
export function getSessionForSlot(team, slot) {
    for (const [sid, assignment] of Object.entries(slotAssignments)) {
        if (assignment.team === team && assignment.slot === slot) {
            return sid;
        }
    }
    return null;
}

// ─── State Serialization ───────────────────────────────────

function serializeEntity(pd) {
    if (!pd || !pd.group || !pd.group.visible) return null;
    const pos = pd.group.position;
    return {
        p: [round3(pos.x), round3(pos.y), round3(pos.z)],
        r: round3(pd.facingAngle || 0),
        v: [round3(pd.velocity.x), round3(pd.velocity.y || 0), round3(pd.velocity.z)],
        vy: round3(pd.velocityY || 0),
        g: pd.isGrounded,
        j: pd.isJumping,
        mb: round2(pd.moveBlend || 0),
        wc: round2(pd.walkCycle || 0),
        st: round2(pd.stunTimer || 0),
        si: round2(pd.stunIntensity || 0),
        pa: pd.punchActive || false,
        pp: pd.punchPhase || 'none',
        ph: pd.punchHand || 'left',
        bl: pd.blocking || false,
        sm: Math.round(pd.stamina || 0),
        fa: round3(pd.facingAngle || 0)
    };
}

function serializeBall(ball) {
    if (!ball || !ball.mesh) return null;
    const pos = ball.mesh.position;
    return {
        p: [round3(pos.x), round3(pos.y), round3(pos.z)],
        v: [round3(ball.velocity.x), round3(ball.velocity.y), round3(ball.velocity.z)],
        h: serializeHeldBy(ball),
        dp: round2(ball.dribblePhase || 0),
        ss: ball._shootingStance || false,
        ps: ball._passingStance || false,
        sl: ball.sleeping || false,
        ac: ball.active || false
    };
}

function serializeHeldBy(ball) {
    if (!ball.heldByPlayer || !ball.heldByPlayerData) return null;
    // Find who holds the ball by checking references
    const holder = ball.heldByPlayerData;
    if (holder === playerDataRef) return 'host';
    if (teammatesRef) {
        const tmIdx = teammatesRef.indexOf(holder);
        if (tmIdx >= 0) return `tm${tmIdx}`;
    }
    if (opponentsRef) {
        const oppIdx = opponentsRef.indexOf(holder);
        if (oppIdx >= 0) return `opp${oppIdx}`;
    }
    return null;
}

function broadcastState() {
    if (!active || !connection.connected) return;

    tickNumber++;

    // Build player array: home[0,1,2], away[0,1,2]
    const players = [];

    // Home team: slot 0 = playerData (host), slot 1-2 = teammates
    players.push(serializeEntity(playerDataRef));
    if (teammatesRef) {
        for (let i = 0; i < 2; i++) {
            players.push(serializeEntity(teammatesRef[i] || null));
        }
    } else {
        players.push(null, null);
    }

    // Away team: slot 0-2 = opponents
    if (opponentsRef) {
        for (let i = 0; i < 3; i++) {
            players.push(serializeEntity(opponentsRef[i] || null));
        }
    } else {
        players.push(null, null, null);
    }

    const scores = getScoresRef ? getScoresRef() : { h: 0, a: 0, hm: 0, ha: 0, am: 0, aa: 0 };
    const gamePhase = getGamePhaseRef ? getGamePhaseRef() : 'playing';

    const stateMsg = {
        type: MSG.GAME_STATE,
        t: tickNumber,
        b: serializeBall(basketballRef),
        p: players,
        s: scores,
        gp: gamePhase
    };

    connection.send(stateMsg);
}

// ─── Game Actions (discrete events) ────────────────────────

/**
 * Broadcast a discrete game event to all guests.
 * @param {string} action - e.g. 'score', 'oob', 'dunk', 'tipoff'
 * @param {Object} data - event-specific payload
 */
export function broadcastAction(action, data = {}) {
    if (!active || !connection.connected) return;
    connection.send({
        type: MSG.GAME_ACTION,
        action,
        data
    });
}

/**
 * Broadcast game over to all guests.
 * @param {string} winner - 'home' or 'away'
 * @param {Object} score - final score object
 */
export function broadcastGameOver(winner, score) {
    if (!active || !connection.connected) return;
    connection.send({
        type: MSG.GAME_OVER,
        winner,
        score
    });
    stopHostSync();
}

// ─── Helpers ───────────────────────────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }

export function isHostSyncActive() { return active; }
