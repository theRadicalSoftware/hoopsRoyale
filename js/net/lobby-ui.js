// ─── Hoops Royale Multiplayer Lobby UI ─────────────────────
// Manages all DOM interactions for multiplayer screens:
// nickname prompt, lobby menu, waiting room, connection status.

import connection from './connection.js';
import * as MSG from './protocol.js';

// ─── State ─────────────────────────────────────────────────
let currentTab = 'quick-match';
let roomListTimer = null;
let pickupStatusTimer = null;
let isInRoom = false;
let currentRoom = null;
let mySessionId = null;
let isHost = false;
let scoreTarget = 21;
let isPublic = true;

// Callbacks set by main.js
let onGameStart = null;
let onPickupEnter = null;

// ─── DOM Refs ──────────────────────────────────────────────
const els = {};

function cacheElements() {
    // Nickname prompt
    els.nicknamePrompt = document.getElementById('nickname-prompt');
    els.nicknameInput  = document.getElementById('nickname-input');
    els.nicknameGo     = document.getElementById('nickname-go');

    // Lobby
    els.mpLobby       = document.getElementById('mp-lobby');
    els.mpStatusText  = document.getElementById('mp-status-text');
    els.mpBackBtn     = document.getElementById('mp-back-btn');

    // Tabs
    els.tabs = document.querySelectorAll('.mp-tab');
    els.panels = {
        'quick-match':  document.getElementById('panel-quick-match'),
        'create-match': document.getElementById('panel-create-match'),
        'pickup':       document.getElementById('panel-pickup'),
    };

    // Quick Match
    els.joinCodeInput   = document.getElementById('qm-join-code-input');
    els.joinCodeGo      = document.getElementById('qm-join-go');
    els.roomList        = document.getElementById('room-list');
    els.roomListRefresh = document.getElementById('room-list-refresh');

    // Create Match
    els.cmRoomName    = document.getElementById('cm-room-name');
    els.cmPublicToggle = document.getElementById('cm-public-toggle');
    els.cmScoreBtns   = document.querySelectorAll('.cm-score-btn');
    els.cmCreateBtn   = document.getElementById('cm-create-btn');

    // Pickup
    els.pickupWorldCount = document.getElementById('pickup-world-count');
    els.pickupCourtStatus = document.getElementById('pickup-court-status');
    els.pickupLobbyHome  = document.getElementById('pickup-lobby-home');
    els.pickupLobbyAway  = document.getElementById('pickup-lobby-away');
    els.pickupLobbyCountdown = document.getElementById('pickup-lobby-countdown');
    els.pickupJoinBtn    = document.getElementById('pickup-join-btn');

    // Waiting Room
    els.waitingRoom   = document.getElementById('mp-waiting-room');
    els.wrCodeValue   = document.getElementById('wr-code-value');
    els.wrCodeCopy    = document.getElementById('wr-code-copy');
    els.wrRoomName    = document.getElementById('wr-room-name');
    els.wrHomeSlots   = document.getElementById('wr-home-slots');
    els.wrAwaySlots   = document.getElementById('wr-away-slots');
    els.wrSwitchTeam  = document.getElementById('wr-switch-team');
    els.wrReadyBtn    = document.getElementById('wr-ready-btn');
    els.wrStartBtn    = document.getElementById('wr-start-btn');
    els.wrLeaveBtn    = document.getElementById('wr-leave-btn');
    els.wrChatLog     = document.getElementById('wr-chat-log');
    els.wrChatInput   = document.getElementById('wr-chat-input');
    els.wrChatSend    = document.getElementById('wr-chat-send');

    // Connection status
    els.connStatus = document.getElementById('mp-connection-status');
    els.connDot    = document.querySelector('.conn-dot');
    els.connPing   = document.getElementById('conn-ping');

    // Mode select (to show/hide)
    els.modeSelect = document.getElementById('mode-select');
}

// ─── Init (called once from main.js) ──────────────────────
export function initLobbyUI(gameStartCallback, pickupEnterCallback) {
    onGameStart = gameStartCallback;
    onPickupEnter = pickupEnterCallback || null;
    cacheElements();
    bindEvents();
    loadSavedNickname();
}

function loadSavedNickname() {
    const saved = localStorage.getItem('hr_nickname');
    if (saved && els.nicknameInput) {
        els.nicknameInput.value = saved;
    }
}

