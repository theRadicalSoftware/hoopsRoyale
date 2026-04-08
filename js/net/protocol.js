// ─── Hoops Royale Client Protocol ────────────────────────────
// Message type constants — mirrors server/protocol.js

// Lobby
export const HELLO           = 'HELLO';
export const LIST_ROOMS      = 'LIST_ROOMS';
export const CREATE_ROOM     = 'CREATE_ROOM';
export const JOIN_ROOM       = 'JOIN_ROOM';
export const LEAVE_ROOM      = 'LEAVE_ROOM';
export const SWITCH_TEAM     = 'SWITCH_TEAM';
export const TOGGLE_READY    = 'TOGGLE_READY';
export const ROOM_UPDATE     = 'ROOM_UPDATE';
export const CHAT            = 'CHAT';
export const START_GAME      = 'START_GAME';
export const KICK_PLAYER     = 'KICK_PLAYER';
export const ERROR           = 'ERROR';

// Pickup
export const JOIN_PICKUP     = 'JOIN_PICKUP';
export const LEAVE_PICKUP    = 'LEAVE_PICKUP';
export const PICKUP_UPDATE   = 'PICKUP_UPDATE';
export const PICKUP_MATCH    = 'PICKUP_MATCH';

// Game
export const PLAYER_INPUT    = 'PLAYER_INPUT';
export const GAME_STATE      = 'GAME_STATE';
export const GAME_ACTION     = 'GAME_ACTION';
export const GAME_OVER       = 'GAME_OVER';

// Pickup World
export const PICKUP_ENTER_WORLD  = 'PICKUP_ENTER_WORLD';
export const PICKUP_LEAVE_WORLD  = 'PICKUP_LEAVE_WORLD';
export const PICKUP_POSITION     = 'PICKUP_POSITION';
export const PICKUP_WORLD_STATE  = 'PICKUP_WORLD_STATE';
export const PICKUP_ZONE_ENTER   = 'PICKUP_ZONE_ENTER';
export const PICKUP_ZONE_LEAVE   = 'PICKUP_ZONE_LEAVE';

// Connection
export const PING            = 'PING';
export const PONG            = 'PONG';
export const DISCONNECTED    = 'DISCONNECTED';
export const RECONNECT       = 'RECONNECT';
