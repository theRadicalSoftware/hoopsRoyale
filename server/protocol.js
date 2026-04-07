// ─── Hoops Royale Multiplayer Protocol ──────────────────────
// Message types shared between server and client.
// Each WebSocket message is JSON: { type: MSG_TYPE, ...payload }

// ── Lobby ────────────────────────────────────────────────────
export const HELLO           = 'HELLO';           // C→S  { nickname }  →  S→C { sessionId }
export const LIST_ROOMS      = 'LIST_ROOMS';      // C→S  {}            →  S→C { rooms: [] }
export const CREATE_ROOM     = 'CREATE_ROOM';     // C→S  { name, isPublic, scoreTarget }  →  S→C { code }
export const JOIN_ROOM       = 'JOIN_ROOM';       // C→S  { code }      →  S→C { ok, room }
export const LEAVE_ROOM      = 'LEAVE_ROOM';      // C→S  {}
export const SWITCH_TEAM     = 'SWITCH_TEAM';     // C→S  {}
export const TOGGLE_READY    = 'TOGGLE_READY';    // C→S  {}
export const ROOM_UPDATE     = 'ROOM_UPDATE';     // S→C  { room }  — broadcast on any room change
export const CHAT            = 'CHAT';            // C→S  { text }  →  S→C { from, text }
export const START_GAME      = 'START_GAME';      // C→S  {}        →  S→C { slotAssignments }
export const KICK_PLAYER     = 'KICK_PLAYER';     // C→S  { targetId }
export const ERROR           = 'ERROR';           // S→C  { message }

// ── Pickup ───────────────────────────────────────────────────
export const JOIN_PICKUP     = 'JOIN_PICKUP';     // C→S  {}
export const LEAVE_PICKUP    = 'LEAVE_PICKUP';    // C→S  {}
export const PICKUP_UPDATE   = 'PICKUP_UPDATE';   // S→C  { queuePos, queueLen, court }
export const PICKUP_MATCH    = 'PICKUP_MATCH';    // S→C  { team, slot, roomCode }

// ── Game (relay) ─────────────────────────────────────────────
export const PLAYER_INPUT    = 'PLAYER_INPUT';    // C→S→Host  { f,b,l,r,j,z,x,c,v,bk }
export const GAME_STATE      = 'GAME_STATE';      // Host→S→C  { t, b, p, s, gp }
export const GAME_ACTION     = 'GAME_ACTION';     // Host→S→C  { action, data }
export const GAME_OVER       = 'GAME_OVER';       // Host→S→C  { winner, score }

// ── Connection ───────────────────────────────────────────────
export const PING            = 'PING';            // C→S  { t }
export const PONG            = 'PONG';            // S→C  { t }
export const DISCONNECTED    = 'DISCONNECTED';    // S→C  { sessionId, nickname }
export const RECONNECT       = 'RECONNECT';       // C→S  { sessionId }

// ── Helpers ──────────────────────────────────────────────────
/** Generate a random 6-character alphanumeric room code. */
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/** Generate a random session ID. */
export function generateSessionId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}