// ─── Show/Hide Screens ────────────────────────────────────
export function showNicknamePrompt() {
    els.nicknamePrompt.classList.add('active');
    setTimeout(() => els.nicknameInput.focus(), 100);
}

function hideNicknamePrompt() {
    els.nicknamePrompt.classList.remove('active');
}

function showLobby() {
    els.mpLobby.classList.add('active');
    els.mpLobby.classList.remove('fade-out');
    els.connStatus.classList.add('active');
    startRoomListPolling();
    if (currentTab === 'pickup') startPickupStatusPolling();
}

function hideLobby() {
    stopRoomListPolling();
    stopPickupStatusPolling();
    els.mpLobby.classList.add('fade-out');
    setTimeout(() => {
        els.mpLobby.classList.remove('active', 'fade-out');
    }, 500);
}

function showWaitingRoom() {
    isInRoom = true;
    els.waitingRoom.classList.add('active');
    els.waitingRoom.classList.remove('fade-out');
    hideLobby();
}

function hideWaitingRoom() {
    isInRoom = false;
    currentRoom = null;
    els.waitingRoom.classList.add('fade-out');
    setTimeout(() => {
        els.waitingRoom.classList.remove('active', 'fade-out');
    }, 500);
}

// ─── Event Binding ─────────────────────────────────────────
function bindEvents() {
    // Nickname prompt
    els.nicknameGo.addEventListener('click', handleNicknameSubmit);
    els.nicknameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleNicknameSubmit();
    });

    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Back button
    els.mpBackBtn.addEventListener('click', handleBack);

    // Quick Match
    els.joinCodeGo.addEventListener('click', handleJoinByCode);
    els.joinCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoinByCode();
    });
    els.roomListRefresh.addEventListener('click', requestRoomList);

    // Create Match
    els.cmPublicToggle.addEventListener('click', () => {
        isPublic = !isPublic;
        els.cmPublicToggle.classList.toggle('on', isPublic);
    });
    els.cmScoreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.cmScoreBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            scoreTarget = parseInt(btn.dataset.score, 10);
        });
    });
    els.cmCreateBtn.addEventListener('click', handleCreateRoom);

    // Pickup
    els.pickupJoinBtn.addEventListener('click', handleJoinPickup);

    // Waiting Room
    els.wrCodeCopy.addEventListener('click', handleCopyCode);
    els.wrSwitchTeam.addEventListener('click', handleSwitchTeam);
    els.wrReadyBtn.addEventListener('click', handleToggleReady);
    els.wrStartBtn.addEventListener('click', handleStartGame);
    els.wrLeaveBtn.addEventListener('click', handleLeaveRoom);
    els.wrChatSend.addEventListener('click', handleSendChat);
    els.wrChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendChat();
    });

    // Server message handlers
    connection.on(MSG.LIST_ROOMS, handleRoomListResponse);
    connection.on(MSG.CREATE_ROOM, handleCreateRoomResponse);
    connection.on(MSG.JOIN_ROOM, handleJoinRoomResponse);
    connection.on(MSG.ROOM_UPDATE, handleRoomUpdate);
    connection.on(MSG.CHAT, handleChatMessage);
    connection.on(MSG.ERROR, handleServerError);
    connection.on(MSG.START_GAME, handleGameStartMessage);
    connection.on(MSG.LEAVE_ROOM, handleLeaveRoomResponse);
    connection.on(MSG.DISCONNECTED, handlePlayerDisconnected);
    connection.on(MSG.PICKUP_UPDATE, handlePickupUpdate);
    connection.on(MSG.PICKUP_MATCH, handlePickupMatch);
    connection.on(MSG.PICKUP_ENTER_WORLD, handlePickupEnterWorld);

    // Connection lifecycle
    connection.onConnect = (reconnected) => {
        updateConnectionUI(true);
        if (reconnected && isInRoom) {
            addChatSystemMsg('Reconnected to server.');
        }
    };
    connection.onDisconnect = () => {
        updateConnectionUI(false);
        if (isInRoom) {
            addChatSystemMsg('Connection lost. Attempting to reconnect...');
        }
    };
}

// ─── Nickname ──────────────────────────────────────────────
async function handleNicknameSubmit() {
    const name = (els.nicknameInput.value || '').trim().slice(0, 20) || 'Player';
    localStorage.setItem('hr_nickname', name);
    hideNicknamePrompt();

    // Connect to server
    els.mpStatusText.textContent = 'Connecting...';
    try {
        mySessionId = await connection.connect(name);
        els.mpStatusText.textContent = 'Connected';
        showLobby();
    } catch (err) {
        els.mpStatusText.textContent = 'Connection failed';
        showLobby(); // Show lobby anyway so user can see error state
        addLobbyError('Could not connect to server. Make sure the server is running.');
    }
}

