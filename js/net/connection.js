// ─── Hoops Royale WebSocket Connection ──────────────────────
// Wraps native WebSocket with reconnection, heartbeat, and
// message dispatch. Zero dependencies.

import * as MSG from './protocol.js';

const HEARTBEAT_INTERVAL = 25_000;  // ms between pings
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 10000]; // exponential backoff

/** @typedef {{ type: string, [key: string]: any }} NetMessage */

class Connection {
    constructor() {
        /** @type {WebSocket|null} */
        this.ws = null;
        /** @type {string|null} */
        this.sessionId = null;
        /** @type {string} */
        this.nickname = '';
        /** @type {string} */
        this.serverUrl = '';
        /** @type {boolean} */
        this.connected = false;
        /** @type {boolean} */
        this.intentionalClose = false;
        /** @type {number} */
        this.reconnectAttempt = 0;
        /** @type {number|null} */
        this._heartbeatTimer = null;
        /** @type {number|null} */
        this._reconnectTimer = null;
        /** @type {number} */
        this.latency = 0; // round-trip ms

        // Message handlers: type → callback[]
        /** @type {Map<string, Function[]>} */
        this._handlers = new Map();

        // Lifecycle callbacks
        /** @type {Function|null} */
        this.onConnect = null;
        /** @type {Function|null} */
        this.onDisconnect = null;
        /** @type {Function|null} */
        this.onError = null;
    }

    /**
     * Connect to the game server.
     * @param {string} nickname - Player display name
     * @param {string} [url] - WebSocket URL (auto-detected if omitted)
     * @returns {Promise<string>} - Resolves with sessionId on successful HELLO
     */
    connect(nickname, url) {
        return new Promise((resolve, reject) => {
            this.nickname = nickname || 'Player';
            this.intentionalClose = false;
            this.reconnectAttempt = 0;

            // Auto-detect server URL from page location
            if (!url) {
                const loc = window.location;
                const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
                url = `${protocol}//${loc.host}`;
            }
            this.serverUrl = url;

            this._openSocket(resolve, reject);
        });
    }

    /** @private */
    _openSocket(resolve, reject) {
        try {
            this.ws = new WebSocket(this.serverUrl);
        } catch (err) {
            if (reject) reject(err);
            return;
        }

        this.ws.onopen = () => {
            this.connected = true;
            this.reconnectAttempt = 0;
            this._startHeartbeat();

            // Send HELLO to establish/restore session
            const hello = { type: MSG.HELLO, nickname: this.nickname };
            if (this.sessionId) hello.sessionId = this.sessionId;
            this._send(hello);

            // Wait for HELLO response to resolve the promise
            const helloHandler = (msg) => {
                if (msg.type === MSG.HELLO) {
                    this.sessionId = msg.sessionId;
                    this.nickname = msg.nickname || this.nickname;
                    this._removeHandler(MSG.HELLO, helloHandler);
                    if (this.onConnect) this.onConnect(msg.reconnected || false);
                    if (resolve) { resolve(this.sessionId); resolve = null; }
                }
            };
            this._addHandler(MSG.HELLO, helloHandler);
        };

        this.ws.onmessage = (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }
            this._dispatch(msg);
        };

        this.ws.onclose = () => {
            this.connected = false;
            this._stopHeartbeat();

            if (this.onDisconnect) this.onDisconnect();

            if (!this.intentionalClose) {
                this._scheduleReconnect();
            }
        };

        this.ws.onerror = (err) => {
            if (this.onError) this.onError(err);
            if (reject && !this.connected) {
                reject(new Error('WebSocket connection failed'));
                reject = null;
            }
        };
    }

    /** Disconnect from the server. */
    disconnect() {
        this.intentionalClose = true;
        this._stopHeartbeat();
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    /**
     * Send a message to the server.
     * @param {NetMessage} msg
     */
    send(msg) {
        this._send(msg);
    }

    /** @private */
    _send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    /**
     * Register a handler for a specific message type.
     * @param {string} type - Message type constant
     * @param {Function} handler - Callback receiving the parsed message
     */
    on(type, handler) {
        this._addHandler(type, handler);
    }

    /**
     * Remove a handler for a specific message type.
     * @param {string} type
     * @param {Function} handler
     */
    off(type, handler) {
        this._removeHandler(type, handler);
    }

    /** @private */
    _addHandler(type, handler) {
        if (!this._handlers.has(type)) this._handlers.set(type, []);
        this._handlers.get(type).push(handler);
    }

    /** @private */
    _removeHandler(type, handler) {
        const arr = this._handlers.get(type);
        if (!arr) return;
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
    }

    /** @private */
    _dispatch(msg) {
        const handlers = this._handlers.get(msg.type);
        if (handlers) {
            for (const h of handlers) h(msg);
        }

        // PONG handling for latency measurement
        if (msg.type === MSG.PONG && msg.t) {
            this.latency = Date.now() - msg.t;
        }
    }

    // ── Heartbeat ───────────────────────────────────────
    /** @private */
    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            this._send({ type: MSG.PING, t: Date.now() });
        }, HEARTBEAT_INTERVAL);
    }

    /** @private */
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    // ── Reconnection ────────────────────────────────────
    /** @private */
    _scheduleReconnect() {
        const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        this.reconnectAttempt++;

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            if (this.intentionalClose) return;
            this._openSocket(null, null);
        }, delay);
    }
}

// Export singleton — one connection per client
const connection = new Connection();
export default connection;