// ─── Tabs ──────────────────────────────────────────────────
function switchTab(tabId) {
    currentTab = tabId;
    els.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    Object.entries(els.panels).forEach(([id, panel]) => {
        panel.classList.toggle('active', id === tabId);
    });

    if (tabId === 'quick-match') {
        requestRoomList();
    }

    // Start/stop pickup status polling based on tab
    if (tabId === 'pickup') {
        startPickupStatusPolling();
    } else {
        stopPickupStatusPolling();
    }
}

// ─── Quick Match ───────────────────────────────────────────
function requestRoomList() {
    connection.send({ type: MSG.LIST_ROOMS });
}

function startRoomListPolling() {
    stopRoomListPolling();
    requestRoomList();
    roomListTimer = setInterval(requestRoomList, 4000);
}

function stopRoomListPolling() {
    if (roomListTimer) {
        clearInterval(roomListTimer);
        roomListTimer = null;
    }
}

function handleRoomListResponse(msg) {
    const rooms = msg.rooms || [];
    if (rooms.length === 0) {
        els.roomList.innerHTML = '<div class="room-list-empty">No open courts right now</div>';
        return;
    }

    els.roomList.innerHTML = rooms.map(r => `
        <div class="room-card">
            <div class="room-card-info">
                <div class="room-card-name">${escapeHtml(r.name)}</div>
                <div class="room-card-meta">${escapeHtml(r.hostNickname)} &middot; First to ${r.scoreTarget} &middot; ${r.state}</div>
            </div>
            <div class="room-card-players">${r.playerCount}/${r.maxPlayers}</div>
            <button class="room-card-join" onclick="window._mpJoinRoom('${escapeHtml(r.code)}')">${r.state === 'lobby' ? 'Join' : 'Spectate'}</button>
        </div>
    `).join('');
}

function handleJoinByCode() {
    const code = (els.joinCodeInput.value || '').trim().toUpperCase();
    if (!code || code.length < 4) return;
    connection.send({ type: MSG.JOIN_ROOM, code });
}

// Expose for inline onclick in room cards
window._mpJoinRoom = (code) => {
    connection.send({ type: MSG.JOIN_ROOM, code });
};

// ─── Create Match ──────────────────────────────────────────
function handleCreateRoom() {
    const name = (els.cmRoomName.value || '').trim().slice(0, 30);
    connection.send({
        type: MSG.CREATE_ROOM,
        name: name || undefined,
        isPublic,
        scoreTarget,
        scoringMode: 'street',      // '1s and 2s' (street) or '2s and 3s' (nba)
        makeItTakeIt: false,         // false = losers ball (default)
        shotClockEnabled: false,
        shotClockDuration: 12,
        winByTwo: true,
        mode: 'custom'
    });
}

function handleCreateRoomResponse(msg) {
    if (msg.code && msg.room) {
        currentRoom = msg.room;
        isHost = true;
        enterWaitingRoom(msg.code, msg.room);
    }
}

function handleJoinRoomResponse(msg) {
    if (msg.ok && msg.room) {
        currentRoom = msg.room;
        isHost = (msg.room.hostId === mySessionId);
        enterWaitingRoom(msg.room.code, msg.room);
    }
}

// ─── Waiting Room ──────────────────────────────────────────
function enterWaitingRoom(code, room) {
    stopRoomListPolling();
    els.wrCodeValue.textContent = code;
    els.wrRoomName.textContent = room.name || '';
    updateWaitingRoomPlayers(room);
    updateWaitingRoomButtons(room);
    showWaitingRoom();
    clearChat();
    addChatSystemMsg('Welcome to the court.');
}

function handleRoomUpdate(msg) {
    if (!msg.room) return;
    currentRoom = msg.room;
    isHost = (msg.room.hostId === mySessionId);
    updateWaitingRoomPlayers(msg.room);
    updateWaitingRoomButtons(msg.room);
}

function updateWaitingRoomPlayers(room) {
    const players = room.players || [];
    const homePlayers = players.filter(p => p.team === 'home').sort((a, b) => a.slot - b.slot);
    const awayPlayers = players.filter(p => p.team === 'away').sort((a, b) => a.slot - b.slot);

    els.wrHomeSlots.innerHTML = renderTeamSlots(homePlayers, 3, room.hostId, 'home');
    els.wrAwaySlots.innerHTML = renderTeamSlots(awayPlayers, 3, room.hostId, 'away');
}

function renderTeamSlots(players, maxSlots, hostId, team) {
    let html = '';
    for (let i = 0; i < maxSlots; i++) {
        const p = players.find(pl => pl.slot === i);
        if (p) {
            const isMe = p.sessionId === mySessionId;
            const isHostPlayer = p.sessionId === hostId;
            const readyCls = isHostPlayer ? '' : (p.ready ? 'is-ready' : 'not-ready');
            const readyText = isHostPlayer ? '' : (p.ready ? 'Ready' : 'Not Ready');
            html += `
                <div class="wr-slot${isMe ? ' is-me' : ''}">
                    <div class="wr-slot-icon">${i + 1}</div>
                    <div class="wr-slot-name">${isMe ? '&bull; ' : ''}${escapeHtml(p.nickname)}</div>
                    ${isHostPlayer ? '<span class="wr-slot-host">Host</span>' : ''}
                    ${readyText ? `<span class="wr-slot-ready ${readyCls}">${readyText}</span>` : ''}
                </div>`;
        } else {
            html += `
                <div class="wr-slot empty">
                    <div class="wr-slot-icon">${i + 1}</div>
                    <div class="wr-slot-name">AI</div>
                </div>`;
        }
    }
    return html;
}

function updateWaitingRoomButtons(room) {
    // Show start button only for host
    els.wrStartBtn.style.display = isHost ? '' : 'none';

    // Don't show ready button for host
    els.wrReadyBtn.style.display = isHost ? 'none' : '';

    // Update ready button state
    const me = (room.players || []).find(p => p.sessionId === mySessionId);
    if (me && !isHost) {
        const ready = me.ready;
        els.wrReadyBtn.textContent = ready ? 'Unready' : 'Ready';
        els.wrReadyBtn.classList.toggle('is-ready', ready);
    }

    // Enable start only if all non-host players are ready and >= 2 total
    if (isHost) {
        const players = room.players || [];
        const allReady = players.every(p => p.sessionId === room.hostId || p.ready);
        const enoughPlayers = players.length >= 2;
        els.wrStartBtn.disabled = !(allReady && enoughPlayers);
    }
}

function handleCopyCode() {
    const code = els.wrCodeValue.textContent;
    if (code && navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            els.wrCodeCopy.textContent = 'Copied!';
            setTimeout(() => { els.wrCodeCopy.textContent = 'Copy'; }, 1500);
        });
    }
}

function handleSwitchTeam() {
    connection.send({ type: MSG.SWITCH_TEAM });
}

function handleToggleReady() {
    connection.send({ type: MSG.TOGGLE_READY });
}

function handleStartGame() {
    connection.send({ type: MSG.START_GAME });
}

function handleLeaveRoom() {
    connection.send({ type: MSG.LEAVE_ROOM });
}

function handleLeaveRoomResponse(msg) {
    if (msg.ok) {
        hideWaitingRoom();
        showLobby();
    }
}

function handlePlayerDisconnected(msg) {
    if (isInRoom) {
        addChatSystemMsg(`${msg.nickname || 'A player'} disconnected.`);
    }
}

// ─── Chat ──────────────────────────────────────────────────
function handleSendChat() {
    const text = (els.wrChatInput.value || '').trim();
    if (!text) return;
    connection.send({ type: MSG.CHAT, text });
    els.wrChatInput.value = '';
}

function handleChatMessage(msg) {
    const div = document.createElement('div');
    div.className = 'wr-chat-msg';
    div.innerHTML = `<span class="chat-name">${escapeHtml(msg.from || 'Unknown')}:</span> ${escapeHtml(msg.text || '')}`;
    els.wrChatLog.appendChild(div);
    els.wrChatLog.scrollTop = els.wrChatLog.scrollHeight;
}

function addChatSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'wr-chat-msg system-msg';
    div.textContent = text;
    els.wrChatLog.appendChild(div);
    els.wrChatLog.scrollTop = els.wrChatLog.scrollHeight;
}

function clearChat() {
    els.wrChatLog.innerHTML = '';
}

// ─── Pickup ────────────────────────────────────────────────
function handleJoinPickup() {
    connection.send({ type: MSG.JOIN_PICKUP });
}

function requestPickupStatus() {
    if (connection.connected) {
        connection.send({ type: MSG.PICKUP_UPDATE });
    }
}

function startPickupStatusPolling() {
    stopPickupStatusPolling();
    requestPickupStatus();
    pickupStatusTimer = setInterval(requestPickupStatus, 3000);
}

function stopPickupStatusPolling() {
    if (pickupStatusTimer) {
        clearInterval(pickupStatusTimer);
        pickupStatusTimer = null;
    }
}

function handlePickupUpdate(msg) {
    // World player count
    const count = msg.players || 0;
    if (els.pickupWorldCount) {
        els.pickupWorldCount.textContent = count > 0 ? count : '—';
    }

    // Court status
    if (els.pickupCourtStatus) {
        if (msg.gameActive) {
            els.pickupCourtStatus.textContent = 'Live';
            els.pickupCourtStatus.className = 'pickup-stat-value game-live';
        } else {
            els.pickupCourtStatus.textContent = 'Open';
            els.pickupCourtStatus.className = 'pickup-stat-value game-waiting';
        }
    }

    // Queue fill
    const hq = msg.homeQueue || 0;
    const aq = msg.awayQueue || 0;
    if (els.pickupLobbyHome) els.pickupLobbyHome.textContent = `${hq}/3`;
    if (els.pickupLobbyAway) els.pickupLobbyAway.textContent = `${aq}/3`;

    // Countdown
    if (els.pickupLobbyCountdown) {
        if (msg.countdown > 0) {
            els.pickupLobbyCountdown.textContent = `Starting in ${msg.countdown}s`;
            els.pickupLobbyCountdown.classList.add('active');
        } else {
            els.pickupLobbyCountdown.classList.remove('active');
        }
    }
}

function handlePickupMatch(msg) {
    // Legacy handler — no longer used with immersive world
}

function handlePickupEnterWorld(msg) {
    if (!msg.ok) return;
    // Server confirmed entry into pickup world — hide lobby, enter 3D world
    hideLobby();
    els.connStatus.classList.add('active'); // keep connection indicator visible
    if (onPickupEnter) {
        onPickupEnter({ mySessionId });
    }
}

// ─── Game Start ────────────────────────────────────────────
function handleGameStartMessage(msg) {
    if (!msg.slotAssignments) return;

    // Fade out waiting room (keep connection indicator visible during gameplay)
    hideWaitingRoom();

    // Call back to main.js with all the info needed to set up the game
    if (onGameStart) {
        onGameStart({
            slotAssignments: msg.slotAssignments,
            hostId: msg.hostId,
            settings: msg.settings,
            mySessionId,
            isHost
        });
    }
}

// ─── Server Error ──────────────────────────────────────────
function handleServerError(msg) {
    const errorText = msg.message || 'Unknown error';

    if (isInRoom) {
        addChatSystemMsg(`Error: ${errorText}`);
    } else {
        addLobbyError(errorText);
    }
}

function addLobbyError(text) {
    // Brief toast-style feedback — reuse the room list area for now
    const div = document.createElement('div');
    div.className = 'room-list-empty';
    div.style.color = 'rgba(255, 130, 130, 0.72)';
    div.textContent = text;
    els.roomList.prepend(div);
    setTimeout(() => div.remove(), 4000);
}

// ─── Back Button ───────────────────────────────────────────
function handleBack() {
    hideLobby();
    connection.disconnect();
    els.connStatus.classList.remove('active');

    // Return to mode select
    els.modeSelect.style.display = '';
    els.modeSelect.classList.remove('fade-out');
}

// ─── Connection UI ─────────────────────────────────────────
function updateConnectionUI(connected) {
    els.connDot.classList.toggle('disconnected', !connected);
    if (connected) {
        startPingDisplay();
    }
}

let pingDisplayTimer = null;
function startPingDisplay() {
    if (pingDisplayTimer) clearInterval(pingDisplayTimer);
    pingDisplayTimer = setInterval(() => {
        els.connPing.textContent = `${connection.latency}ms`;
    }, 1000);
}

// ─── Utility ───────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Public API ────────────────────────────────────────────
export function getSessionId() { return mySessionId; }
export function getIsHost() { return isHost; }
export function getCurrentRoom() { return currentRoom; }
export function isConnected() { return connection.connected; }
