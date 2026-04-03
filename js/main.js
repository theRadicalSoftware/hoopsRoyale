import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCourt } from './court.js';
import { createHoops } from './hoops.js';
import { createPark } from './park.js';
import { createCity } from './city.js';
import { createLighting } from './lighting.js';
import { createPlayer, updatePlayer, getPunchFistPosition, applyStun, updateStaminaBar, PUNCH_HIT_RADIUS } from './player.js';
import { createBasketball, dropBasketballAtCenter, tryPickUpBasketball, updateBasketball, shootBasketball, passBallToTarget, tryTeammateCatch, forceDropBall } from './ball.js';

// ─── Renderer ───────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ─── Scene ──────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87CEEB, 0.0025);
scene.userData.maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;

// ─── Camera ─────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(25, 12, 30);
camera.lookAt(0, 0, 0);

// ─── Camera Mode State ─────────────────────────────────────
let cameraMode = 'orbit';
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
const moveSpeed = 18;
const lookSpeed = 0.002;
let yaw = 0;
let pitch = -0.2;
let isPointerLocked = false;

// ─── Orbit Controls ────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 150;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.target.set(0, 1, 0);
controls.update();

// ─── Transparent Helpers Toggle ─────────────────────────────
let transparentHelpersVisible = true;
const transparentObjects = [];

function toggleTransparentHelpers() {
    transparentHelpersVisible = !transparentHelpersVisible;
    for (const obj of transparentObjects) {
        obj.visible = transparentHelpersVisible;
    }
    const btn = document.getElementById('toggle-transparent');
    if (btn) {
        btn.textContent = transparentHelpersVisible ? 'PANELS: ON' : 'PANELS: OFF';
        btn.style.background = transparentHelpersVisible ? 'rgba(255, 107, 53, 0.7)' : 'rgba(100, 100, 100, 0.7)';
    }
}

function collectTransparentObjects() {
    transparentObjects.length = 0;
    scene.traverse((child) => {
        if (child.userData.isTransparentHelper) {
            transparentObjects.push(child);
        }
    });
}

function collectAnimatedObjects() {
    animatedNets.length = 0;
    animatedLeaves.length = 0;
    scene.traverse((child) => {
        if (child.userData.isNet) animatedNets.push(child);
        if (child.userData.isLeaves) animatedLeaves.push(child);
    });
}

// ─── Day/Night System ───────────────────────────────────────
let isNight = false;
let dayNightTransition = 0; // 0 = day, 1 = night
let dayNightTarget = 0;
let daySkyTexture = null;
let nightSkyTexture = null;
let lightingGroup = null;
let sunMesh = null;
let moonMesh = null;
let moonGlowMesh = null;
let playerData = null;
let basketballData = null;
let pickupQueued = false;
let pickupAssistTimer = 0;
let sitToggleQueued = false;
let shootQueued = false;
let cancelShootQueued = false;
let shootingStance = false;   // true when player is in aiming/shooting stance
let shootAngle = 52;          // current launch angle in degrees
const SHOOT_ANGLE_MIN = 38;
const SHOOT_ANGLE_MAX = 70;
const SHOOT_ANGLE_SPEED = 28; // degrees per second
let shootTurnVelocity   = 0;          // current rotational velocity in stance
const SHOOT_TURN_MAX    = 1.6;        // rad/s — max aiming turn speed
const SHOOT_TURN_ACCEL  = 8.0;        // ramp-up rate (smooth start)
const SHOOT_TURN_DECEL  = 14.0;       // ramp-down rate (quick, precise stop)

// ─── Pickup Assist ───────────────────────────────────────
const PICKUP_ASSIST_DURATION = 0.24;
const PICKUP_ASSIST_RADIUS = 1.08;
const PICKUP_ASSIST_PULL = 13.0;

// ─── Dunk System ─────────────────────────────────────────
const DUNK_TRIGGER_RADIUS = 1.28;
const DUNK_MIN_HAND_HEIGHT = 2.5;
const DUNK_APPROACH_TIME = 0.16;
const DUNK_SLAM_TIME = 0.14;
const DUNK_HANG_TIME = 0.44;
const DUNK_RELEASE_TIME = 0.18;
const DUNK_BALL_RELEASE_DROP = 0.5;
const DUNK_BALL_RELEASE_SPEED_Y = -3.6;
let dunkState = null;

// ─── Opponent Dunk System ────────────────────────────────
const OPP_DUNK_APPROACH_DIST = 2.8;  // start dunk approach when this close to rim (XZ)
const OPP_DUNK_CHANCE = 0.65;         // probability opponent chooses dunk over close-range shot

// ─── Seating System ───────────────────────────────────────
const SIT_INTERACT_RADIUS = 2.0;
const SIT_ENTER_TIME = 0.26;
const SIT_EXIT_TIME = 0.22;
const SIT_ROOT_OFFSET = 0.96;
let sitState = null;

// ─── Teammate System ─────────────────────────────────────
const teammates = [];
const MAX_TEAMMATES = 3;
let passQueued = false;
let passingStance = false;
let passTargetTeammate = null;
let passingLine = null;
let passLineOpacity = 0;
const PASS_CLOSE_RADIUS = 5.0;
const PASS_LINE_FADE_IN = 8.0;
const PASS_LINE_FADE_OUT = 12.0;
const TEAMMATE_JERSEY_COLOR = 0xcc2222;
const TEAMMATE_NUMBERS = [5, 11, 32];
const TEAMMATE_COLLIDER_RADIUS = 0.44;

// ─── Teammate AI Constants ──────────────────────────────
const TM_TARGET_RIM_Z = -12.73;           // teammates attack the negative-Z rim
const TM_SHOOT_RANGE_MIN = 1.8;
const TM_SHOOT_RANGE_MAX = 9.0;
const TM_SHOOT_WINDUP = 0.45;
const TM_DUNK_APPROACH_DIST = 2.8;
const TM_DUNK_CHANCE = 0.65;
const TM_PICKUP_RADIUS = 0.65;
const TM_PUNCH_CHANCE = 0.012;
const TEAM_AI_BASE_SPEED = 0.82;

// ─── Opponent System ─────────────────────────────────────
const opponents = [];
const MAX_OPPONENTS = 3;
const OPPONENT_JERSEY_COLOR = 0x2266cc;
const OPPONENT_NUMBERS = [3, 7, 24];
const OPPONENT_COLLIDER_RADIUS = 0.44;
const OPP_AI_BASE_SPEED = 0.82;

// ─── Basic Coverage (man + help) ─────────────────────────
const DEF_ONBALL_STOP_DIST = 1.15;
const DEF_OFFBALL_GAP = 1.3;
const DEF_HELP_X_CLAMP = 4.6;
const DEF_HELP_BLEND = 0.58;
const DEF_MARK_STICK_RADIUS = 0.7;

// ─── Solo Tip-Off System ────────────────────────────────
const REFEREE_SKIN_COLOR = 0x8e6848;
const REFEREE_SHOE_COLOR = 0x1d1d1d;
const REF_BASE_SPEED = 0.74;
const COUNTDOWN_DURATION = 3;
const TIPOFF_SETUP_DURATION = 3.75;
const TIPOFF_THROW_SPEED_Y = 8.1;
const TIPOFF_THROW_LATERAL = 0.34;
const TIPOFF_MAX_CONTEST_TIME = 6.5;
const TIPOFF_OPP_JUMP_MIN_BALL_HEIGHT = 1.95;
const TIPOFF_OPP_PICKUP_RADIUS = 0.82;
const TIPOFF_OPP_REACTION_DELAY = 0.48;
const TIPOFF_OPP_CONTEST_SPEED = 0.72;

const SOLO_TIPOFF_LAYOUT = {
    player: { x: -0.58, z: 0.85, facing: Math.PI },
    contestOpponent: { x: 0.58, z: -0.85, facing: 0 },
    referee: { x: 0, z: -0.4, facing: Math.PI * 0.5 },
    refereeExit: { x: -11.0, z: 0, facing: Math.PI * 0.5 },
    teammates: [
        { x: -3.8, z: 3.4, facing: Math.PI },
        { x: 3.8, z: 3.4, facing: Math.PI }
    ],
    opponents: [
        { x: -3.8, z: -3.4, facing: 0 },
        { x: 3.8, z: -3.4, facing: 0 }
    ]
};

// ─── Shooting Power Meter ────────────────────────────────
const POWER_METER_MIN_MULT = 0.55;
const POWER_METER_MAX_MULT = 1.15;
const POWER_METER_CYCLES_PER_SEC = 1.0;
const POWER_METER_FADE_IN = 8.0;
const POWER_METER_FADE_OUT = 12.0;
const POWER_METER_LOCK_HOLD = 0.11;
let shotPowerMultiplier = 1.0;
let powerMeterPhase = 0;
let powerMeterNorm = 0;
let powerMeterOpacity = 0;
let powerMeterLockTimer = 0;
let powerMeterLockedNorm = 0;
let powerMeterLockedMult = 1.0;

// ─── Scoring ──────────────────────────────────────────────
const THREE_PT_DISTANCE = 7.24;  // three-point arc radius from rim center (meters)
const SHOT_POINTS = 2;
const SCORE_ENTRY_PLANE_PAD = 0.04;
const SCORE_CONFIRM_DROP = 0.28;
const SCORE_COOLDOWN = 0.35;
const SCORE_PENDING_MAX_TIME = 1.1;
let totalScore = 0;
let shotsMade = 0;
let shotsAttempted = 0;
let oppTotalScore = 0;
let oppShotsMade = 0;
let oppShotsAttempted = 0;
let scoreCooldown = 0;
let pendingMake = null; // { rim, elapsed }
let scorePrevBallValid = false;

// ─── Shooting Arc Visualization ─────────────────────────────
// Ball-physics constants mirrored from ball.js for trajectory prediction
const ARC_GRAVITY       = -11.5;
const ARC_RIM_HEIGHT    = 3.048;
const ARC_HALF_COURT    = 14.325;
const ARC_BB_FROM_BL    = 1.22;
const ARC_RIM_FROM_BB   = 0.15;
const ARC_RIM_RADIUS    = 0.2286;
const ARC_RELEASE_H     = 2.15;
const ARC_NUM_POINTS    = 60;
let shootingArcLine     = null;
let arcOpacity          = 0;         // animated 0→1 on stance enter
const ARC_FADE_IN_RATE  = 6.0;      // per second
const ARC_FADE_OUT_RATE = 10.0;     // per second

// ─── Ball Locator Indicators ────────────────────────────────
const BALL_BEACON_LIFT = 0.18; // lift above the top of the ball
const BALL_BEACON_BOB_AMPLITUDE = 0.03;
const BALL_BEACON_BOB_SPEED = 2.5;
const BALL_BEACON_FADE_IN = 9.0;
const BALL_BEACON_FADE_OUT = 12.0;
const BALL_RADAR_FADE_IN = 10.0;
const BALL_RADAR_FADE_OUT = 13.0;
const BALL_RADAR_MIN_DIST = 0.35;
const BALL_RADAR_ARC_LEN = Math.PI * 1.10;  // fuller 2K-style arc (~198 deg)
// RingGeometry starts at +X in XY plane; after X-rotation, "forward" (+Z) maps from -Y.
const BALL_RADAR_ARC_START = -Math.PI * 0.5 - BALL_RADAR_ARC_LEN * 0.5; // centered forward with arrow
let ballBeaconGroup = null;
let ballBeaconRing = null;
let ballBeaconCore = null;
let ballBeaconPointer = null;
let ballBeaconOpacity = 0;
let ballRadarGroup = null;
let ballRadarRing = null;
let ballRadarGlow = null;
let ballRadarStem = null;
let ballRadarArrow = null;
let ballRadarOpacity = 0;
let ballRadarTeamColorHex = -1;
const ballRadarBaseColor = new THREE.Color();

let hoopColliders = [];
let parkColliders = [];
let parkSeats = [];
let playerColliders = [];
let rimSensors = [];
const playerInput = { forward: false, backward: false, left: false, right: false, jump: false };
const shootInput = { aimUp: false, aimDown: false, turnLeft: false, turnRight: false };
let blockHeld = false;

// ─── Zero-allocation input reset helpers ────────────────────
function resetPlayerInput() { playerInput.forward = playerInput.backward = playerInput.left = playerInput.right = playerInput.jump = false; }
function resetShootInput() { shootInput.aimUp = shootInput.aimDown = shootInput.turnLeft = shootInput.turnRight = false; }
function resetMoveState() { moveState.forward = moveState.backward = moveState.left = moveState.right = moveState.up = moveState.down = false; }
const animatedNets = [];
const animatedLeaves = [];
const cachedWindowLit = [];
const cachedWindowDark = [];
const cachedLampBulbs = [];
const cachedLights = [];  // { light, role }
const cachedMoonChildren = [];  // { mesh, type: 'crater'|'halo'|'glow' }
const cachedSunChildren = [];   // child meshes of sun

// ─── Persistent carryState (avoids per-frame object allocation) ──
const _carryState = { holding: false, shooting: false, dribbling: false, dribblePhase: 0, dunking: false, hanging: false, seated: false, seatSettled: false, blocking: false };

const freeRoamForward = new THREE.Vector3();
const freeRoamRight = new THREE.Vector3();
const freeRoamVelocity = new THREE.Vector3();
const freeRoamLookDir = new THREE.Vector3();
const freeRoamLookTarget = new THREE.Vector3();
const playerCameraTarget = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const playerMoveForward = new THREE.Vector3();
const playerMoveRight = new THREE.Vector3();
const scorePrevBallPos = new THREE.Vector3();
const pickupAssistTarget = new THREE.Vector3();
const dunkTmpInward = new THREE.Vector3();
const dunkTmpRimDir = new THREE.Vector3();
const sitTargetPos = new THREE.Vector3();
const sitExitTarget = new THREE.Vector3();
const playerMoveBasis = { forward: playerMoveForward, right: playerMoveRight };
let smoothedDelta = 1 / 60;
let stabilizedElapsed = 0;
let gameStarted = false;
let matchLive = false;
let startMenuActive = false;
let gameMode = null; // 'solo' | 'freeplay'
let refereeData = null;
let tipOffState = null;
let countdownValue = 0;
let countdownTimer = 0;
const tipOffIdleInput = { forward: false, backward: false, left: false, right: false, jump: false };
const START_ORBIT_SPEED = 0.09;
const startOrbitCenter = new THREE.Vector3(0, 1.15, 0);
let startOrbitRadius = 34;
let startOrbitAngle = 0;
let startOrbitHeight = 13.5;
let startOrbitBaseAngle = 0;   // angle at the moment the menu opened
let startOrbitElapsed = 0;     // time since menu opened (drives orbit)
const startOrbitCamPos = new THREE.Vector3();  // smoothed camera position

const modeSelect = document.getElementById('mode-select');
const uiOverlay = document.getElementById('ui-overlay');
const uiButtons = document.getElementById('ui-buttons');
const controlsHint = document.getElementById('controls-hint');
const scoreHud = document.getElementById('score-hud');
const scoreHudValue = document.getElementById('score-hud-value');
const scoreHudDetail = document.getElementById('score-hud-detail');
const shotFeedback = document.getElementById('shot-feedback');
const shotFeedbackMain = document.getElementById('shot-feedback-main');
const shotFeedbackSub = document.getElementById('shot-feedback-sub');
const powerMeter = document.getElementById('power-meter');
const powerMeterMarker = document.getElementById('power-meter-marker');
const powerMeterValue = document.getElementById('power-meter-value');
const oppScoreHud = document.getElementById('opp-score-hud');
const oppScoreHudValue = document.getElementById('opp-score-hud-value');
const oppScoreHudDetail = document.getElementById('opp-score-hud-detail');
const staminaHud = document.getElementById('stamina-hud');
const staminaHudFill = document.getElementById('stamina-hud-fill');
const staminaHudValue = document.getElementById('stamina-hud-value');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const soloScoreboard = document.getElementById('solo-scoreboard');
const sbHomeScore = document.getElementById('sb-home-score');
const sbHomeDetail = document.getElementById('sb-home-detail');
const sbAwayScore = document.getElementById('sb-away-score');
const sbAwayDetail = document.getElementById('sb-away-detail');
const controlsBar = document.getElementById('controls-bar');
let _prevStaminaFrac = -1;
let shotFeedbackHideTimeout = null;

function setGameplayHudVisible(visible) {
    const method = visible ? 'remove' : 'add';
    const isSolo = gameMode === 'solo';
    const isFree = gameMode === 'freeplay';

    uiOverlay?.classList[method]('hud-hidden');
    shotFeedback?.classList[method]('hud-hidden');
    powerMeter?.classList[method]('hud-hidden');
    staminaHud?.classList[method]('hud-hidden');

    // Solo: centered scoreboard + styled controls bar, no debug buttons or old score panels
    if (isSolo) {
        uiButtons?.classList.add('hud-hidden');
        scoreHud?.classList.add('hud-hidden');
        oppScoreHud?.classList.add('hud-hidden');
        controlsHint?.classList.add('hud-hidden');
        if (soloScoreboard) soloScoreboard.style.display = visible ? 'flex' : 'none';
        if (controlsBar) controlsBar.style.opacity = visible ? '1' : '0';
    } else if (isFree) {
        // Free play: debug buttons, old score panels, old controls hint
        uiButtons?.classList[method]('hud-hidden');
        scoreHud?.classList[method]('hud-hidden');
        oppScoreHud?.classList[method]('hud-hidden');
        controlsHint?.classList[method]('hud-hidden');
        if (soloScoreboard) soloScoreboard.style.display = 'none';
        if (controlsBar) controlsBar.style.opacity = '0';
    } else {
        uiButtons?.classList[method]('hud-hidden');
        controlsHint?.classList[method]('hud-hidden');
        scoreHud?.classList[method]('hud-hidden');
        oppScoreHud?.classList[method]('hud-hidden');
    }

    if (!visible && shotFeedback) {
        shotFeedback.classList.remove('show');
        shotFeedback.setAttribute('aria-hidden', 'true');
    }
}

function setupStartMenuOrbit() {
    const dx = camera.position.x - startOrbitCenter.x;
    const dz = camera.position.z - startOrbitCenter.z;
    startOrbitRadius = THREE.MathUtils.clamp(Math.hypot(dx, dz), 20, 58);
    startOrbitBaseAngle = Math.atan2(dx, dz);
    startOrbitHeight = THREE.MathUtils.clamp(camera.position.y, 9, 24);
    startOrbitElapsed = 0;
    startOrbitCamPos.copy(camera.position);
}

function updateStartMenuCamera(delta) {
    // Drive orbit from elapsed time, not accumulated delta — eliminates frame-rate jitter
    startOrbitElapsed += delta;
    startOrbitAngle = startOrbitBaseAngle - START_ORBIT_SPEED * startOrbitElapsed;
    const yBob = Math.sin(startOrbitElapsed * 0.22) * 0.15;

    // Compute target position on the orbit circle
    const targetX = startOrbitCenter.x + Math.sin(startOrbitAngle) * startOrbitRadius;
    const targetY = startOrbitHeight + yBob;
    const targetZ = startOrbitCenter.z + Math.cos(startOrbitAngle) * startOrbitRadius;

    // Smooth toward target so micro-variations in frame timing don't cause jitter
    const smooth = 1 - Math.exp(-5.0 * delta);
    startOrbitCamPos.x += (targetX - startOrbitCamPos.x) * smooth;
    startOrbitCamPos.y += (targetY - startOrbitCamPos.y) * smooth;
    startOrbitCamPos.z += (targetZ - startOrbitCamPos.z) * smooth;

    camera.position.copy(startOrbitCamPos);
    camera.lookAt(startOrbitCenter);
}

function showModeSelect() {
    startMenuActive = true;
    gameStarted = false;
    matchLive = false;
    gameMode = null;
    blockHeld = false;
    tipOffState = null;
    if (refereeData?.group) refereeData.group.visible = false;
    if (isPointerLocked) document.exitPointerLock();
    controls.enabled = false;
    setupStartMenuOrbit();
    setGameplayHudVisible(false);
    if (soloScoreboard) soloScoreboard.style.display = 'none';
    if (controlsBar) controlsBar.style.opacity = '0';
    if (countdownOverlay) countdownOverlay.style.display = 'none';

    if (modeSelect) {
        modeSelect.style.display = 'flex';
        modeSelect.classList.remove('fade-out');
    }
}

function isSoloTipOffActive() {
    return !!tipOffState && gameStarted && !matchLive;
}

function setEntityPose(entity, pose) {
    if (!entity?.group || !pose) return;
    const groundedY = -(entity.visualGroundOffsetY || 0.265);
    entity.group.position.set(pose.x, groundedY, pose.z);
    entity.facingAngle = pose.facing;
    entity.group.rotation.y = pose.facing;
}

function resetEntityStateForTipOff(entity) {
    if (!entity) return;
    entity.velocity.set(0, 0, 0);
    entity.velocityY = 0;
    entity.isGrounded = true;
    entity.isJumping = false;
    entity.jumpPressed = false;
    entity.stunTimer = 0;
    entity.punchQueued = false;
    entity.punchActive = false;
    entity.punchPhase = 'none';
    entity.punchElapsed = 0;
    entity._dunkState = null;
    entity._shootPrep = false;
    entity._shootTimer = 0;
    entity._holdTimer = 0;
    entity._driveTarget = null;
    entity._positionTarget = null;
    entity._wanderTarget = null;
    entity._wanderPause = 0;
    entity._wanderDist = 0;
    entity._aiSitState = null;
    entity._pickupAssistActive = false;
    entity.blocking = false;
}

function createRefStripedMaterial() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1a1a1a';
    const stripeW = 8;
    for (let x = 0; x < 64; x += stripeW * 2) {
        ctx.fillRect(x, 0, stripeW, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.0 });
}

function ensureReferee() {
    if (refereeData?.group) {
        refereeData.group.visible = true;
        return refereeData;
    }
    refereeData = createPlayer(scene, {
        jerseyColor: 0x888888,
        skinColor: REFEREE_SKIN_COLOR,
        shoeColor: REFEREE_SHOE_COLOR,
        spawnPosition: { x: SOLO_TIPOFF_LAYOUT.referee.x, y: undefined, z: SOLO_TIPOFF_LAYOUT.referee.z },
        facingAngle: SOLO_TIPOFF_LAYOUT.referee.facing,
        name: 'referee',
        visible: true
    });
    refereeData.baseSpeedMultiplier = REF_BASE_SPEED;
    refereeData.speedMultiplier = REF_BASE_SPEED;
    // Apply striped material to jersey meshes (upperTorso + lowerTorso)
    const stripeMat = createRefStripedMaterial();
    refereeData.group.traverse((child) => {
        if (child.isMesh && child.material?.color) {
            const hex = child.material.color.getHex();
            if (hex === 0x888888) child.material = stripeMat;
        }
    });
    // Remove the headband (refs don't wear headbands)
    const headband = refereeData.group.children.find(c => c.geometry?.type === 'TorusGeometry');
    if (headband) headband.visible = false;
    refereeData.group.visible = true;
    return refereeData;
}

function positionBallForTipOffHold() {
    if (!basketballData || !refereeData?.group?.visible) return;
    const refPos = refereeData.group.position;
    const refGroundY = refPos.y + (refereeData.visualGroundOffsetY || 0.265);
    const facing = refereeData.facingAngle || 0;

    basketballData.mesh.visible = true;
    basketballData.active = false;
    basketballData.heldByPlayer = false;
    basketballData.heldByPlayerData = null;
    basketballData.dribblingByPlayer = false;
    basketballData._shootingStance = false;
    basketballData._passingStance = false;
    basketballData._dunkControl = false;
    basketballData._ignoreRimTimer = 0;
    basketballData._ignorePlayerTimer = 0;
    basketballData._ignorePlayerRef = null;
    basketballData._backspin = null;
    basketballData._lastShooterRef = null;
    basketballData._lastShotReleaseDistToRim = 0;
    basketballData.velocity.set(0, 0, 0);
    basketballData.sleeping = false;
    basketballData.grounded = false;
    basketballData.idleFrames = 0;
    basketballData.mesh.position.set(
        refPos.x + Math.sin(facing) * 0.18,
        refGroundY + 1.26,
        refPos.z + Math.cos(facing) * 0.18
    );
    basketballData.prevPosition.copy(basketballData.mesh.position);
}

function beginTipOffToss() {
    if (!tipOffState || !basketballData || !refereeData?.group?.visible) return;
    const refPos = refereeData.group.position;
    const refGroundY = refPos.y + (refereeData.visualGroundOffsetY || 0.265);

    basketballData.mesh.visible = true;
    basketballData.active = true;
    basketballData.heldByPlayer = false;
    basketballData.heldByPlayerData = null;
    basketballData.dribblingByPlayer = false;
    basketballData._shootingStance = false;
    basketballData._passingStance = false;
    basketballData._dunkControl = false;
    basketballData._ignoreRimTimer = 0;
    basketballData._ignorePlayerTimer = 0;
    basketballData._ignorePlayerRef = null;
    basketballData.sleeping = false;
    basketballData.grounded = false;
    basketballData.idleFrames = 0;
    basketballData.mesh.position.set(refPos.x, refGroundY + 1.55, refPos.z);
    basketballData.prevPosition.copy(basketballData.mesh.position);
    basketballData.velocity.set(
        (Math.random() - 0.5) * TIPOFF_THROW_LATERAL,
        TIPOFF_THROW_SPEED_Y,
        (Math.random() - 0.5) * TIPOFF_THROW_LATERAL
    );

    tipOffState.phase = 'contest';
    tipOffState.phaseElapsed = 0;
}

function finalizeTipOff(holder = null) {
    matchLive = true;
    tipOffState = null;

    // Referee stays visible and walks to the sideline
    if (refereeData?.group) {
        refereeData._sidelineState = {
            phase: 'walking',       // walking → idle
            target: { ...SOLO_TIPOFF_LAYOUT.refereeExit },
            idleFacing: SOLO_TIPOFF_LAYOUT.refereeExit.facing
        };
    }

    updateModeUI();

    if (holder) {
        const allyControl = holder === playerData || !!holder.isTeammate;
        showShotFeedback('Tip-Off Won', allyControl ? 'Your side controls the ball' : 'Opponents control possession');
    } else {
        showShotFeedback('Ball Live', 'Play on');
    }
}

/** Update referee walking to sideline and idling there after tip-off ends. */
function updateRefereeSideline(delta) {
    if (!refereeData?.group?.visible || !refereeData._sidelineState) return;
    const state = refereeData._sidelineState;
    const pos = refereeData.group.position;

    if (state.phase === 'walking') {
        const dx = state.target.x - pos.x;
        const dz = state.target.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.3) {
            // Arrived at sideline — stop and face the court
            state.phase = 'idle';
            refereeData.velocity.set(0, 0, 0);
            refereeData.facingAngle = state.idleFacing;
            refereeData.group.rotation.y = state.idleFacing;
            return;
        }

        // Walk toward sideline target
        const input = { forward: false, backward: false, left: false, right: false, jump: false };
        if (dz < -0.15) input.forward = true;
        if (dz > 0.15) input.backward = true;
        if (dx < -0.15) input.left = true;
        if (dx > 0.15) input.right = true;

        // Face the walk direction
        const walkAngle = Math.atan2(dx, dz);
        let angleDiff = walkAngle - (refereeData.facingAngle || 0);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        refereeData.facingAngle += angleDiff * (1 - Math.exp(-8 * delta));
        refereeData.group.rotation.y = refereeData.facingAngle;

        updatePlayer(refereeData, delta, input, null, [], null);
    } else {
        // Idle at sideline — just stand there, subtle breathing handled by updatePlayer
        const input = { forward: false, backward: false, left: false, right: false, jump: false };
        updatePlayer(refereeData, delta, input, null, [], null);
    }
}

function setupSoloTipOff() {
    if (!playerData || !basketballData) return;

    const contestOpponent = opponents[0] || null;
    if (!contestOpponent) {
        matchLive = true;
        tipOffState = null;
        dropBasketballAtCenter(basketballData);
        return;
    }

    const ref = ensureReferee();
    matchLive = false;

    setEntityPose(playerData, SOLO_TIPOFF_LAYOUT.player);
    setEntityPose(contestOpponent, SOLO_TIPOFF_LAYOUT.contestOpponent);
    setEntityPose(ref, SOLO_TIPOFF_LAYOUT.referee);

    for (let i = 0; i < teammates.length; i++) {
        const tmPose = SOLO_TIPOFF_LAYOUT.teammates[i] || { x: -4 + i * 2.1, z: 2.6, facing: Math.PI };
        setEntityPose(teammates[i], tmPose);
    }
    for (let i = 1; i < opponents.length; i++) {
        const oppPose = SOLO_TIPOFF_LAYOUT.opponents[i - 1] || { x: -4 + i * 2.0, z: -2.8, facing: 0 };
        setEntityPose(opponents[i], oppPose);
    }

    resetEntityStateForTipOff(playerData);
    for (const tm of teammates) resetEntityStateForTipOff(tm);
    for (const opp of opponents) resetEntityStateForTipOff(opp);
    resetEntityStateForTipOff(ref);

    dunkState = null;
    sitState = null;
    shootingStance = false;
    passingStance = false;
    passTargetTeammate = null;
    pickupAssistTimer = 0;
    pickupQueued = false;
    passQueued = false;
    shootQueued = false;
    cancelShootQueued = false;
    sitToggleQueued = false;
    resetShootInput();
    resetPlayerInput();
    resetPowerMeterCycle();

    tipOffState = {
        phase: 'setup',
        phaseElapsed: 0,
        contestOpponent,
        playerMark: SOLO_TIPOFF_LAYOUT.player,
        contestMark: SOLO_TIPOFF_LAYOUT.contestOpponent,
        teammateMarks: teammates.map((_, i) => SOLO_TIPOFF_LAYOUT.teammates[i] || { x: -4 + i * 2.1, z: 2.6, facing: Math.PI }),
        opponentMarks: opponents.map((_, i) => {
            if (i === 0) return SOLO_TIPOFF_LAYOUT.contestOpponent;
            return SOLO_TIPOFF_LAYOUT.opponents[i - 1] || { x: -4 + i * 2.0, z: -2.8, facing: 0 };
        }),
        refereeMark: SOLO_TIPOFF_LAYOUT.referee,
        refereeExitMark: SOLO_TIPOFF_LAYOUT.refereeExit
    };

    positionBallForTipOffHold();
    updateModeUI();
}

function updateTipOffStationaryEntity(entity, delta, mark) {
    if (!entity?.group?.visible || !mark) return;
    const input = { forward: false, backward: false, left: false, right: false, jump: false };
    const pos = entity.group.position;
    const dx = mark.x - pos.x;
    const dz = mark.z - pos.z;

    if (Math.abs(dz) > 0.09) input[dz < 0 ? 'forward' : 'backward'] = true;
    if (Math.abs(dx) > 0.09) input[dx < 0 ? 'left' : 'right'] = true;

    const turnLerp = 1 - Math.exp(-8 * delta);
    entity.facingAngle = lerpAngle(entity.facingAngle || mark.facing, mark.facing, turnLerp);
    entity.group.rotation.y = entity.facingAngle;

    const filtered = entity._collider ? playerColliders.filter(c => c !== entity._collider) : [];
    updatePlayer(entity, delta, input, null, filtered, null);
}

function updateTipOffContestOpponent(delta) {
    if (!tipOffState?.contestOpponent?.group?.visible) return;
    const opp = tipOffState.contestOpponent;

    if (tipOffState.phase === 'setup') {
        updateTipOffStationaryEntity(opp, delta, tipOffState.contestMark);
        return;
    }

    const input = { forward: false, backward: false, left: false, right: false, jump: false };
    const ballPos = basketballData?.mesh?.position;
    const oppPos = opp.group.position;
    const contestElapsed = tipOffState.phaseElapsed;
    const canReact = contestElapsed >= TIPOFF_OPP_REACTION_DELAY;

    if (ballPos && basketballData?.active && !basketballData.heldByPlayer) {
        const dx = ballPos.x - oppPos.x;
        const dz = ballPos.z - oppPos.z;
        const dist = Math.hypot(dx, dz);

        if (canReact && dist > 0.48) {
            if (dz < -0.24) input.forward = true;
            if (dz > 0.24) input.backward = true;
            if (dx < -0.24) input.left = true;
            if (dx > 0.24) input.right = true;
        }

        if (dist > 0.02) {
            const face = Math.atan2(dx, dz);
            const turnLerp = 1 - Math.exp(-12 * delta);
            opp.facingAngle = lerpAngle(opp.facingAngle || face, face, turnLerp);
            opp.group.rotation.y = opp.facingAngle;
        }

        const oppGroundY = oppPos.y + (opp.visualGroundOffsetY || 0.265);
        const ballRelY = ballPos.y - oppGroundY;
        if (
            canReact &&
            opp.isGrounded &&
            ballRelY > TIPOFF_OPP_JUMP_MIN_BALL_HEIGHT &&
            dist < 1.2 &&
            basketballData.velocity.y < 2.2
        ) {
            input.jump = true;
        }

        if (canReact && dist < TIPOFF_OPP_PICKUP_RADIUS) {
            if (tryTeammateCatch(basketballData, opp) || tryPickUpBasketball(basketballData, opp)) {
                opp._holdSeed = Math.random();
            }
        }
    }

    const filtered = opp._collider ? playerColliders.filter(c => c !== opp._collider) : [];
    const prevSpeed = opp.speedMultiplier;
    const base = opp.baseSpeedMultiplier ?? OPP_AI_BASE_SPEED;
    opp.speedMultiplier = base * TIPOFF_OPP_CONTEST_SPEED;
    updatePlayer(opp, delta, input, null, filtered, null);
    opp.speedMultiplier = prevSpeed;
}

function updateTipOffReferee(delta) {
    if (!refereeData?.group?.visible || !tipOffState) return;
    const targetMark = tipOffState.phase === 'setup' ? tipOffState.refereeMark : tipOffState.refereeExitMark;
    updateTipOffStationaryEntity(refereeData, delta, targetMark);
}

function showCountdown(num) {
    if (!countdownOverlay || !countdownNumber) return;
    countdownOverlay.style.display = 'flex';
    countdownNumber.textContent = num === 0 ? 'GO' : String(num);
    countdownNumber.classList.toggle('go', num === 0);
    countdownNumber.classList.remove('pop');
    void countdownNumber.offsetWidth; // force reflow
    countdownNumber.classList.add('pop');
}

function hideCountdown() {
    if (!countdownOverlay || !countdownNumber) return;
    countdownNumber.classList.remove('pop');
    setTimeout(() => {
        if (countdownOverlay) countdownOverlay.style.display = 'none';
    }, 350);
}

function updateTipOffState(delta) {
    if (!isSoloTipOffActive() || !tipOffState) return;
    tipOffState.phaseElapsed += delta;

    if (tipOffState.phase === 'setup') {
        positionBallForTipOffHold();
        // Drive countdown: show 3, 2, 1 during setup, then GO + toss
        const elapsed = tipOffState.phaseElapsed;
        const countdownStart = TIPOFF_SETUP_DURATION - COUNTDOWN_DURATION - 0.35;
        const timeInCountdown = elapsed - countdownStart;
        if (timeInCountdown >= 0) {
            const newVal = COUNTDOWN_DURATION - Math.floor(timeInCountdown);
            if (newVal !== countdownValue && newVal >= 1 && newVal <= COUNTDOWN_DURATION) {
                countdownValue = newVal;
                showCountdown(newVal);
            }
        }
        if (elapsed >= TIPOFF_SETUP_DURATION) {
            countdownValue = 0;
            showCountdown(0);
            setTimeout(() => hideCountdown(), 600);
            beginTipOffToss();
        }
        return;
    }

    if (tipOffState.phase !== 'contest') return;

    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData) {
        finalizeTipOff(basketballData.heldByPlayerData);
        return;
    }

    if (tipOffState.phaseElapsed >= TIPOFF_MAX_CONTEST_TIME) {
        finalizeTipOff(null);
    }
}

function startSoloGame() {
    if (!startMenuActive) return;
    startMenuActive = false;
    gameStarted = true;
    matchLive = false;
    gameMode = 'solo';
    blockHeld = false;
    countdownValue = COUNTDOWN_DURATION + 1;

    // Fade out mode select overlay
    if (modeSelect) {
        modeSelect.classList.add('fade-out');
        setTimeout(() => {
            if (modeSelect) modeSelect.style.display = 'none';
        }, 650);
    }

    // Spawn 3v3 teams
    for (let i = 0; i < 2; i++) addTeammate();
    for (let i = 0; i < 3; i++) addOpponent();

    // Build pre-game jump ball sequence
    setupSoloTipOff();

    // Switch to player camera and show HUD (slight delay masks camera transition)
    setTimeout(() => {
        switchCameraMode('player');
        setGameplayHudVisible(true);
    }, 180);
}

function startFreePlay() {
    if (!startMenuActive) return;
    startMenuActive = false;
    gameStarted = true;
    matchLive = true;
    gameMode = 'freeplay';
    blockHeld = false;

    // Fade out mode select overlay
    if (modeSelect) {
        modeSelect.classList.add('fade-out');
        setTimeout(() => {
            if (modeSelect) modeSelect.style.display = 'none';
        }, 650);
    }

    setGameplayHudVisible(true);
    switchCameraMode('orbit');
}

function toggleDayNight() {
    isNight = !isNight;
    dayNightTarget = isNight ? 1 : 0;
    const btn = document.getElementById('toggle-daynight');
    if (btn) {
        btn.textContent = isNight ? 'NIGHT' : 'DAY';
        btn.style.background = isNight ? 'rgba(30, 40, 80, 0.8)' : 'rgba(255, 180, 50, 0.7)';
    }
}

function dropBall() {
    if (!basketballData) return;
    if (isSoloTipOffActive()) {
        showShotFeedback('Jump Ball', 'Tip-off is in progress');
        return;
    }
    dunkState = null;
    pickupAssistTimer = 0;
    basketballData._dunkControl = false;
    if (playerData) playerData._pickupAssistActive = false;
    // Reset shooting/passing stance if active
    if (shootingStance) {
        shootingStance = false;
        basketballData._shootingStance = false;
        shootAngle = 52;
        shootTurnVelocity = 0;
        shootQueued = false;
        cancelShootQueued = false;
        resetShootInput();
    }
    if (passingStance) {
        passingStance = false;
        passTargetTeammate = null;
        shootTurnVelocity = 0;
        if (basketballData) basketballData._passingStance = false;
    }
    resetPowerMeterCycle();
    pendingMake = null;
    scorePrevBallValid = false;
    dropBasketballAtCenter(basketballData);

    const btn = document.getElementById('btn-balldrop');
    if (btn) {
        btn.style.background = 'rgba(255, 138, 51, 0.85)';
        setTimeout(() => {
            btn.style.background = '';
        }, 220);
    }
}

function resetPowerMeterCycle() {
    powerMeterPhase = 0;
    powerMeterNorm = 0;
    shotPowerMultiplier = POWER_METER_MIN_MULT;
    powerMeterLockTimer = 0;
}

function lockPowerMeter(multiplier) {
    const clamped = THREE.MathUtils.clamp(multiplier, POWER_METER_MIN_MULT, POWER_METER_MAX_MULT);
    shotPowerMultiplier = clamped;
    powerMeterLockedMult = clamped;
    powerMeterLockedNorm = (clamped - POWER_METER_MIN_MULT) / (POWER_METER_MAX_MULT - POWER_METER_MIN_MULT);
    powerMeterNorm = powerMeterLockedNorm;
    powerMeterLockTimer = POWER_METER_LOCK_HOLD;
}

let _prevPowerOpacity = -1;
let _prevPowerNorm = -1;
let _prevPowerMult = -1;

function updatePowerMeter(delta, active) {
    if (!powerMeter || !powerMeterMarker || !powerMeterValue) return 1.0;

    if (powerMeterLockTimer > 0) {
        powerMeterLockTimer = Math.max(0, powerMeterLockTimer - delta);
        powerMeterNorm = powerMeterLockedNorm;
        shotPowerMultiplier = powerMeterLockedMult;
    } else if (active) {
        powerMeterPhase = (powerMeterPhase + delta * POWER_METER_CYCLES_PER_SEC) % 1;
        powerMeterNorm = powerMeterPhase < 0.5 ? powerMeterPhase * 2 : 2 - powerMeterPhase * 2;
        shotPowerMultiplier = THREE.MathUtils.lerp(POWER_METER_MIN_MULT, POWER_METER_MAX_MULT, powerMeterNorm);
    } else {
        // Already at rest — skip DOM writes entirely
        if (powerMeterOpacity === 0 && _prevPowerOpacity === 0) return shotPowerMultiplier;
        resetPowerMeterCycle();
    }

    const shouldShow = active || powerMeterLockTimer > 0;
    const fadeRate = shouldShow ? POWER_METER_FADE_IN : POWER_METER_FADE_OUT;
    powerMeterOpacity += (Number(shouldShow) - powerMeterOpacity) * (1 - Math.exp(-fadeRate * delta));
    if (powerMeterOpacity < 0.004) powerMeterOpacity = 0;

    // Only write to DOM when values actually change (avoids layout thrashing)
    if (powerMeterOpacity !== _prevPowerOpacity) {
        powerMeter.style.opacity = powerMeterOpacity;
        powerMeter.setAttribute('aria-hidden', powerMeterOpacity === 0 ? 'true' : 'false');
        _prevPowerOpacity = powerMeterOpacity;
    }
    if (powerMeterNorm !== _prevPowerNorm) {
        powerMeterMarker.style.bottom = (powerMeterNorm * 100) + '%';
        _prevPowerNorm = powerMeterNorm;
    }
    if (shotPowerMultiplier !== _prevPowerMult) {
        powerMeterValue.textContent = shotPowerMultiplier.toFixed(2) + 'x';
        _prevPowerMult = shotPowerMultiplier;
    }

    return shotPowerMultiplier;
}

function updateScoreHud() {
    if (scoreHudValue) scoreHudValue.textContent = String(totalScore);
    if (scoreHudDetail) scoreHudDetail.textContent = `Makes ${shotsMade}/${shotsAttempted}`;
    if (oppScoreHudValue) oppScoreHudValue.textContent = String(oppTotalScore);
    if (oppScoreHudDetail) oppScoreHudDetail.textContent = `Makes ${oppShotsMade}/${oppShotsAttempted}`;
    // Solo scoreboard
    if (sbHomeScore) sbHomeScore.textContent = String(totalScore);
    if (sbHomeDetail) sbHomeDetail.textContent = `${shotsMade}/${shotsAttempted}`;
    if (sbAwayScore) sbAwayScore.textContent = String(oppTotalScore);
    if (sbAwayDetail) sbAwayDetail.textContent = `${oppShotsMade}/${oppShotsAttempted}`;
}

function showShotFeedback(mainText, subText) {
    if (!shotFeedback || !shotFeedbackMain || !shotFeedbackSub || !gameStarted) return;

    shotFeedbackMain.textContent = mainText;
    shotFeedbackSub.textContent = subText;
    shotFeedback.classList.remove('hud-hidden');
    shotFeedback.setAttribute('aria-hidden', 'false');

    // Restart the enter transition for repeated makes.
    shotFeedback.classList.remove('show');
    // Force reflow to ensure animation restarts.
    void shotFeedback.offsetWidth;
    shotFeedback.classList.add('show');

    if (shotFeedbackHideTimeout) clearTimeout(shotFeedbackHideTimeout);
    shotFeedbackHideTimeout = setTimeout(() => {
        shotFeedback.classList.remove('show');
        setTimeout(() => {
            if (!gameStarted) return;
            shotFeedback.classList.add('hud-hidden');
            shotFeedback.setAttribute('aria-hidden', 'true');
        }, 220);
    }, 980);
}

function refreshRimSensors() {
    rimSensors = [];
    for (const collider of hoopColliders) {
        if (!collider?.isRim) continue;
        rimSensors.push({
            x: collider.x,
            z: collider.z,
            y: (collider.yMin + collider.yMax) * 0.5,
            radius: collider.rimRingRadius || 0.2286
        });
    }
}

function registerMadeBasket(label = 'Bucket') {
    const shooter = basketballData?._lastShooterRef;
    const isOpponentShot = shooter && !shooter.isTeammate && shooter !== playerData;

    // Three-point detection: check shooter distance from rim at release time
    const releaseDist = basketballData?._lastShotReleaseDistToRim || 0;
    const points = releaseDist >= THREE_PT_DISTANCE ? SHOT_POINTS + 1 : SHOT_POINTS;
    const displayLabel = points === 3 ? 'Three!' : label;

    if (isOpponentShot) {
        oppTotalScore += points;
        oppShotsMade += 1;
        scoreCooldown = Math.max(scoreCooldown, SCORE_COOLDOWN);
        updateScoreHud();
        showShotFeedback(`OPP ${displayLabel} +${points}`, `Opp ${oppTotalScore}`);
    } else {
        totalScore += points;
        shotsMade += 1;
        scoreCooldown = Math.max(scoreCooldown, SCORE_COOLDOWN);
        updateScoreHud();
        showShotFeedback(`${displayLabel} +${points}`, `Total ${totalScore}`);
    }
}

function updateScoringSystem(delta) {
    if (scoreCooldown > 0) scoreCooldown = Math.max(0, scoreCooldown - delta);

    if (!basketballData?.active || !basketballData.mesh?.visible || rimSensors.length === 0) {
        scorePrevBallValid = false;
        pendingMake = null;
        return;
    }

    const ball = basketballData;
    if (ball.heldByPlayer) {
        scorePrevBallValid = false;
        pendingMake = null;
        return;
    }

    const curr = ball.mesh.position;
    if (!scorePrevBallValid) {
        scorePrevBallPos.copy(curr);
        scorePrevBallValid = true;
        return;
    }

    if (pendingMake) {
        pendingMake.elapsed += delta;
        const rim = pendingMake.rim;
        const radial = Math.hypot(curr.x - rim.x, curr.z - rim.z);
        const droppedThrough = curr.y <= rim.y - SCORE_CONFIRM_DROP;
        const stillCentered = radial <= rim.radius * 0.86;

        if (droppedThrough && stillCentered && ball.velocity.y < -0.1) {
            registerMadeBasket();
            pendingMake = null;
            scoreCooldown = SCORE_COOLDOWN;
        } else {
            const roseBackAbove = curr.y > rim.y + 0.24;
            const leftCylinder = radial > rim.radius * 1.24;
            if (pendingMake.elapsed > SCORE_PENDING_MAX_TIME || roseBackAbove || leftCylinder) {
                pendingMake = null;
            }
        }
    }

    if (!pendingMake && scoreCooldown <= 0) {
        for (const rim of rimSensors) {
            const prevDy = scorePrevBallPos.y - rim.y;
            const currDy = curr.y - rim.y;
            if (!(prevDy > SCORE_ENTRY_PLANE_PAD && currDy <= SCORE_ENTRY_PLANE_PAD)) continue;
            if (ball.velocity.y > -0.2) continue;

            const radial = Math.hypot(curr.x - rim.x, curr.z - rim.z);
            const entryRadius = Math.max(0.08, rim.radius - ball.radius * 0.30);
            if (radial > entryRadius) continue;

            pendingMake = { rim, elapsed: 0 };
            break;
        }
    }

    scorePrevBallPos.copy(curr);
}

function updatePickupAssist(delta) {
    if (!playerData || !basketballData || basketballData.heldByPlayer || dunkState || blockHeld || playerData.blocking) {
        pickupAssistTimer = Math.max(0, pickupAssistTimer - delta);
        if (playerData) playerData._pickupAssistActive = false;
        pickupQueued = false;
        return;
    }

    if (pickupQueued) {
        pickupAssistTimer = PICKUP_ASSIST_DURATION;
    }

    let pickedUp = false;
    if (pickupQueued || pickupAssistTimer > 0) {
        pickedUp = tryPickUpBasketball(basketballData, playerData);
    }

    if (!pickedUp && pickupAssistTimer > 0) {
        const ballPos = basketballData.mesh.position;
        const playerPos = playerData.group.position;
        const dx = ballPos.x - playerPos.x;
        const dz = ballPos.z - playerPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= PICKUP_ASSIST_RADIUS * PICKUP_ASSIST_RADIUS) {
            const groundY = playerPos.y + (playerData.visualGroundOffsetY || 0);
            const facing = playerData.facingAngle || 0;
            pickupAssistTarget.set(
                playerPos.x + Math.sin(facing) * 0.26,
                groundY + 0.94,
                playerPos.z + Math.cos(facing) * 0.26
            );

            const pull = 1 - Math.exp(-PICKUP_ASSIST_PULL * delta);
            basketballData.mesh.position.lerp(pickupAssistTarget, pull);
            basketballData.velocity.multiplyScalar(0.35);
            basketballData.sleeping = false;
            basketballData.prevPosition.copy(basketballData.mesh.position);

            pickedUp = tryPickUpBasketball(basketballData, playerData);
        }
    }

    if (pickedUp) {
        pickupAssistTimer = 0;
        playerData._pickupAssistActive = false;
    } else {
        pickupAssistTimer = Math.max(0, pickupAssistTimer - delta);
        playerData._pickupAssistActive = pickupAssistTimer > 0;
    }

    pickupQueued = false;
}

function smoothStep01(t) {
    const c = THREE.MathUtils.clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
}

function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

function findNearestSeat() {
    if (!playerData || !parkSeats.length) return null;
    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData) return null;

    const pos = playerData.group.position;
    const interactSq = SIT_INTERACT_RADIUS * SIT_INTERACT_RADIUS;
    let best = null;
    let bestScore = Infinity;

    for (const seat of parkSeats) {
        const targetY = seat.y - SIT_ROOT_OFFSET;
        const dx = seat.x - pos.x;
        const dz = seat.z - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > interactSq) continue;

        const dy = Math.abs(targetY - pos.y);
        if (dy > 1.0) continue;

        const score = distSq + dy * 0.35;
        if (score < bestScore) {
            bestScore = score;
            best = seat;
        }
    }
    return best;
}

function startSittingOnSeat(seat) {
    if (!seat || !playerData) return false;
    if ((basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData) || shootingStance || dunkState) return false;

    const targetY = seat.y - SIT_ROOT_OFFSET;
    sitTargetPos.set(seat.x, targetY, seat.z);
    sitState = {
        phase: 'enter',
        elapsed: 0,
        seat,
        startPos: playerData.group.position.clone(),
        targetPos: sitTargetPos.clone(),
        startFacing: playerData.facingAngle || 0,
        targetFacing: seat.facing || 0
    };

    playerData.velocity.set(0, 0, 0);
    playerData.velocityY = 0;
    playerData.isGrounded = true;
    playerData.isJumping = false;
    resetPlayerInput();
    resetShootInput();
    pickupAssistTimer = 0;
    pickupQueued = false;
    return true;
}

function startStandingFromSeat() {
    if (!sitState || !playerData) return false;
    const standY = -(playerData.visualGroundOffsetY || 0.265);
    const pos = playerData.group.position;
    sitExitTarget.set(pos.x, standY, pos.z);
    sitState = {
        phase: 'exit',
        elapsed: 0,
        seat: sitState.seat,
        startPos: pos.clone(),
        targetPos: sitExitTarget.clone(),
        startFacing: playerData.facingAngle || 0,
        targetFacing: playerData.facingAngle || 0
    };
    return true;
}

function updateSeating(delta) {
    if (!sitState || !playerData) return;

    const st = sitState;
    st.elapsed += delta;

    if (st.phase === 'enter') {
        const t = smoothStep01(st.elapsed / SIT_ENTER_TIME);
        playerData.group.position.lerpVectors(st.startPos, st.targetPos, t);
        playerData.facingAngle = lerpAngle(st.startFacing, st.targetFacing, t);
        playerData.group.rotation.y = playerData.facingAngle;
        if (t >= 1) {
            st.phase = 'sit';
            st.elapsed = 0;
        }
    } else if (st.phase === 'sit') {
        playerData.group.position.copy(st.targetPos);
        playerData.facingAngle = st.targetFacing;
        playerData.group.rotation.y = playerData.facingAngle;
    } else if (st.phase === 'exit') {
        const t = smoothStep01(st.elapsed / SIT_EXIT_TIME);
        playerData.group.position.lerpVectors(st.startPos, st.targetPos, t);
        playerData.facingAngle = lerpAngle(st.startFacing, st.targetFacing, t);
        playerData.group.rotation.y = playerData.facingAngle;
        if (t >= 1) {
            sitState = null;
        }
    }
}

// ─── Opponent helpers ────────────────────────────────────────
function addOpponent() {
    if (opponents.length >= MAX_OPPONENTS) return;
    if (!playerData) return;

    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;
    const idx = opponents.length;
    // Spawn on the opposite side of the court from the player
    const side = idx % 2 === 0 ? -1 : 1;
    const offset = (Math.floor(idx / 2) + 1) * 3.0;

    const opp = createPlayer(scene, {
        jerseyColor: OPPONENT_JERSEY_COLOR,
        jerseyNumber: OPPONENT_NUMBERS[idx % OPPONENT_NUMBERS.length],
        spawnPosition: { x: px + side * offset, y: undefined, z: pz + 3 },
        facingAngle: 0,
        name: 'opponent_' + idx,
        isTeammate: false,
        visible: true
    });
    opp.group.visible = true;
    opp.baseSpeedMultiplier = OPP_AI_BASE_SPEED;
    opp.speedMultiplier = OPP_AI_BASE_SPEED;

    // Add a cylinder collider for this opponent so the player can't walk through them
    const oppPos = opp.group.position;
    const collider = {
        type: 'cylinder',
        x: oppPos.x,
        z: oppPos.z,
        radius: OPPONENT_COLLIDER_RADIUS,
        yMin: oppPos.y + opp.visualGroundOffsetY,
        yMax: oppPos.y + opp.visualGroundOffsetY + 1.88,
        _isOpponentCollider: true,
        _opponentRef: opp
    };
    opp._collider = collider;
    playerColliders.push(collider);

    opponents.push(opp);
}

function updateOpponentColliders() {
    for (const opp of opponents) {
        if (!opp._collider || !opp.group.visible) continue;
        const pos = opp.group.position;
        const groundY = pos.y + (opp.visualGroundOffsetY || 0);
        opp._collider.x = pos.x;
        opp._collider.z = pos.z;
        opp._collider.yMin = groundY;
        opp._collider.yMax = groundY + 1.88;
        // Clear broadphase cache so it recomputes
        opp._collider._pbpR = undefined;
    }
}

// ── Opponent AI constants ────────────────────────────────
const OPP_PURSUE_SPEED_FACTOR = 0.85;  // slightly slower than player
const OPP_WANDER_PAUSE_MIN = 0.8;
const OPP_WANDER_PAUSE_MAX = 2.0;
const OPP_PICKUP_RADIUS = 0.65;
const OPP_HOLD_TIME_MIN = 1.5;
const OPP_HOLD_TIME_MAX = 3.5;
const OPP_PUNCH_CHANCE = 0.012;         // per-frame chance to punch when near player with ball

// ── Stamina constants ─────────────────────────────────────
const STAMINA_MAX           = 100;
const STAMINA_PUNCH_COST    = 10;
const STAMINA_SHOOT_COST    = 15;
const STAMINA_PASS_COST     = 6;
const STAMINA_DUNK_COST     = 18;
const STAMINA_BLOCK_DRAIN   = 7.2;     // per second while holding block
const STAMINA_RUN_DRAIN     = 3.0;     // per second while moving
const STAMINA_JUMP_COST     = 7;
const STAMINA_IDLE_REGEN    = 1.5;     // per second while standing
const STAMINA_SIT_REGEN     = 22.0;    // per second while seated on bench
const STAMINA_LOW_THRESH    = 20;      // below this: movement slowed
const STAMINA_EXHAUSTED     = 5;       // below this: can't punch/shoot/dunk
const STAMINA_AI_SEEK_BENCH = 22;      // AI seeks bench below this
const STAMINA_AI_LEAVE_BENCH = 85;     // AI stands up above this
const STAMINA_SPEED_PENALTY = 0.62;    // speed multiplier when depleted

/** Drain stamina from a player, clamped to 0. */
function drainStamina(pd, amount) {
    pd.stamina = Math.max(0, pd.stamina - amount);
}

/** Recover stamina for a player, clamped to max. */
function recoverStamina(pd, amount) {
    pd.stamina = Math.min(pd.maxStamina, pd.stamina + amount);
}

/** Per-frame stamina update for any player entity (drain from running, regen from idle/sitting). */
function updateStaminaForPlayer(pd, delta, isSitting) {
    // Drain stamina on jump
    if (pd._justJumped) {
        drainStamina(pd, STAMINA_JUMP_COST);
        pd._justJumped = false;
    }

    if (isSitting) {
        recoverStamina(pd, STAMINA_SIT_REGEN * delta);
    } else {
        const speed = Math.hypot(pd.velocity.x, pd.velocity.z);
        if (speed > 0.3) {
            drainStamina(pd, STAMINA_RUN_DRAIN * delta);
        } else {
            recoverStamina(pd, STAMINA_IDLE_REGEN * delta);
        }
    }
    // Speed penalty when low
    const baseSpeedMult = pd.baseSpeedMultiplier ?? 1.0;
    if (pd.stamina < STAMINA_LOW_THRESH) {
        const t = pd.stamina / STAMINA_LOW_THRESH; // 0→1
        pd.speedMultiplier = baseSpeedMult * (STAMINA_SPEED_PENALTY + (1 - STAMINA_SPEED_PENALTY) * t);
    } else {
        pd.speedMultiplier = baseSpeedMult;
    }
}

/** Update the player's stamina HUD bar (HTML). */
function updatePlayerStaminaHUD(pd) {
    if (!staminaHud || !staminaHudFill || !pd) return;
    const frac = Math.max(0, Math.min(1, pd.stamina / pd.maxStamina));
    // Skip DOM writes if unchanged (avoid layout thrash)
    const rounded = Math.round(frac * 200) / 200; // ~0.5% resolution
    if (rounded === _prevStaminaFrac) return;
    _prevStaminaFrac = rounded;

    staminaHudFill.style.width = (frac * 100) + '%';

    // Color gradient: green → yellow → orange → red
    let color;
    if (frac > 0.55)      color = '#44dd66';
    else if (frac > 0.35) color = '#d4c03c';
    else if (frac > 0.18) color = '#e08a2e';
    else                   color = '#d44040';
    staminaHudFill.style.background = `linear-gradient(90deg, ${color}, ${color}dd)`;
    staminaHudFill.style.boxShadow = `0 0 8px ${color}44`;

    staminaHudValue.textContent = Math.round(frac * 100) + '%';
}

// ── AI Sitting System (bench-seeking for stamina recovery) ──

const _aiSitLerpPos = new THREE.Vector3();

/** Find the nearest unoccupied seat for an AI player. */
function findNearestSeatForAI(pd) {
    if (!parkSeats || !parkSeats.length) return null;
    const pos = pd.group.position;
    let best = null;
    let bestDist = Infinity;
    for (const seat of parkSeats) {
        const dx = seat.x - pos.x;
        const dz = seat.z - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < bestDist) {
            // Check seat isn't occupied by another AI
            let occupied = false;
            for (const other of [...teammates, ...opponents]) {
                if (other === pd) continue;
                if (other._aiSitState && other._aiSitState.seat === seat) { occupied = true; break; }
            }
            // Also check if player is sitting here
            if (sitState && sitState.seat === seat) occupied = true;
            if (!occupied) { bestDist = distSq; best = seat; }
        }
    }
    return best;
}

/** Update AI sitting state — handles walk-to-bench, sit, stand transitions. */
function updateAISitting(pd, delta) {
    const st = pd._aiSitState;

    // Initiate bench-seek if stamina is low and not already sitting/seeking
    if (!st && pd.stamina < STAMINA_AI_SEEK_BENCH && pd.stunTimer <= 0) {
        // If holding the ball, drop it first before heading to bench
        if (basketballData?.heldByPlayer && basketballData.heldByPlayerData === pd) {
            const facing = pd.facingAngle || 0;
            forceDropBall(basketballData, Math.sin(facing), Math.cos(facing));
        }
        const seat = findNearestSeatForAI(pd);
        if (seat) {
            pd._aiSitState = { phase: 'walking', seat, elapsed: 0 };
        }
        return;
    }

    if (!st) return;

    if (st.phase === 'walking') {
        // Move toward bench seat position
        const dx = st.seat.x - pd.group.position.x;
        const dz = st.seat.z - pd.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.6) {
            // Close enough — transition to entering (lerp will bypass colliders)
            st.phase = 'entering';
            st.elapsed = 0;
            st.startPos = pd.group.position.clone();
            st.startFacing = pd.facingAngle || 0;
            pd.velocity.set(0, 0, 0);
            pd.velocityY = 0;
        }
        // Walking is handled in the AI update by setting input toward seat
        return;
    }

    if (st.phase === 'entering') {
        st.elapsed += delta;
        const t = Math.min(st.elapsed / 0.3, 1);
        const smooth = t * t * (3 - 2 * t); // smoothstep
        const targetY = st.seat.y - SIT_ROOT_OFFSET;
        _aiSitLerpPos.set(st.seat.x, targetY, st.seat.z);
        pd.group.position.lerpVectors(st.startPos, _aiSitLerpPos, smooth);
        // Lerp facing
        let targetFacing = st.seat.facing || 0;
        let diff = targetFacing - st.startFacing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        pd.facingAngle = st.startFacing + diff * smooth;
        pd.group.rotation.y = pd.facingAngle;
        if (t >= 1) {
            st.phase = 'seated';
            st.elapsed = 0;
        }
        return;
    }

    if (st.phase === 'seated') {
        // Lock position
        const targetY = st.seat.y - SIT_ROOT_OFFSET;
        pd.group.position.set(st.seat.x, targetY, st.seat.z);
        pd.facingAngle = st.seat.facing || 0;
        pd.group.rotation.y = pd.facingAngle;
        pd.velocity.set(0, 0, 0);
        pd.velocityY = 0;
        pd.isGrounded = true;

        // Stand up when recovered
        if (pd.stamina >= STAMINA_AI_LEAVE_BENCH) {
            st.phase = 'exiting';
            st.elapsed = 0;
            st.startPos = pd.group.position.clone();
        }
        return;
    }

    if (st.phase === 'exiting') {
        st.elapsed += delta;
        const t = Math.min(st.elapsed / 0.45, 1);
        const smooth = t * t * (3 - 2 * t);
        const standY = -(pd.visualGroundOffsetY || 0.265);
        // Step forward in the seat's facing direction while standing
        const stepDist = 0.8;
        const faceAngle = st.seat.facing || 0;
        const exitX = st.startPos.x + Math.sin(faceAngle) * stepDist * smooth;
        const exitZ = st.startPos.z + Math.cos(faceAngle) * stepDist * smooth;
        const exitY = st.startPos.y + (standY - st.startPos.y) * smooth;
        pd.group.position.set(exitX, exitY, exitZ);
        if (t >= 1) {
            pd._aiSitState = null;
        }
        return;
    }
}

function getActiveBallPlayers(players) {
    return players.filter((p) => p?.group?.visible && p.stunTimer <= 0 && !p._aiSitState);
}

function findClosestPlayerToPoint(players, x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const p of players) {
        if (!p?.group?.visible || p.stunTimer > 0 || p._aiSitState) continue;
        const dx = p.group.position.x - x;
        const dz = p.group.position.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
            bestDist = d;
            best = p;
        }
    }
    return best;
}

function findClosestOnBallDefender(defenders, holder) {
    if (!holder?.group?.visible) return null;
    let best = null;
    let bestDist = Infinity;
    const hx = holder.group.position.x;
    const hz = holder.group.position.z;
    for (const d of defenders) {
        if (!d?.group?.visible || d.stunTimer > 0 || d._aiSitState) continue;
        const dx = d.group.position.x - hx;
        const dz = d.group.position.z - hz;
        const distSq = dx * dx + dz * dz;
        if (distSq < bestDist) {
            bestDist = distSq;
            best = d;
        }
    }
    return best;
}

function getDefensiveMarkForPlayer(defender, defenders, offense, holder, defendRimZ) {
    if (!defender?.group?.visible || !holder?.group?.visible) return null;
    const activeDefenders = getActiveBallPlayers(defenders);
    if (!activeDefenders.length) return null;

    const onBall = findClosestOnBallDefender(activeDefenders, holder);
    if (onBall === defender) {
        return { role: 'onball', target: holder };
    }

    const offBallDefenders = activeDefenders
        .filter((d) => d !== onBall)
        .sort((a, b) => a.group.position.x - b.group.position.x);
    const offBallTargets = offense
        .filter((p) => p?.group?.visible && p.stunTimer <= 0 && !p._aiSitState && p !== holder)
        .sort((a, b) => a.group.position.x - b.group.position.x);

    const assignment = new Map();
    const used = new Set();

    for (const def of offBallDefenders) {
        let best = null;
        let bestDist = Infinity;
        for (const tgt of offBallTargets) {
            if (used.has(tgt)) continue;
            const dx = def.group.position.x - tgt.group.position.x;
            const dz = def.group.position.z - tgt.group.position.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < bestDist) {
                bestDist = distSq;
                best = tgt;
            }
        }
        if (best) {
            used.add(best);
            assignment.set(def, best);
        } else {
            assignment.set(def, holder);
        }
    }

    const assigned = assignment.get(defender) || holder;
    const aPos = assigned.group.position;
    const toRimX = -aPos.x;
    const toRimZ = defendRimZ - aPos.z;
    const len = Math.hypot(toRimX, toRimZ) || 1;
    const gap = assigned === holder ? 0.92 : DEF_OFFBALL_GAP;
    const markX = aPos.x + (toRimX / len) * gap;
    const markZ = aPos.z + (toRimZ / len) * gap;

    if (assigned === holder) {
        // Help position when no unique off-ball assignment is available.
        const hx = holder.group.position.x;
        const hz = holder.group.position.z;
        return {
            role: 'help',
            markX: THREE.MathUtils.clamp(hx * DEF_HELP_BLEND, -DEF_HELP_X_CLAMP, DEF_HELP_X_CLAMP),
            markZ: defendRimZ + (hz - defendRimZ) * DEF_HELP_BLEND,
            assigned
        };
    }

    return { role: 'deny', markX, markZ, assigned };
}

function steerInputTowardPoint(aiInput, fromPos, tx, tz, deadZone = DEF_MARK_STICK_RADIUS) {
    const dx = tx - fromPos.x;
    const dz = tz - fromPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= deadZone) return dist;

    const xTol = deadZone * 0.7;
    const zTol = deadZone * 0.7;
    if (dz < -zTol) aiInput.forward = true;
    if (dz > zTol) aiInput.backward = true;
    if (dx < -xTol) aiInput.left = true;
    if (dx > xTol) aiInput.right = true;
    return dist;
}

function updateOpponentAI(opp, delta) {
    const oppPos = opp.group.position;
    const tmInput = { forward: false, backward: false, left: false, right: false, jump: false };

    // Active dunk — run dunk animation, skip normal AI
    if (opp._dunkState) {
        if (opp.stunTimer > 0) {
            // Cancel dunk if stunned
            opp._dunkState = null;
            if (basketballData?._dunkControl && basketballData.heldByPlayerData === opp) {
                forceDropBall(basketballData, Math.sin(opp.facingAngle), Math.cos(opp.facingAngle));
            }
        } else {
            const dunking = updateOppDunk(opp, delta);
            if (dunking) {
                const ds = opp._dunkState;
                const phase = ds ? ds.phase : null;
                const oppCarry = {
                    holding: !!(ds && !ds.ballReleased), shooting: false, dribbling: false,
                    dribblePhase: 0, dunking: phase !== 'hang',
                    hanging: phase === 'hang', seated: false, seatSettled: false
                };
                opp.velocity.set(0, 0, 0);
                opp.velocityY = 0;
                opp.isGrounded = false;
                opp.isJumping = true;
                updatePlayer(opp, delta, tmInput, null, [], oppCarry);
                return;
            }
        }
    }

    // Skip AI if stunned — just run physics/animation
    if (opp.stunTimer > 0) {
        opp._aiSitState = null; // cancel sitting if stunned
        const filteredColliders = playerColliders.filter(c => c !== opp._collider);
        updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── AI sitting on bench (stamina recovery) ──
    const sit = opp._aiSitState;
    if (sit) {
        if (sit.phase === 'walking') {
            // Walk toward bench
            const dx = sit.seat.x - oppPos.x;
            const dz = sit.seat.z - oppPos.z;
            if (dz < -0.3) tmInput.forward = true;
            if (dz > 0.3) tmInput.backward = true;
            if (dx < -0.3) tmInput.left = true;
            if (dx > 0.3) tmInput.right = true;
            const filteredColliders = playerColliders.filter(c => c !== opp._collider);
            updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
        } else {
            // entering/seated/exiting — no colliders so lerp isn't blocked by bench
            const seatedCarry = { holding: false, shooting: false, dribbling: false, dribblePhase: 0,
                dunking: false, hanging: false, seated: true, seatSettled: sit.phase === 'seated' };
            updatePlayer(opp, delta, tmInput, null, [], seatedCarry);
        }
        return;
    }

    const ballFree = basketballData?.active && !basketballData.heldByPlayer;
    const oppHoldsBall = basketballData?.heldByPlayer && basketballData.heldByPlayerData === opp;

    // Target rim: opponents attack the rim at positive Z
    const OPP_TARGET_RIM_Z = 12.73;
    const OPP_DEFEND_RIM_Z = -12.73;
    const OPP_SHOOT_RANGE_MIN = 1.8;
    const OPP_SHOOT_RANGE_MAX = 9.0;
    const OPP_SHOOT_WINDUP = 0.45;

    // ── State: Opponent holds ball — dribble toward rim, shoot, or pass ──
    if (oppHoldsBall) {
        opp._holdTimer = (opp._holdTimer || 0) + delta;

        // Low stamina → drop ball and seek bench
        if (opp.stamina < STAMINA_AI_SEEK_BENCH) {
            forceDropBall(basketballData, Math.sin(opp.facingAngle), Math.cos(opp.facingAngle));
            opp._holdTimer = 0;
            const filteredColliders = playerColliders.filter(c => c !== opp._collider);
            updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
            return;
        }

        const distToRim = Math.hypot(oppPos.x, oppPos.z - OPP_TARGET_RIM_Z);
        const inShootRange = distToRim > OPP_SHOOT_RANGE_MIN && distToRim < OPP_SHOOT_RANGE_MAX;

        // Check if pressured by enemies (player or teammates)
        let nearestEnemyDist = Infinity;
        if (playerData?.group?.visible) {
            nearestEnemyDist = Math.hypot(playerData.group.position.x - oppPos.x, playerData.group.position.z - oppPos.z);
        }
        for (const tm of teammates) {
            if (!tm.group.visible || tm.stunTimer > 0) continue;
            const d = Math.hypot(tm.group.position.x - oppPos.x, tm.group.position.z - oppPos.z);
            if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
        const pressured = nearestEnemyDist < 2.5;

        // Pass to open teammate when pressured or held too long
        if ((pressured && opp._holdTimer > 0.3) || opp._holdTimer > 4.0) {
            const passTarget = findOpenOpponentForPass(opp);
            if (passTarget) {
                const tgtPos = passTarget.group.position;
                _passTargetPos.set(tgtPos.x, tgtPos.y + (passTarget.visualGroundOffsetY || 0) + 1.18, tgtPos.z);
                passBallToTarget(basketballData, opp, _passTargetPos, 'chest');
                opp._holdTimer = 0;
                opp._shootPrep = false;
                const filteredColliders = playerColliders.filter(c => c !== opp._collider);
                updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
                return;
            }
        }

        // Shooting prep phase
        if (opp._shootPrep) {
            opp._shootTimer = (opp._shootTimer || 0) + delta;
            // Face the rim
            const rimDx = 0 - oppPos.x;
            const rimDz = OPP_TARGET_RIM_Z - oppPos.z;
            const rimAngle = Math.atan2(rimDx, rimDz);
            let angleDiff = rimAngle - opp.facingAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            opp.facingAngle += angleDiff * (1 - Math.exp(-12 * delta));
            opp.group.rotation.y = opp.facingAngle;

            if (opp._shootTimer > OPP_SHOOT_WINDUP) {
                // Shoot!
                const shotAngle = 48 + Math.random() * 8;
                const shotPower = 0.88 + Math.random() * 0.18;
                basketballData._shootingStance = false;
                shootBasketball(basketballData, opp, shotAngle, shotPower);
                oppShotsAttempted += 1;
                updateScoreHud();
                drainStamina(opp, STAMINA_SHOOT_COST);
                opp._shootPrep = false;
                opp._shootTimer = 0;
                opp._holdTimer = 0;
            }

            const oppCarry = { holding: true, shooting: true, dribbling: false,
                dribblePhase: 0, dunking: false, hanging: false, seated: false, seatSettled: false };
            const filteredColliders = playerColliders.filter(c => c !== opp._collider);
            updatePlayer(opp, delta, tmInput, null, filteredColliders, oppCarry);
            return;
        }

        // Attempt dunk if very close to rim, moving, and has stamina
        if (distToRim < OPP_DUNK_APPROACH_DIST && opp._holdTimer > 0.3
            && opp.stamina >= STAMINA_DUNK_COST && !opp._dunkState) {
            // Check if a dunk rim is reachable — give the opponent a jump boost first
            const dunkRim = findOppDunkRim(opp, OPP_TARGET_RIM_Z);
            if (dunkRim && Math.random() < OPP_DUNK_CHANCE) {
                // Jump the opponent up so they reach dunk height
                opp.velocityY = 7.5;
                opp.isGrounded = false;
                opp.isJumping = true;
                startOppDunk(opp, dunkRim);
                // updateOppDunk will run on next frame (or in the dunk handler above)
                const oppCarry = { holding: true, shooting: false, dribbling: false,
                    dribblePhase: 0, dunking: true, hanging: false, seated: false, seatSettled: false };
                updatePlayer(opp, delta, tmInput, null, [], oppCarry);
                return;
            }
        }

        // Enter shooting prep if in range and not too pressured
        if (inShootRange && !pressured && opp._holdTimer > 0.5) {
            opp._shootPrep = true;
            opp._shootTimer = 0;
            basketballData._shootingStance = true;
            opp.velocity.set(0, 0, 0);
            const oppCarry = { holding: true, shooting: true, dribbling: false,
                dribblePhase: 0, dunking: false, hanging: false, seated: false, seatSettled: false };
            const filteredColliders = playerColliders.filter(c => c !== opp._collider);
            updatePlayer(opp, delta, tmInput, null, filteredColliders, oppCarry);
            return;
        }

        // Otherwise dribble toward the target rim
        const toRimDx = 0 - oppPos.x;
        const toRimDz = OPP_TARGET_RIM_Z - oppPos.z;
        // Aim for shooting range, not directly at rim
        const aimZ = OPP_TARGET_RIM_Z - 5.0;
        const aimDx = (Math.random() > 0.5 ? 3 : -3) * ((opp._holdSeed || 0.5) - 0.25);
        const atDriveTarget = opp._driveTarget && Math.hypot(opp._driveTarget.x - oppPos.x, opp._driveTarget.z - oppPos.z) < 1.0;
        if (!opp._driveTarget || opp._holdTimer < 0.05 || atDriveTarget) {
            opp._driveTarget = { x: aimDx, z: aimZ };
        }
        const drvDx = opp._driveTarget.x - oppPos.x;
        const drvDz = opp._driveTarget.z - oppPos.z;
        if (drvDz < -0.4) tmInput.forward = true;
        if (drvDz > 0.4) tmInput.backward = true;
        if (drvDx < -0.4) tmInput.left = true;
        if (drvDx > 0.4) tmInput.right = true;

        const isMoving = tmInput.forward || tmInput.backward || tmInput.left || tmInput.right;
        const oppCarry = {
            holding: true, shooting: false, dribbling: isMoving,
            dribblePhase: basketballData.dribblePhase || 0,
            dunking: false, hanging: false, seated: false, seatSettled: false
        };

        const filteredColliders = playerColliders.filter(c => c !== opp._collider);
        updatePlayer(opp, delta, tmInput, null, filteredColliders, oppCarry);
        return;
    }

    opp._holdTimer = 0;
    opp._shootPrep = false;

    // ── State: Ball is free — pursue it ──
    if (ballFree) {
        const bx = basketballData.mesh.position.x;
        const bz = basketballData.mesh.position.z;
        const dx = bx - oppPos.x;
        const dz = bz - oppPos.z;
        const dist = Math.hypot(dx, dz);
        const primaryChaser = findClosestPlayerToPoint(opponents, bx, bz);

        if (primaryChaser !== opp) {
            const offense = getActiveBallPlayers([playerData, ...teammates]);
            const pseudoHolder = findClosestPlayerToPoint(offense, bx, bz) || offense[0] || null;
            if (pseudoHolder) {
                const mark = getDefensiveMarkForPlayer(opp, opponents, offense, pseudoHolder, OPP_DEFEND_RIM_Z);
                if (mark && mark.role !== 'onball') {
                    steerInputTowardPoint(tmInput, oppPos, mark.markX, mark.markZ, DEF_MARK_STICK_RADIUS);
                }
            }
        } else {
            if (dist > OPP_PICKUP_RADIUS) {
                if (dz < -0.3) tmInput.forward = true;
                if (dz > 0.3) tmInput.backward = true;
                if (dx < -0.3) tmInput.left = true;
                if (dx > 0.3) tmInput.right = true;
            } else {
                const picked = tryPickUpBasketball(basketballData, opp);
                if (picked) {
                    opp._holdSeed = Math.random();
                }
            }
        }

        const filteredColliders = playerColliders.filter(c => c !== opp._collider);
        updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── State: Ball held by someone else ──
    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData !== opp) {
        const holder = basketballData.heldByPlayerData;
        const isEnemy = holder === playerData || (holder && holder.isTeammate);
        const isTeammateOpp = !isEnemy && holder !== opp;

        if (isTeammateOpp && holder?.group?.visible) {
            // Teammate opponent has ball — get open for a pass near the target rim
            if (!opp._positionTarget || Math.random() < 0.005) {
                const spread = (opponents.indexOf(opp) % 2 === 0) ? -4 : 4;
                opp._positionTarget = {
                    x: spread + (Math.random() - 0.5) * 3,
                    z: OPP_TARGET_RIM_Z - 5 - Math.random() * 5
                };
            }
            const ptDx = opp._positionTarget.x - oppPos.x;
            const ptDz = opp._positionTarget.z - oppPos.z;
            if (Math.hypot(ptDx, ptDz) > 1.5) {
                if (ptDz < -0.4) tmInput.forward = true;
                if (ptDz > 0.4) tmInput.backward = true;
                if (ptDx < -0.4) tmInput.left = true;
                if (ptDx > 0.4) tmInput.right = true;
            }
            const filteredColliders = playerColliders.filter(c => c !== opp._collider);
            updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
            return;
        }

        if (isEnemy && holder?.group?.visible) {
            const toHolderDx = holder.group.position.x - oppPos.x;
            const toHolderDz = holder.group.position.z - oppPos.z;
            const toHolderDist = Math.hypot(toHolderDx, toHolderDz);
            const offense = getActiveBallPlayers([playerData, ...teammates]);
            const mark = getDefensiveMarkForPlayer(opp, opponents, offense, holder, OPP_DEFEND_RIM_Z);

            if (mark?.role === 'onball') {
                if (toHolderDist > DEF_ONBALL_STOP_DIST) {
                    if (toHolderDz < -0.35) tmInput.forward = true;
                    if (toHolderDz > 0.35) tmInput.backward = true;
                    if (toHolderDx < -0.35) tmInput.left = true;
                    if (toHolderDx > 0.35) tmInput.right = true;
                }

                if (
                    toHolderDist < 1.25 &&
                    Math.random() < OPP_PUNCH_CHANCE * 0.75 &&
                    opp.stamina >= STAMINA_EXHAUSTED &&
                    !holder.blocking
                ) {
                    opp.punchQueued = true;
                    drainStamina(opp, STAMINA_PUNCH_COST);
                }
            } else if (mark) {
                steerInputTowardPoint(tmInput, oppPos, mark.markX, mark.markZ, DEF_MARK_STICK_RADIUS);
                const face = Math.atan2(holder.group.position.x - oppPos.x, holder.group.position.z - oppPos.z);
                opp.facingAngle = lerpAngle(opp.facingAngle || face, face, 1 - Math.exp(-8 * delta));
                opp.group.rotation.y = opp.facingAngle;
            } else {
                doOpponentWander(opp, delta, tmInput);
            }
        } else {
            // Another opponent has ball or holder not visible — wander
            doOpponentWander(opp, delta, tmInput);
        }

        const filteredColliders = playerColliders.filter(c => c !== opp._collider);
        updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── Default: wander around court ──
    doOpponentWander(opp, delta, tmInput);

    const filteredColliders = playerColliders.filter(c => c !== opp._collider);
    updatePlayer(opp, delta, tmInput, null, filteredColliders, null);
}

/** Find the best open opponent teammate to pass to. Returns null if none available. */
function findOpenOpponentForPass(fromOpp) {
    let best = null;
    let bestScore = -Infinity;
    for (const other of opponents) {
        if (other === fromOpp) continue;
        if (!other.group.visible || other.stunTimer > 0 || other._aiSitState) continue;

        const otherPos = other.group.position;
        // Check if enemy is nearby this potential receiver
        let nearestEnemyDist = Infinity;
        if (playerData?.group?.visible) {
            nearestEnemyDist = Math.hypot(playerData.group.position.x - otherPos.x, playerData.group.position.z - otherPos.z);
        }
        for (const tm of teammates) {
            if (!tm.group.visible) continue;
            const d = Math.hypot(tm.group.position.x - otherPos.x, tm.group.position.z - otherPos.z);
            if (d < nearestEnemyDist) nearestEnemyDist = d;
        }

        // Score: prefer receivers who are open (far from enemies) and closer to the target rim
        const openness = Math.min(nearestEnemyDist, 8);
        const rimProximity = Math.max(0, 20 - Math.hypot(otherPos.x, otherPos.z - 12.73));
        const score = openness * 2 + rimProximity;
        if (nearestEnemyDist > 2.0 && score > bestScore) {
            bestScore = score;
            best = other;
        }
    }
    return best;
}

function doOpponentWander(opp, delta, tmInput) {
    const oppPos = opp.group.position;

    if (!opp._wanderTarget || opp._wanderDist < 1.0) {
        opp._wanderTarget = {
            x: -8 + Math.random() * 16,
            z: -13 + Math.random() * 26
        };
        opp._wanderPause = OPP_WANDER_PAUSE_MIN + Math.random() * (OPP_WANDER_PAUSE_MAX - OPP_WANDER_PAUSE_MIN);
    }

    if ((opp._wanderPause || 0) > 0) {
        opp._wanderPause -= delta;
        return;
    }

    const wdx = opp._wanderTarget.x - oppPos.x;
    const wdz = opp._wanderTarget.z - oppPos.z;
    opp._wanderDist = Math.hypot(wdx, wdz);

    if (wdz < -0.5) tmInput.forward = true;
    if (wdz > 0.5) tmInput.backward = true;
    if (wdx < -0.5) tmInput.left = true;
    if (wdx > 0.5) tmInput.right = true;
}

// ─── Punch Collision Detection ──────────────────────────────
function updatePunchCollisions() {
    if (!playerData || !gameStarted) return;

    // Gather all players that exist
    const allEntities = [playerData, ...teammates, ...opponents];

    for (const attacker of allEntities) {
        if (!attacker.group.visible) continue;
        const fistPos = getPunchFistPosition(attacker);
        if (!fistPos) continue;

        // Check against every other player
        for (const target of allEntities) {
            if (target === attacker) continue;
            if (!target.group.visible) continue;
            if (target.stunTimer > 0) continue; // already stunned
            if (target.blocking) continue; // blocking negates punch hits

            const tPos = target.group.position;
            const tGroundY = tPos.y + (target.visualGroundOffsetY || 0);

            // Check if fist is near target's body (torso region)
            const dx = fistPos.x - tPos.x;
            const dz = fistPos.z - tPos.z;
            const xzDist = Math.hypot(dx, dz);
            const fistY = fistPos.y;

            // Fist must be within hit radius horizontally and within torso height vertically
            if (xzDist > PUNCH_HIT_RADIUS) continue;
            if (fistY < tGroundY + 0.5 || fistY > tGroundY + 1.8) continue;

            // Hit registered! Compute hit direction (attacker → target)
            const hitLen = Math.max(xzDist, 0.01);
            const hitDirX = dx / hitLen;
            const hitDirZ = dz / hitLen;

            // Apply stun
            applyStun(target, hitDirX, hitDirZ);
            attacker._punchHitLanded = true; // prevent multi-hit from same punch

            // Drop ball if target is holding it
            if (basketballData?.heldByPlayer && basketballData.heldByPlayerData === target) {
                // Cancel any stance
                if (target === playerData) {
                    shootingStance = false;
                    passingStance = false;
                }
                forceDropBall(basketballData, hitDirX, hitDirZ);
            }

            // Only one hit per punch swing
            break;
        }
    }
}

// ─── Teammate & Passing helpers ──────────────────────────────
const _passTargetPos = new THREE.Vector3();

function addTeammate() {
    if (teammates.length >= MAX_TEAMMATES) return;
    if (!playerData) return;

    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;
    const idx = teammates.length;
    const side = idx % 2 === 0 ? 1 : -1;
    const offset = (Math.floor(idx / 2) + 1) * 3.0;

    const tm = createPlayer(scene, {
        jerseyColor: TEAMMATE_JERSEY_COLOR,
        jerseyNumber: TEAMMATE_NUMBERS[idx % TEAMMATE_NUMBERS.length],
        spawnPosition: { x: px + side * offset, y: undefined, z: pz - 2 },
        facingAngle: Math.PI,
        name: 'teammate_' + idx,
        isTeammate: true,
        visible: true
    });
    tm.group.visible = true;
    tm.baseSpeedMultiplier = TEAM_AI_BASE_SPEED;
    tm.speedMultiplier = TEAM_AI_BASE_SPEED;

    // Add a cylinder collider so nobody walks through teammates
    const tmPos = tm.group.position;
    const collider = {
        type: 'cylinder',
        x: tmPos.x,
        z: tmPos.z,
        radius: TEAMMATE_COLLIDER_RADIUS,
        yMin: tmPos.y + tm.visualGroundOffsetY,
        yMax: tmPos.y + tm.visualGroundOffsetY + 1.88,
        _isTeammateCollider: true,
        _teammateRef: tm
    };
    tm._collider = collider;
    playerColliders.push(collider);

    teammates.push(tm);
}

function updateTeammateColliders() {
    for (const tm of teammates) {
        if (!tm._collider || !tm.group.visible) continue;
        const pos = tm.group.position;
        const groundY = pos.y + (tm.visualGroundOffsetY || 0);
        tm._collider.x = pos.x;
        tm._collider.z = pos.z;
        tm._collider.yMin = groundY;
        tm._collider.yMax = groundY + 1.88;
        tm._collider._pbpR = undefined;
    }
}

function findNearestTeammate() {
    let best = null, bestDist = Infinity;
    for (const tm of teammates) {
        if (!tm.group.visible) continue;
        const d = distToTeammate(tm);
        if (d < bestDist) { bestDist = d; best = tm; }
    }
    return best;
}

function distToTeammate(tm) {
    const dx = tm.group.position.x - playerData.group.position.x;
    const dz = tm.group.position.z - playerData.group.position.z;
    return Math.hypot(dx, dz);
}

function executePass(target, type) {
    _passTargetPos.set(target.group.position.x, getTeammateChestY(target), target.group.position.z);
    passBallToTarget(basketballData, playerData, _passTargetPos, type);
    drainStamina(playerData, STAMINA_PASS_COST);
}

function executePassAimed(powerMultiplier = 1.0) {
    // Aimed pass fires along player facing direction, scaled by power
    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;
    const groundY = playerData.group.position.y + (playerData.visualGroundOffsetY || 0);
    // Distance scaled by power: low power = short pass, high power = long pass
    const passDist = 5 + powerMultiplier * 18;
    _passTargetPos.set(px + fwdX * passDist, groundY + 1.18, pz + fwdZ * passDist);
    passBallToTarget(basketballData, playerData, _passTargetPos, 'aimed');
    drainStamina(playerData, STAMINA_PASS_COST);
}

function getTeammateChestY(tm) {
    return tm.group.position.y + (tm.visualGroundOffsetY || 0) + 1.18;
}

/** Find the best open ally (other teammate or player) to pass to.
 *  Scores by receiver openness, rim proximity, and pass-lane clearance. */
function findOpenTeammateForPass(fromTm) {
    let best = null;
    let bestScore = -Infinity;
    const fromPos = fromTm.group.position;

    // Determine how pressured the passer is — if swarmed, accept less-open targets
    let passerNearbyCount = 0;
    for (const opp of opponents) {
        if (!opp.group.visible || opp.stunTimer > 0) continue;
        if (Math.hypot(opp.group.position.x - fromPos.x, opp.group.position.z - fromPos.z) < 3.5) passerNearbyCount++;
    }
    // Lower the minimum openness threshold when passer is swarmed
    const minOpenness = passerNearbyCount >= 2 ? 1.2 : 2.0;

    function scoreTarget(targetPos) {
        let nearestEnemyDist = Infinity;
        for (const opp of opponents) {
            if (!opp.group.visible) continue;
            const d = Math.hypot(opp.group.position.x - targetPos.x, opp.group.position.z - targetPos.z);
            if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
        if (nearestEnemyDist < minOpenness) return null;

        const openness = Math.min(nearestEnemyDist, 8);
        const rimProximity = Math.max(0, 20 - Math.hypot(targetPos.x, targetPos.z - TM_TARGET_RIM_Z));

        // Penalize if an opponent is standing in the pass lane
        const passDx = targetPos.x - fromPos.x;
        const passDz = targetPos.z - fromPos.z;
        const passDist = Math.hypot(passDx, passDz);
        let lanePenalty = 0;
        if (passDist > 0.5) {
            const invD = 1 / passDist;
            const laneUx = passDx * invD;
            const laneUz = passDz * invD;
            for (const opp of opponents) {
                if (!opp.group.visible) continue;
                const ox = opp.group.position.x - fromPos.x;
                const oz = opp.group.position.z - fromPos.z;
                const proj = ox * laneUx + oz * laneUz;
                if (proj < 0.5 || proj > passDist - 0.5) continue;  // not between passer and target
                const perpDist = Math.abs(ox * laneUz - oz * laneUx);
                if (perpDist < 1.2) lanePenalty += (1.2 - perpDist) * 3;  // closer to lane = bigger penalty
            }
        }

        return openness * 2 + rimProximity - lanePenalty;
    }

    for (const other of teammates) {
        if (other === fromTm || !other.group.visible || other.stunTimer > 0 || other._aiSitState) continue;
        const score = scoreTarget(other.group.position);
        if (score !== null && score > bestScore) {
            bestScore = score;
            best = other;
        }
    }

    // Also consider the player as a pass target
    if (playerData?.group?.visible && playerData.stunTimer <= 0 && !sitState) {
        const score = scoreTarget(playerData.group.position);
        if (score !== null && score > bestScore) {
            bestScore = score;
            best = playerData;
        }
    }

    return best;
}

function doTeammateWander(tm, delta, tmInput) {
    const tmPos = tm.group.position;

    if (!tm._wanderTarget || tm._wanderDist < 1.0) {
        tm._wanderTarget = {
            x: -8 + Math.random() * 16,
            z: -13 + Math.random() * 26
        };
        tm._wanderPause = 0.3 + Math.random() * 1.0;
    }

    if ((tm._wanderPause || 0) > 0) {
        tm._wanderPause -= delta;
        return;
    }

    const wdx = tm._wanderTarget.x - tmPos.x;
    const wdz = tm._wanderTarget.z - tmPos.z;
    tm._wanderDist = Math.hypot(wdx, wdz);

    if (wdz < -0.5) tmInput.forward = true;
    if (wdz > 0.5) tmInput.backward = true;
    if (wdx < -0.5) tmInput.left = true;
    if (wdx > 0.5) tmInput.right = true;
}

// Teammate AI — full competitive behavior mirroring opponent AI
function updateTeammateAI(tm, delta) {
    const tmPos = tm.group.position;
    const tmInput = { forward: false, backward: false, left: false, right: false, jump: false };
    const filteredColliders = playerColliders.filter(c => c !== tm._collider);
    const TM_DEFEND_RIM_Z = 12.73;

    // ── Active dunk — run dunk animation, skip normal AI ──
    if (tm._dunkState) {
        if (tm.stunTimer > 0) {
            tm._dunkState = null;
            if (basketballData?._dunkControl && basketballData.heldByPlayerData === tm) {
                forceDropBall(basketballData, Math.sin(tm.facingAngle), Math.cos(tm.facingAngle));
            }
        } else {
            const dunking = updateOppDunk(tm, delta);
            if (dunking) {
                const ds = tm._dunkState;
                const phase = ds ? ds.phase : null;
                const tmCarry = {
                    holding: !!(ds && !ds.ballReleased), shooting: false, dribbling: false,
                    dribblePhase: 0, dunking: phase !== 'hang',
                    hanging: phase === 'hang', seated: false, seatSettled: false
                };
                tm.velocity.set(0, 0, 0);
                tm.velocityY = 0;
                tm.isGrounded = false;
                tm.isJumping = true;
                updatePlayer(tm, delta, tmInput, null, [], tmCarry);
                return;
            }
        }
    }

    // ── Skip AI if stunned ──
    if (tm.stunTimer > 0) {
        tm._aiSitState = null;
        updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── AI sitting on bench (stamina recovery) ──
    const sit = tm._aiSitState;
    if (sit) {
        if (sit.phase === 'walking') {
            const dx = sit.seat.x - tmPos.x;
            const dz = sit.seat.z - tmPos.z;
            if (dz < -0.3) tmInput.forward = true;
            if (dz > 0.3) tmInput.backward = true;
            if (dx < -0.3) tmInput.left = true;
            if (dx > 0.3) tmInput.right = true;
            updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
        } else {
            const seatedCarry = { holding: false, shooting: false, dribbling: false, dribblePhase: 0,
                dunking: false, hanging: false, seated: true, seatSettled: sit.phase === 'seated' };
            updatePlayer(tm, delta, tmInput, null, [], seatedCarry);
        }
        return;
    }

    const ballFree = basketballData?.active && !basketballData.heldByPlayer;
    const tmHoldsBall = basketballData?.heldByPlayer && basketballData.heldByPlayerData === tm;

    // ── State: Teammate holds ball — dribble toward rim, shoot, dunk, or pass ──
    if (tmHoldsBall) {
        tm._holdTimer = (tm._holdTimer || 0) + delta;

        // Low stamina → drop ball and seek bench
        if (tm.stamina < STAMINA_AI_SEEK_BENCH) {
            forceDropBall(basketballData, Math.sin(tm.facingAngle), Math.cos(tm.facingAngle));
            tm._holdTimer = 0;
            updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
            return;
        }

        const distToRim = Math.hypot(tmPos.x, tmPos.z - TM_TARGET_RIM_Z);
        const inShootRange = distToRim > TM_SHOOT_RANGE_MIN && distToRim < TM_SHOOT_RANGE_MAX;

        // Check if pressured by enemies (opponents) — count nearby threats
        let nearestEnemyDist = Infinity;
        let nearbyEnemyCount = 0;
        for (const opp of opponents) {
            if (!opp.group.visible || opp.stunTimer > 0) continue;
            const d = Math.hypot(opp.group.position.x - tmPos.x, opp.group.position.z - tmPos.z);
            if (d < nearestEnemyDist) nearestEnemyDist = d;
            if (d < 3.5) nearbyEnemyCount++;
        }
        const pressured = nearestEnemyDist < 2.5;
        const swarmed = nearbyEnemyCount >= 2;  // multiple defenders closing in

        // Pass to open ally when pressured/swarmed or held too long
        // Swarmed teammates pass much faster — they're about to lose the ball
        const passHoldThreshold = swarmed ? 0.12 : 0.3;
        if ((pressured && tm._holdTimer > passHoldThreshold) || (swarmed && tm._holdTimer > 0.08) || tm._holdTimer > 4.0) {
            const passTarget = findOpenTeammateForPass(tm);
            if (passTarget) {
                const tgtPos = passTarget.group.position;
                _passTargetPos.set(tgtPos.x, tgtPos.y + (passTarget.visualGroundOffsetY || 0) + 1.18, tgtPos.z);
                passBallToTarget(basketballData, tm, _passTargetPos, 'chest');
                drainStamina(tm, STAMINA_PASS_COST);
                tm._holdTimer = 0;
                tm._shootPrep = false;
                updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
                return;
            }
        }

        // Shooting prep phase
        if (tm._shootPrep) {
            tm._shootTimer = (tm._shootTimer || 0) + delta;
            // Face the rim
            const rimDx = 0 - tmPos.x;
            const rimDz = TM_TARGET_RIM_Z - tmPos.z;
            const rimAngle = Math.atan2(rimDx, rimDz);
            let angleDiff = rimAngle - tm.facingAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            tm.facingAngle += angleDiff * (1 - Math.exp(-12 * delta));
            tm.group.rotation.y = tm.facingAngle;

            if (tm._shootTimer > TM_SHOOT_WINDUP) {
                const shotAngle = 48 + Math.random() * 8;
                const shotPower = 0.88 + Math.random() * 0.18;
                basketballData._shootingStance = false;
                shootBasketball(basketballData, tm, shotAngle, shotPower);
                shotsAttempted += 1;
                updateScoreHud();
                drainStamina(tm, STAMINA_SHOOT_COST);
                tm._shootPrep = false;
                tm._shootTimer = 0;
                tm._holdTimer = 0;
            }

            const tmCarry = { holding: true, shooting: true, dribbling: false,
                dribblePhase: 0, dunking: false, hanging: false, seated: false, seatSettled: false };
            updatePlayer(tm, delta, tmInput, null, filteredColliders, tmCarry);
            return;
        }

        // Attempt dunk if very close to rim
        if (distToRim < TM_DUNK_APPROACH_DIST && tm._holdTimer > 0.3
            && tm.stamina >= STAMINA_DUNK_COST && !tm._dunkState) {
            const dunkRim = findOppDunkRim(tm, TM_TARGET_RIM_Z);
            if (dunkRim && Math.random() < TM_DUNK_CHANCE) {
                tm.velocityY = 7.5;
                tm.isGrounded = false;
                tm.isJumping = true;
                startTeammateDunk(tm, dunkRim);
                const tmCarry = { holding: true, shooting: false, dribbling: false,
                    dribblePhase: 0, dunking: true, hanging: false, seated: false, seatSettled: false };
                updatePlayer(tm, delta, tmInput, null, [], tmCarry);
                return;
            }
        }

        // Enter shooting prep if in range and not pressured
        if (inShootRange && !pressured && tm._holdTimer > 0.5) {
            tm._shootPrep = true;
            tm._shootTimer = 0;
            basketballData._shootingStance = true;
            tm.velocity.set(0, 0, 0);
            const tmCarry = { holding: true, shooting: true, dribbling: false,
                dribblePhase: 0, dunking: false, hanging: false, seated: false, seatSettled: false };
            updatePlayer(tm, delta, tmInput, null, filteredColliders, tmCarry);
            return;
        }

        // Otherwise dribble toward the target rim
        const aimZ = TM_TARGET_RIM_Z + 5.0;
        const aimDx = (Math.random() > 0.5 ? 3 : -3) * ((tm._holdSeed || 0.5) - 0.25);
        const atDriveTarget = tm._driveTarget && Math.hypot(tm._driveTarget.x - tmPos.x, tm._driveTarget.z - tmPos.z) < 1.0;
        if (!tm._driveTarget || tm._holdTimer < 0.05 || atDriveTarget) {
            tm._driveTarget = { x: aimDx, z: aimZ };
        }
        const drvDx = tm._driveTarget.x - tmPos.x;
        const drvDz = tm._driveTarget.z - tmPos.z;
        if (drvDz < -0.4) tmInput.forward = true;
        if (drvDz > 0.4) tmInput.backward = true;
        if (drvDx < -0.4) tmInput.left = true;
        if (drvDx > 0.4) tmInput.right = true;

        const isMoving = tmInput.forward || tmInput.backward || tmInput.left || tmInput.right;
        const tmCarry = {
            holding: true, shooting: false, dribbling: isMoving,
            dribblePhase: basketballData.dribblePhase || 0,
            dunking: false, hanging: false, seated: false, seatSettled: false
        };
        updatePlayer(tm, delta, tmInput, null, filteredColliders, tmCarry);
        return;
    }

    tm._holdTimer = 0;
    tm._shootPrep = false;

    // ── State: Ball is free — pursue it ──
    if (ballFree) {
        const bx = basketballData.mesh.position.x;
        const bz = basketballData.mesh.position.z;
        const dx = bx - tmPos.x;
        const dz = bz - tmPos.z;
        const dist = Math.hypot(dx, dz);
        const primaryChaser = findClosestPlayerToPoint(teammates, bx, bz);

        if (primaryChaser !== tm) {
            const offense = getActiveBallPlayers(opponents);
            const pseudoHolder = findClosestPlayerToPoint(offense, bx, bz) || offense[0] || null;
            if (pseudoHolder) {
                const mark = getDefensiveMarkForPlayer(tm, teammates, offense, pseudoHolder, TM_DEFEND_RIM_Z);
                if (mark && mark.role !== 'onball') {
                    steerInputTowardPoint(tmInput, tmPos, mark.markX, mark.markZ, DEF_MARK_STICK_RADIUS);
                }
            }
        } else {
            if (dist > TM_PICKUP_RADIUS) {
                if (dz < -0.3) tmInput.forward = true;
                if (dz > 0.3) tmInput.backward = true;
                if (dx < -0.3) tmInput.left = true;
                if (dx > 0.3) tmInput.right = true;
            } else {
                const picked = tryPickUpBasketball(basketballData, tm);
                if (picked) {
                    tm._holdSeed = Math.random();
                }
            }
        }

        updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── State: Ball held by someone else ──
    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData !== tm) {
        const holder = basketballData.heldByPlayerData;
        const isEnemy = holder && !holder.isTeammate && holder !== playerData;
        const isAlly = holder === playerData || (holder && holder.isTeammate);

        if (isAlly && holder?.group?.visible) {
            // Ally has ball — position near target rim for a pass
            if (!tm._positionTarget || Math.random() < 0.005) {
                const spread = (teammates.indexOf(tm) % 2 === 0) ? -4 : 4;
                tm._positionTarget = {
                    x: spread + (Math.random() - 0.5) * 3,
                    z: TM_TARGET_RIM_Z + 5 + Math.random() * 5
                };
            }
            const ptDx = tm._positionTarget.x - tmPos.x;
            const ptDz = tm._positionTarget.z - tmPos.z;
            if (Math.hypot(ptDx, ptDz) > 1.5) {
                if (ptDz < -0.4) tmInput.forward = true;
                if (ptDz > 0.4) tmInput.backward = true;
                if (ptDx < -0.4) tmInput.left = true;
                if (ptDx > 0.4) tmInput.right = true;
            }
            updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
            return;
        }

        if (isEnemy && holder?.group?.visible) {
            // Enemy has ball — chase aggressively, try to punch
            const toHolderDx = holder.group.position.x - tmPos.x;
            const toHolderDz = holder.group.position.z - tmPos.z;
            const toHolderDist = Math.hypot(toHolderDx, toHolderDz);
            const offense = getActiveBallPlayers(opponents);
            const mark = getDefensiveMarkForPlayer(tm, teammates, offense, holder, TM_DEFEND_RIM_Z);

            if (mark?.role === 'onball') {
                if (toHolderDist > DEF_ONBALL_STOP_DIST) {
                    if (toHolderDz < -0.35) tmInput.forward = true;
                    if (toHolderDz > 0.35) tmInput.backward = true;
                    if (toHolderDx < -0.35) tmInput.left = true;
                    if (toHolderDx > 0.35) tmInput.right = true;
                }
                if (
                    toHolderDist < 1.25 &&
                    Math.random() < TM_PUNCH_CHANCE * 0.75 &&
                    tm.stamina >= STAMINA_EXHAUSTED &&
                    !holder.blocking
                ) {
                    tm.punchQueued = true;
                    drainStamina(tm, STAMINA_PUNCH_COST);
                }
            } else if (mark) {
                steerInputTowardPoint(tmInput, tmPos, mark.markX, mark.markZ, DEF_MARK_STICK_RADIUS);
                const face = Math.atan2(holder.group.position.x - tmPos.x, holder.group.position.z - tmPos.z);
                tm.facingAngle = lerpAngle(tm.facingAngle || face, face, 1 - Math.exp(-8 * delta));
                tm.group.rotation.y = tm.facingAngle;
            } else {
                doTeammateWander(tm, delta, tmInput);
            }
        } else {
            doTeammateWander(tm, delta, tmInput);
        }

        updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
        return;
    }

    // ── Default: wander around court ──
    doTeammateWander(tm, delta, tmInput);
    updatePlayer(tm, delta, tmInput, null, filteredColliders, null);
}

// ─── Pass line visualization ──────────────────────────────────
function createPassLine() {
    const positions = new Float32Array(2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
    });
    passingLine = new THREE.Line(geometry, material);
    passingLine.visible = false;
    passingLine.frustumCulled = false;
    passingLine.renderOrder = 999;
    scene.add(passingLine);
}

function updatePassLine(delta) {
    if (passLineOpacity === 0 && !passingStance) {
        if (passingLine) passingLine.visible = false;
        return;
    }

    const targetOp = passingStance ? 0.5 : 0;
    const rate = passingStance ? PASS_LINE_FADE_IN : PASS_LINE_FADE_OUT;
    passLineOpacity += (targetOp - passLineOpacity) * (1 - Math.exp(-rate * delta));
    if (passLineOpacity < 0.005) { passLineOpacity = 0; }

    if (!passingLine || passLineOpacity === 0) {
        if (passingLine) passingLine.visible = false;
        return;
    }

    passingLine.visible = true;
    passingLine.material.opacity = passLineOpacity;

    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const pp = playerData.group.position;
    const groundY = pp.y + (playerData.visualGroundOffsetY || 0);
    const releaseY = groundY + 1.18;

    const pos = passingLine.geometry.attributes.position;
    // Start point: player's chest
    pos.array[0] = pp.x + fwdX * 0.3;
    pos.array[1] = releaseY;
    pos.array[2] = pp.z + fwdZ * 0.3;
    // End point: extend along facing direction
    const lineLen = 25;
    pos.array[3] = pp.x + fwdX * lineLen;
    pos.array[4] = releaseY;
    pos.array[5] = pp.z + fwdZ * lineLen;
    pos.needsUpdate = true;
}

function getRadarTeamColorHex(pd) {
    if (typeof pd?.jerseyColor === 'number') return pd.jerseyColor;
    if (pd?.isTeammate === false) return OPPONENT_JERSEY_COLOR;
    return TEAMMATE_JERSEY_COLOR;
}

function syncRadarTeamColor(pd) {
    if (!ballRadarRing || !ballRadarGlow || !ballRadarStem || !ballRadarArrow) return;
    const nextHex = getRadarTeamColorHex(pd);
    if (nextHex === ballRadarTeamColorHex) return;
    ballRadarTeamColorHex = nextHex;

    ballRadarBaseColor.setHex(nextHex);
    ballRadarRing.material.color.copy(ballRadarBaseColor);
    ballRadarGlow.material.color.copy(ballRadarBaseColor);
    ballRadarStem.material.color.copy(ballRadarBaseColor);
    ballRadarArrow.material.color.copy(ballRadarBaseColor);
}

function createBallLocatorIndicators() {
    // Floating beacon above the ball
    ballBeaconGroup = new THREE.Group();

    const beaconRingMat = new THREE.MeshBasicMaterial({
        color: 0xff4d63,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    ballBeaconRing = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.18, 36), beaconRingMat);
    ballBeaconRing.rotation.x = -Math.PI / 2;
    ballBeaconGroup.add(ballBeaconRing);

    const beaconCoreMat = new THREE.MeshBasicMaterial({
        color: 0xff95a2,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    ballBeaconCore = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), beaconCoreMat);
    ballBeaconCore.rotation.x = -Math.PI / 2;
    ballBeaconCore.position.y = 0.002;
    ballBeaconGroup.add(ballBeaconCore);

    const beaconPointerMat = new THREE.MeshBasicMaterial({
        color: 0xff6e7f,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });
    ballBeaconPointer = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.13, 14), beaconPointerMat);
    ballBeaconPointer.rotation.x = Math.PI;
    ballBeaconPointer.position.y = -0.09;
    ballBeaconGroup.add(ballBeaconPointer);

    ballBeaconGroup.visible = false;
    scene.add(ballBeaconGroup);

    // One-third ring radar + arrow pointer around player feet
    ballRadarGroup = new THREE.Group();

    const radarRingMat = new THREE.MeshBasicMaterial({
        color: TEAMMATE_JERSEY_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    ballRadarRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.66, 64, 1, BALL_RADAR_ARC_START, BALL_RADAR_ARC_LEN),
        radarRingMat
    );
    ballRadarRing.rotation.x = -Math.PI / 2;
    ballRadarRing.position.y = 0.026;
    ballRadarRing.renderOrder = 995;
    ballRadarGroup.add(ballRadarRing);

    const radarGlowMat = new THREE.MeshBasicMaterial({
        color: TEAMMATE_JERSEY_COLOR,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    ballRadarGlow = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.74, 64, 1, BALL_RADAR_ARC_START, BALL_RADAR_ARC_LEN),
        radarGlowMat
    );
    ballRadarGlow.rotation.x = -Math.PI / 2;
    ballRadarGlow.position.y = 0.025;
    ballRadarGlow.renderOrder = 994;
    ballRadarGroup.add(ballRadarGlow);

    const radarStemMat = new THREE.MeshBasicMaterial({
        color: TEAMMATE_JERSEY_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
    });
    ballRadarStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.19, 10), radarStemMat);
    ballRadarStem.rotation.x = Math.PI / 2;
    ballRadarStem.position.set(0, 0.03, 0.60);
    ballRadarStem.renderOrder = 996;
    ballRadarGroup.add(ballRadarStem);

    const radarArrowMat = new THREE.MeshBasicMaterial({
        color: TEAMMATE_JERSEY_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
    });
    ballRadarArrow = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.21, 3), radarArrowMat);
    ballRadarArrow.rotation.x = Math.PI / 2;
    ballRadarArrow.position.set(0, 0.032, 0.73);
    ballRadarArrow.renderOrder = 997;
    ballRadarGroup.add(ballRadarArrow);

    ballRadarGroup.visible = false;
    scene.add(ballRadarGroup);
    syncRadarTeamColor(playerData);
}

function updateBallLocatorIndicators(delta) {
    if (!ballBeaconGroup || !ballRadarGroup || !basketballData) return;
    if (playerData) syncRadarTeamColor(playerData);

    const ballActive = !!(basketballData.active && basketballData.mesh?.visible);
    const playerVisible = !!(playerData?.group?.visible);
    const playerHasBall = !!(basketballData.heldByPlayer && basketballData.heldByPlayerData === playerData);

    const showBeacon = gameStarted && !startMenuActive && ballActive && !playerHasBall;
    const showRadar = gameStarted && !startMenuActive && cameraMode === 'player'
        && playerVisible && ballActive && !playerHasBall;

    const beaconRate = showBeacon ? BALL_BEACON_FADE_IN : BALL_BEACON_FADE_OUT;
    const radarRate = showRadar ? BALL_RADAR_FADE_IN : BALL_RADAR_FADE_OUT;
    ballBeaconOpacity += (Number(showBeacon) - ballBeaconOpacity) * (1 - Math.exp(-beaconRate * delta));
    ballRadarOpacity += (Number(showRadar) - ballRadarOpacity) * (1 - Math.exp(-radarRate * delta));

    ballBeaconGroup.visible = ballBeaconOpacity > 0.01 && ballActive;
    ballRadarGroup.visible = ballRadarOpacity > 0.01 && playerVisible && ballActive;
    if (!ballActive) return;

    const bp = basketballData.mesh.position;

    if (ballBeaconGroup.visible) {
        const bob = Math.sin(stabilizedElapsed * BALL_BEACON_BOB_SPEED) * BALL_BEACON_BOB_AMPLITUDE;
        const pulse = 0.86 + 0.14 * Math.sin(stabilizedElapsed * 6.8);
        const ballRadius = basketballData.radius || 0.12;
        const beaconLift = ballRadius + BALL_BEACON_LIFT;

        // Keep beacon directly above the ball center in XZ, with a tight vertical offset.
        ballBeaconGroup.position.set(bp.x, bp.y + beaconLift + bob, bp.z);
        ballBeaconGroup.rotation.y += delta * 1.6;

        ballBeaconRing.material.opacity = 0.46 * ballBeaconOpacity * pulse;
        ballBeaconCore.material.opacity = 0.24 * ballBeaconOpacity * pulse;
        ballBeaconPointer.material.opacity = 0.55 * ballBeaconOpacity;
    }

    if (ballRadarGroup.visible) {
        const pp = playerData.group.position;
        const groundY = pp.y + (playerData.visualGroundOffsetY || 0);
        ballRadarGroup.position.set(pp.x, groundY + 0.022, pp.z);

        const dx = bp.x - pp.x;
        const dz = bp.z - pp.z;
        const dist = Math.hypot(dx, dz);
        if (dist > BALL_RADAR_MIN_DIST) {
            const targetYaw = Math.atan2(dx, dz);
            const yawLerp = 1 - Math.exp(-16 * delta);
            ballRadarGroup.rotation.y = lerpAngle(ballRadarGroup.rotation.y, targetYaw, yawLerp);
        }

        const distanceBlend = THREE.MathUtils.clamp((dist - 0.6) / 9.0, 0.55, 1.0);
        const pulse = 0.95 + 0.05 * Math.sin(stabilizedElapsed * 7.4);
        const alpha = ballRadarOpacity * distanceBlend * pulse;

        ballRadarRing.material.opacity = 0.82 * alpha;
        ballRadarGlow.material.opacity = 0.34 * alpha;
        ballRadarStem.material.opacity = 0.72 * alpha;
        ballRadarArrow.material.opacity = 0.92 * alpha;

        // Keep the stamina arc oriented with the radar arrow/arc heading.
        if (playerData._staminaArcGroup) {
            const desiredLocalYaw = ballRadarGroup.rotation.y - (playerData.facingAngle || 0);
            const yawLerp = 1 - Math.exp(-16 * delta);
            playerData._staminaArcGroup.rotation.y = lerpAngle(
                playerData._staminaArcGroup.rotation.y,
                desiredLocalYaw,
                yawLerp
            );
        }
    } else if (playerData?._staminaArcGroup) {
        // Return to default local orientation when radar is hidden.
        const yawLerp = 1 - Math.exp(-12 * delta);
        playerData._staminaArcGroup.rotation.y = lerpAngle(
            playerData._staminaArcGroup.rotation.y,
            0,
            yawLerp
        );
    }
}

function findDunkRim() {
    if (!playerData || !basketballData?.heldByPlayer || playerData.isGrounded || rimSensors.length === 0) return null;

    const playerPos = playerData.group.position;
    const groundY = playerPos.y + (playerData.visualGroundOffsetY || 0);
    const handApproxY = groundY + 1.9;
    if (handApproxY < DUNK_MIN_HAND_HEIGHT) return null;

    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);

    let best = null;
    let bestScore = Infinity;
    for (const rim of rimSensors) {
        const dx = rim.x - playerPos.x;
        const dz = rim.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > DUNK_TRIGGER_RADIUS) continue;

        const facingDot = dist > 1e-5 ? (dx * fwdX + dz * fwdZ) / dist : 1;
        if (facingDot < 0.05) continue;

        const verticalGap = Math.abs(handApproxY - rim.y);
        if (verticalGap > 1.0) continue;

        const score = dist + verticalGap * 0.2 - facingDot * 0.2;
        if (score < bestScore) {
            bestScore = score;
            best = rim;
        }
    }
    return best;
}

function startDunk(rim) {
    if (!playerData || !basketballData || !rim) return false;

    const startPlayer = playerData.group.position.clone();
    const startBall = basketballData.mesh.position.clone();
    const footOffset = playerData.visualGroundOffsetY || 0.265;

    dunkTmpInward.set(-rim.x, 0, -rim.z);
    if (dunkTmpInward.lengthSq() < 1e-8) {
        dunkTmpInward.set(0, 0, rim.z > 0 ? -1 : 1);
    }
    dunkTmpInward.normalize();

    const targetGroundY = rim.y - 1.58;
    const targetPlayer = new THREE.Vector3(
        rim.x + dunkTmpInward.x * 0.5,
        targetGroundY - footOffset,
        rim.z + dunkTmpInward.z * 0.5
    );

    const preSlamBall = new THREE.Vector3(
        rim.x + dunkTmpInward.x * 0.12,
        rim.y + 0.3,
        rim.z + dunkTmpInward.z * 0.12
    );

    const postSlamBall = new THREE.Vector3(
        rim.x + dunkTmpInward.x * 0.02,
        rim.y - DUNK_BALL_RELEASE_DROP,
        rim.z + dunkTmpInward.z * 0.02
    );

    dunkState = {
        phase: 'approach',
        elapsed: 0,
        rim,
        inward: dunkTmpInward.clone(),
        startPlayer,
        targetPlayer,
        hangPlayer: targetPlayer.clone(),
        startBall,
        preSlamBall,
        postSlamBall,
        ballReleased: false,
        scored: false
    };

    shootingStance = false;
    shootQueued = false;
    cancelShootQueued = false;
    pickupAssistTimer = 0;
    resetPowerMeterCycle();
    shotsAttempted += 1;
    updateScoreHud();

    basketballData._shootingStance = false;
    basketballData._dunkControl = true;
    basketballData.heldByPlayer = true;
    basketballData.dribblingByPlayer = false;
    basketballData.velocity.set(0, 0, 0);
    basketballData.sleeping = false;
    basketballData.grounded = false;
    basketballData.idleFrames = 0;
    basketballData._lastShooterRef = playerData;
    basketballData._lastShotReleaseDistToRim = Math.hypot(
        playerData.group.position.x - rim.x, playerData.group.position.z - rim.z
    );

    playerData.velocity.set(0, 0, 0);
    playerData.velocityY = 0;
    playerData.isGrounded = false;
    playerData.isJumping = true;
    resetPlayerInput();
    resetShootInput();
    return true;
}

function updateDunk(delta) {
    if (!dunkState || !playerData || !basketballData) return;

    const ds = dunkState;
    ds.elapsed += delta;

    const playerPos = playerData.group.position;
    const ballPos = basketballData.mesh.position;
    const rim = ds.rim;

    dunkTmpRimDir.set(rim.x - playerPos.x, 0, rim.z - playerPos.z);
    if (dunkTmpRimDir.lengthSq() > 1e-6) {
        const targetFacing = Math.atan2(dunkTmpRimDir.x, dunkTmpRimDir.z);
        let diff = targetFacing - playerData.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerData.facingAngle += diff * (1 - Math.exp(-18 * delta));
        playerData.group.rotation.y = playerData.facingAngle;
    }

    function releaseDunkBallNow() {
        if (ds.ballReleased) return;
        ds.ballReleased = true;
        basketballData.heldByPlayer = false;
        basketballData.dribblingByPlayer = false;
        basketballData._shootingStance = false;
        basketballData._dunkControl = false;
        basketballData.mesh.position.copy(ds.postSlamBall);
        basketballData.velocity.set(ds.inward.x * 1.65, DUNK_BALL_RELEASE_SPEED_Y, ds.inward.z * 1.65);
        basketballData._ignoreRimTimer = 0.3;
        basketballData._ignorePlayerTimer = 0.2;
        basketballData.prevPosition.copy(basketballData.mesh.position);
        basketballData.sleeping = false;
        basketballData.grounded = false;
        basketballData.idleFrames = 0;
    }

    if (!ds.ballReleased) {
        basketballData._dunkControl = true;
        basketballData.heldByPlayer = true;
        basketballData.dribblingByPlayer = false;
        basketballData._shootingStance = false;
        basketballData.velocity.set(0, 0, 0);
        basketballData.sleeping = false;
        basketballData.grounded = false;
        basketballData.idleFrames = 0;
    }

    if (ds.phase === 'approach') {
        const t = Math.min(1, ds.elapsed / DUNK_APPROACH_TIME);
        playerPos.lerpVectors(ds.startPlayer, ds.targetPlayer, t);
        if (!ds.ballReleased) {
            ballPos.lerpVectors(ds.startBall, ds.preSlamBall, t);
        }

        if (t >= 1) {
            ds.phase = 'slam';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'slam') {
        const t = Math.min(1, ds.elapsed / DUNK_SLAM_TIME);
        playerPos.copy(ds.targetPlayer);
        if (!ds.ballReleased) {
            ballPos.lerpVectors(ds.preSlamBall, ds.postSlamBall, t);
        }

        if (!ds.scored && t >= 0.55) {
            registerMadeBasket('Dunk');
            pendingMake = null;
            scorePrevBallValid = false;
            ds.scored = true;
        }

        if (t >= 1) {
            releaseDunkBallNow();
            ds.phase = 'hang';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'hang') {
        playerPos.copy(ds.hangPlayer);
        releaseDunkBallNow();

        if (ds.elapsed >= DUNK_HANG_TIME) {
            ds.phase = 'release';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'release') {
        const t = Math.min(1, ds.elapsed / DUNK_RELEASE_TIME);
        playerPos.y = ds.hangPlayer.y - 0.7 * t;
        releaseDunkBallNow();

        if (t >= 1) {
            playerData.velocity.set(0, 0, 0);
            playerData.velocityY = -1.75;
            playerData.isGrounded = false;
            playerData.isJumping = true;
            dunkState = null;
        }
    }
}

// ─── Opponent Dunk Functions ────────────────────────────────

const _oppDunkInward = new THREE.Vector3();

function findOppDunkRim(opp, targetRimZ) {
    if (rimSensors.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    const oppPos = opp.group.position;
    for (const rim of rimSensors) {
        // Only consider the rim the opponent is attacking
        if (Math.abs(rim.z - targetRimZ) > 2.0) continue;
        const dist = Math.hypot(rim.x - oppPos.x, rim.z - oppPos.z);
        if (dist < bestDist) {
            bestDist = dist;
            best = rim;
        }
    }
    return (best && bestDist < OPP_DUNK_APPROACH_DIST) ? best : null;
}

function startOppDunk(opp, rim) {
    if (!opp || !rim || !basketballData) return false;

    const startPlayer = opp.group.position.clone();
    const startBall = basketballData.mesh.position.clone();
    const footOffset = opp.visualGroundOffsetY || 0.265;

    _oppDunkInward.set(-rim.x, 0, -rim.z);
    if (_oppDunkInward.lengthSq() < 1e-8) {
        _oppDunkInward.set(0, 0, rim.z > 0 ? -1 : 1);
    }
    _oppDunkInward.normalize();

    const targetGroundY = rim.y - 1.58;
    const targetPlayer = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.5,
        targetGroundY - footOffset,
        rim.z + _oppDunkInward.z * 0.5
    );

    const preSlamBall = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.12,
        rim.y + 0.3,
        rim.z + _oppDunkInward.z * 0.12
    );

    const postSlamBall = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.02,
        rim.y - DUNK_BALL_RELEASE_DROP,
        rim.z + _oppDunkInward.z * 0.02
    );

    opp._dunkState = {
        phase: 'approach',
        elapsed: 0,
        rim,
        inward: _oppDunkInward.clone(),
        startPlayer,
        targetPlayer,
        hangPlayer: targetPlayer.clone(),
        startBall,
        preSlamBall,
        postSlamBall,
        ballReleased: false,
        scored: false
    };

    // Set ball state for dunk
    basketballData._shootingStance = false;
    basketballData._dunkControl = true;
    basketballData.heldByPlayer = true;
    basketballData.heldByPlayerData = opp;
    basketballData.dribblingByPlayer = false;
    basketballData.velocity.set(0, 0, 0);
    basketballData.sleeping = false;
    basketballData.grounded = false;
    basketballData.idleFrames = 0;

    // Set opponent state
    opp.velocity.set(0, 0, 0);
    opp.velocityY = 0;
    opp.isGrounded = false;
    opp.isJumping = true;
    opp._shootPrep = false;
    opp._holdTimer = 0;

    // Track for score attribution
    basketballData._lastShooterRef = opp;
    basketballData._lastShotReleaseDistToRim = Math.hypot(
        opp.group.position.x - rim.x, opp.group.position.z - rim.z
    );
    oppShotsAttempted += 1;
    updateScoreHud();
    drainStamina(opp, STAMINA_DUNK_COST);

    return true;
}

function updateOppDunk(opp, delta) {
    const ds = opp._dunkState;
    if (!ds || !basketballData) return false;

    ds.elapsed += delta;

    const oppPos = opp.group.position;
    const ballPos = basketballData.mesh.position;
    const rim = ds.rim;

    // Face the rim
    const rimDirX = rim.x - oppPos.x;
    const rimDirZ = rim.z - oppPos.z;
    if (rimDirX * rimDirX + rimDirZ * rimDirZ > 1e-6) {
        const targetFacing = Math.atan2(rimDirX, rimDirZ);
        let diff = targetFacing - opp.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        opp.facingAngle += diff * (1 - Math.exp(-18 * delta));
        opp.group.rotation.y = opp.facingAngle;
    }

    function releaseOppDunkBall() {
        if (ds.ballReleased) return;
        ds.ballReleased = true;
        basketballData.heldByPlayer = false;
        basketballData.heldByPlayerData = null;
        basketballData.dribblingByPlayer = false;
        basketballData._shootingStance = false;
        basketballData._dunkControl = false;
        basketballData.mesh.position.copy(ds.postSlamBall);
        basketballData.velocity.set(ds.inward.x * 1.65, DUNK_BALL_RELEASE_SPEED_Y, ds.inward.z * 1.65);
        basketballData._ignoreRimTimer = 0.3;
        basketballData._ignorePlayerTimer = 0.2;
        basketballData._ignorePlayerRef = opp;
        basketballData.prevPosition.copy(basketballData.mesh.position);
        basketballData.sleeping = false;
        basketballData.grounded = false;
        basketballData.idleFrames = 0;
    }

    // Keep ball locked during dunk
    if (!ds.ballReleased) {
        basketballData._dunkControl = true;
        basketballData.heldByPlayer = true;
        basketballData.heldByPlayerData = opp;
        basketballData.dribblingByPlayer = false;
        basketballData._shootingStance = false;
        basketballData.velocity.set(0, 0, 0);
        basketballData.sleeping = false;
        basketballData.grounded = false;
        basketballData.idleFrames = 0;
    }

    if (ds.phase === 'approach') {
        const t = Math.min(1, ds.elapsed / DUNK_APPROACH_TIME);
        oppPos.lerpVectors(ds.startPlayer, ds.targetPlayer, t);
        if (!ds.ballReleased) {
            ballPos.lerpVectors(ds.startBall, ds.preSlamBall, t);
        }
        if (t >= 1) {
            ds.phase = 'slam';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'slam') {
        const t = Math.min(1, ds.elapsed / DUNK_SLAM_TIME);
        oppPos.copy(ds.targetPlayer);
        if (!ds.ballReleased) {
            ballPos.lerpVectors(ds.preSlamBall, ds.postSlamBall, t);
        }
        if (!ds.scored && t >= 0.55) {
            registerMadeBasket('Dunk');
            pendingMake = null;
            scorePrevBallValid = false;
            ds.scored = true;
        }
        if (t >= 1) {
            releaseOppDunkBall();
            ds.phase = 'hang';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'hang') {
        oppPos.copy(ds.hangPlayer);
        releaseOppDunkBall();
        if (ds.elapsed >= DUNK_HANG_TIME) {
            ds.phase = 'release';
            ds.elapsed = 0;
        }
    } else if (ds.phase === 'release') {
        const t = Math.min(1, ds.elapsed / DUNK_RELEASE_TIME);
        oppPos.y = ds.hangPlayer.y - 0.7 * t;
        releaseOppDunkBall();
        if (t >= 1) {
            opp.velocity.set(0, 0, 0);
            opp.velocityY = -1.75;
            opp.isGrounded = false;
            opp.isJumping = true;
            opp._dunkState = null;
        }
    }

    return true; // dunk is active
}

// ─── Teammate Dunk Function ────────────────────────────────

function startTeammateDunk(tm, rim) {
    if (!tm || !rim || !basketballData) return false;

    const startPlayer = tm.group.position.clone();
    const startBall = basketballData.mesh.position.clone();
    const footOffset = tm.visualGroundOffsetY || 0.265;

    _oppDunkInward.set(-rim.x, 0, -rim.z);
    if (_oppDunkInward.lengthSq() < 1e-8) {
        _oppDunkInward.set(0, 0, rim.z > 0 ? -1 : 1);
    }
    _oppDunkInward.normalize();

    const targetGroundY = rim.y - 1.58;
    const targetPlayer = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.5,
        targetGroundY - footOffset,
        rim.z + _oppDunkInward.z * 0.5
    );

    const preSlamBall = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.12,
        rim.y + 0.3,
        rim.z + _oppDunkInward.z * 0.12
    );

    const postSlamBall = new THREE.Vector3(
        rim.x + _oppDunkInward.x * 0.02,
        rim.y - DUNK_BALL_RELEASE_DROP,
        rim.z + _oppDunkInward.z * 0.02
    );

    tm._dunkState = {
        phase: 'approach',
        elapsed: 0,
        rim,
        inward: _oppDunkInward.clone(),
        startPlayer,
        targetPlayer,
        hangPlayer: targetPlayer.clone(),
        startBall,
        preSlamBall,
        postSlamBall,
        ballReleased: false,
        scored: false
    };

    basketballData._shootingStance = false;
    basketballData._dunkControl = true;
    basketballData.heldByPlayer = true;
    basketballData.heldByPlayerData = tm;
    basketballData.dribblingByPlayer = false;
    basketballData.velocity.set(0, 0, 0);
    basketballData.sleeping = false;
    basketballData.grounded = false;
    basketballData.idleFrames = 0;

    tm.velocity.set(0, 0, 0);
    tm.velocityY = 0;
    tm.isGrounded = false;
    tm.isJumping = true;
    tm._shootPrep = false;
    tm._holdTimer = 0;

    // Track for score attribution — teammate shots go to player team
    basketballData._lastShooterRef = tm;
    basketballData._lastShotReleaseDistToRim = Math.hypot(
        tm.group.position.x - rim.x, tm.group.position.z - rim.z
    );
    shotsAttempted += 1;
    updateScoreHud();
    drainStamina(tm, STAMINA_DUNK_COST);

    return true;
}

// ─── Shooting Arc ───────────────────────────────────────────
function createShootingArc() {
    const positions = new Float32Array(ARC_NUM_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
        color: 0xd93030,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
    });

    shootingArcLine = new THREE.Line(geometry, material);
    shootingArcLine.visible = false;
    shootingArcLine.frustumCulled = false;
    shootingArcLine.renderOrder = 999;
    scene.add(shootingArcLine);
}

function updateShootingArc(delta) {
    // Fast bail-out: if already invisible and not in stance, skip everything
    if (arcOpacity === 0 && !shootingStance) return;

    // ── Fade opacity in/out ──────────────────────────────
    const targetOpacity = shootingStance ? 0.55 : 0;
    if (shootingStance) {
        arcOpacity += (targetOpacity - arcOpacity) * (1 - Math.exp(-ARC_FADE_IN_RATE * delta));
    } else {
        arcOpacity += (targetOpacity - arcOpacity) * (1 - Math.exp(-ARC_FADE_OUT_RATE * delta));
    }
    // Snap to zero when close enough
    if (arcOpacity < 0.005) arcOpacity = 0;

    if (!shootingArcLine) return;
    shootingArcLine.material.opacity = arcOpacity;
    shootingArcLine.visible = arcOpacity > 0;
    if (arcOpacity === 0) return;

    if (!playerData) return;

    // ── Gather player state ──────────────────────────────
    const groundY = playerData.group.position.y + (playerData.visualGroundOffsetY || 0);
    const releaseY = groundY + ARC_RELEASE_H;
    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;
    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);

    // Release point (matches shootBasketball in ball.js)
    const startX = px + fwdX * 0.15;
    const startY = releaseY;
    const startZ = pz + fwdZ * 0.15;

    // ── Find target rim (same logic as ball.js) ──────────
    let bestRimX = 0, bestRimZ = 0;
    let bestDot = -Infinity;
    for (const side of [-1, 1]) {
        const baselineZ = side * ARC_HALF_COURT;
        const bbFaceZ = baselineZ - side * ARC_BB_FROM_BL;
        const rimZ = bbFaceZ - side * (ARC_RIM_FROM_BB + ARC_RIM_RADIUS);
        const dx = 0 - px;
        const dz = rimZ - pz;
        const dot = dx * fwdX + dz * fwdZ;
        if (dot > bestDot) {
            bestDot = dot;
            bestRimX = 0;
            bestRimZ = rimZ;
        }
    }

    // ── Projectile velocity (same formula as ball.js) ────
    const dx = bestRimX - px;
    const dz = bestRimZ - pz;
    const horizontalDist = Math.hypot(dx, dz);
    const dy = ARC_RIM_HEIGHT - releaseY;

    const angleDeg = Math.max(SHOOT_ANGLE_MIN, Math.min(SHOOT_ANGLE_MAX, shootAngle));
    const angleRad = angleDeg * Math.PI / 180;
    const power = 1.0; // Arc preview follows angle only, not live power meter oscillation
    const cosA = Math.cos(angleRad);
    const tanA = Math.tan(angleRad);
    const g = Math.abs(ARC_GRAVITY);

    let vx, vy, vz;
    const denominator = horizontalDist * tanA - dy;

    if (denominator <= 0.01 || horizontalDist < 0.3) {
        // Fallback lob (matches ball.js)
        vx = fwdX * 5 * power;
        vy = 6 * power;
        vz = fwdZ * 5 * power;
    } else {
        const speedSq = (g * horizontalDist * horizontalDist) / (2 * cosA * cosA * denominator);
        if (speedSq <= 0) {
            vx = fwdX * 5 * power;
            vy = 6 * power;
            vz = fwdZ * 5 * power;
        } else {
            const speed = Math.min(Math.min(Math.sqrt(speedSq), 18) * power, 20);
            const vHorizontal = speed * cosA;
            vy = speed * Math.sin(angleRad);

            // 70% facing + 30% rim direction (aim assist)
            const rimDirX = horizontalDist > 0.1 ? dx / horizontalDist : fwdX;
            const rimDirZ = horizontalDist > 0.1 ? dz / horizontalDist : fwdZ;
            const aimX = fwdX * 0.7 + rimDirX * 0.3;
            const aimZ = fwdZ * 0.7 + rimDirZ * 0.3;
            const aimLen = Math.hypot(aimX, aimZ) || 1;

            vx = vHorizontal * (aimX / aimLen);
            vz = vHorizontal * (aimZ / aimLen);
        }
    }

    // ── Trace the parabolic arc ──────────────────────────
    // Flight time: slightly past the rim so the descending arc is visible
    const vHoriz = Math.hypot(vx, vz);
    const flightTime = vHoriz > 0.1 ? (horizontalDist * 1.12) / vHoriz : 2.0;
    const peakTime = vy / g; // time at apex (vy / |gravity|)

    const attr = shootingArcLine.geometry.getAttribute('position');
    let numVisible = 0;

    for (let i = 0; i < ARC_NUM_POINTS; i++) {
        const t = (i / (ARC_NUM_POINTS - 1)) * flightTime;
        const x = startX + vx * t;
        const y = startY + vy * t + 0.5 * ARC_GRAVITY * t * t;
        const z = startZ + vz * t;

        attr.setXYZ(i, x, y, z);
        numVisible = i + 1;

        // Stop if past apex and descended below the floor
        if (t > peakTime && y < groundY + 0.1) break;
    }

    attr.needsUpdate = true;
    shootingArcLine.geometry.setDrawRange(0, numVisible);
}

function updateDayNight(delta) {
    // Smooth transition
    const speed = 1.5;
    if (Math.abs(dayNightTransition - dayNightTarget) > 0.001) {
        dayNightTransition += (dayNightTarget - dayNightTransition) * speed * delta;
        dayNightTransition = Math.max(0, Math.min(1, dayNightTransition));
        applyDayNightState(dayNightTransition);
    }
}

// ─── Pre-allocated colors for day/night (avoid per-frame GC) ─────
const _dayFog = new THREE.Color(0x87CEEB);
const _nightFog = new THREE.Color(0x0a0a1a);
const _daySunColor = new THREE.Color(0xffeedd);
const _nightSunColor = new THREE.Color(0x222244);
const _tmpSunColor = new THREE.Color();

function applyDayNightState(t) {
    // t: 0 = day, 1 = night

    // Fog color
    scene.fog.color.copy(_dayFog).lerp(_nightFog, t);

    // Tone mapping exposure
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.1, 0.45, t);

    // Sky blend via background color (smooth transition)
    scene.background = t < 0.5 ? daySkyTexture : nightSkyTexture;

    // Update lights (cached array, no traversal)
    for (let i = 0; i < cachedLights.length; i++) {
        const { light, role } = cachedLights[i];
        if (role === 'sun') {
            light.intensity = THREE.MathUtils.lerp(1.8, 0.05, t);
            _tmpSunColor.copy(_daySunColor).lerp(_nightSunColor, t);
            light.color.copy(_tmpSunColor);
        } else if (role === 'ambient') {
            light.intensity = THREE.MathUtils.lerp(0.45, 0.12, t);
        } else if (role === 'hemi') {
            light.intensity = THREE.MathUtils.lerp(0.5, 0.08, t);
        } else if (role === 'fill') {
            light.intensity = THREE.MathUtils.lerp(0.35, 0.02, t);
        } else if (role === 'rim') {
            light.intensity = THREE.MathUtils.lerp(0.25, 0.0, t);
        } else if (role === 'lamppost') {
            if (light.isSpotLight) {
                light.intensity = THREE.MathUtils.lerp(0.5, 4.0, t);
            } else {
                light.intensity = THREE.MathUtils.lerp(0.15, 2.0, t);
                light.distance = THREE.MathUtils.lerp(12, 25, t);
            }
        } else if (role === 'moon') {
            light.intensity = THREE.MathUtils.lerp(0.0, 0.35, t);
        }
    }

    // Sun & Moon 3D objects (cached children, no traversal)
    if (sunMesh) {
        sunMesh.material.opacity = THREE.MathUtils.lerp(1.0, 0.0, t);
        for (let i = 0; i < cachedSunChildren.length; i++) {
            cachedSunChildren[i].material.opacity = THREE.MathUtils.lerp(i === 0 ? 0.15 : 0.06, 0.0, t);
        }
    }
    if (moonMesh) {
        moonMesh.material.opacity = THREE.MathUtils.lerp(0.0, 0.95, t);
        for (let i = 0; i < cachedMoonChildren.length; i++) {
            const entry = cachedMoonChildren[i];
            if (entry.type === 'crater') entry.mesh.material.opacity = THREE.MathUtils.lerp(0.0, 0.5, t);
            else if (entry.type === 'halo') entry.mesh.material.opacity = THREE.MathUtils.lerp(0.0, 0.04, t);
            else if (entry.type === 'glow') entry.mesh.material.opacity = THREE.MathUtils.lerp(0.0, 0.1, t);
        }
    }

    // Window & lamp bulb glow at night (cached arrays, no traversal)
    for (let i = 0; i < cachedWindowLit.length; i++) {
        cachedWindowLit[i].material.emissiveIntensity = THREE.MathUtils.lerp(0.4, 2.5, t);
    }
    for (let i = 0; i < cachedWindowDark.length; i++) {
        cachedWindowDark[i].material.emissiveIntensity = THREE.MathUtils.lerp(0.15, 0.8, t);
    }
    for (let i = 0; i < cachedLampBulbs.length; i++) {
        cachedLampBulbs[i].material.emissiveIntensity = THREE.MathUtils.lerp(0.3, 4.0, t);
        cachedLampBulbs[i].material.opacity = THREE.MathUtils.lerp(0.35, 1.0, t);
    }
}

// ─── Build Scene ────────────────────────────────────────────
function buildScene() {
    daySkyTexture = createSkyTexture('day');
    nightSkyTexture = createSkyTexture('night');
    scene.background = daySkyTexture;
    scene.environment = daySkyTexture;

    createCourt(scene);

    createHoops(scene);
    hoopColliders = scene.userData.hoopColliders || [];
    refreshRimSensors();
    playerColliders = hoopColliders.concat(parkColliders);

    createPark(scene);
    parkColliders = scene.userData.parkColliders || [];
    parkSeats = scene.userData.parkSeats || [];
    playerColliders = hoopColliders.concat(parkColliders);

    createCity(scene);
    lightingGroup = createLighting(scene);
    playerData = createPlayer(scene);
    playerData.baseSpeedMultiplier = 1.0;
    playerData.speedMultiplier = 1.0;
    playerData.blocking = false;

    basketballData = createBasketball(scene);
    updateScoreHud();
    createShootingArc();
    createPassLine();
    createBallLocatorIndicators();

    createCelestialBodies();
    collectTransparentObjects();
    collectAnimatedObjects();
    tagCityWindows();
    cacheLightReferences();
    cacheCelestialChildren();

    showModeSelect();
}

function tagCityWindows() {
    cachedWindowLit.length = 0;
    cachedWindowDark.length = 0;
    cachedLampBulbs.length = 0;
    scene.traverse((child) => {
        if (child.isMesh && child.material) {
            if (child.material.emissive && child.material.emissive.getHex() === 0xffcc66) {
                child.userData.isWindowLit = true;
                cachedWindowLit.push(child);
            }
            if (child.material.emissive && child.material.emissive.getHex() === 0x334455) {
                child.userData.isWindowDark = true;
                cachedWindowDark.push(child);
            }
            if (child.material.emissive && child.material.emissive.getHex() === 0xffeebb &&
                child.material.transparent) {
                child.userData.isLampBulb = true;
                cachedLampBulbs.push(child);
            }
        }
    });
}

function cacheLightReferences() {
    cachedLights.length = 0;
    if (lightingGroup) {
        lightingGroup.traverse((child) => {
            if (child.isLight && child.userData.lightRole) {
                cachedLights.push({ light: child, role: child.userData.lightRole });
            }
        });
    }
}

function cacheCelestialChildren() {
    cachedSunChildren.length = 0;
    cachedMoonChildren.length = 0;
    if (sunMesh) {
        for (const c of sunMesh.children) {
            if (c.material) cachedSunChildren.push(c);
        }
    }
    if (moonMesh) {
        moonMesh.traverse(c => {
            if (c === moonMesh) return;
            if (c.material && c.userData.isMoonCrater) cachedMoonChildren.push({ mesh: c, type: 'crater' });
            else if (c.material && c.userData.isMoonHalo) cachedMoonChildren.push({ mesh: c, type: 'halo' });
            else if (c === moonGlowMesh && c.material) cachedMoonChildren.push({ mesh: c, type: 'glow' });
        });
    }
}

function createCelestialBodies() {
    // ── Sun ──────────────────────────────────────────────
    const sunGeo = new THREE.SphereGeometry(5, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 1.0,
    });
    sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(120, 140, 80);

    // Sun corona glow
    const coronaGeo = new THREE.SphereGeometry(8, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.15,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    sunMesh.add(corona);

    // Outer glow
    const outerGlowGeo = new THREE.SphereGeometry(14, 32, 32);
    const outerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.06,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    sunMesh.add(outerGlow);

    scene.add(sunMesh);

    // ── Moon ─────────────────────────────────────────────
    const moonGeo = new THREE.SphereGeometry(3.5, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
        color: 0xdddde8,
        transparent: true,
        opacity: 0.0,
    });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-80, 120, -60);

    // Moon surface craters (subtle darker patches)
    const craterMat = new THREE.MeshBasicMaterial({
        color: 0xaaaabc,
        transparent: true,
        opacity: 0.0,
    });
    const craterPositions = [
        [0.8, 1.2, 2.5, 0.6],
        [-1.0, 0.5, 2.8, 0.45],
        [0.2, -0.8, 3.0, 0.35],
        [-0.5, 1.5, 2.6, 0.5],
    ];
    for (const [cx, cy, cz, cr] of craterPositions) {
        const crater = new THREE.Mesh(
            new THREE.SphereGeometry(cr, 8, 8),
            craterMat
        );
        crater.position.set(cx, cy, cz);
        crater.userData.isMoonCrater = true;
        moonMesh.add(crater);
    }

    // Moon glow
    const moonGlowGeo = new THREE.SphereGeometry(7, 32, 32);
    const moonGlowMat = new THREE.MeshBasicMaterial({
        color: 0x8888bb,
        transparent: true,
        opacity: 0.0,
    });
    moonGlowMesh = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    moonMesh.add(moonGlowMesh);

    // Outer moon halo
    const moonHaloGeo = new THREE.SphereGeometry(12, 32, 32);
    const moonHaloMat = new THREE.MeshBasicMaterial({
        color: 0x6666aa,
        transparent: true,
        opacity: 0.0,
    });
    const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
    moonHalo.userData.isMoonHalo = true;
    moonMesh.add(moonHalo);

    scene.add(moonMesh);
}

// ─── Sky Texture Generation ────────────────────────────────
function createSkyTexture(mode) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);

    if (mode === 'day') {
        gradient.addColorStop(0, '#0d1b2a');
        gradient.addColorStop(0.15, '#1b2838');
        gradient.addColorStop(0.3, '#3a6fa0');
        gradient.addColorStop(0.5, '#6baed6');
        gradient.addColorStop(0.65, '#a8d4e6');
        gradient.addColorStop(0.78, '#e8c8a0');
        gradient.addColorStop(0.88, '#e8a050');
        gradient.addColorStop(1.0, '#d47828');
    } else {
        gradient.addColorStop(0, '#020208');
        gradient.addColorStop(0.2, '#050510');
        gradient.addColorStop(0.4, '#0a0a1e');
        gradient.addColorStop(0.6, '#0d0d28');
        gradient.addColorStop(0.75, '#121230');
        gradient.addColorStop(0.85, '#1a1428');
        gradient.addColorStop(0.92, '#201820');
        gradient.addColorStop(1.0, '#151015');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);

    if (mode === 'day') {
        // Clouds
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 1024;
            const y = 100 + Math.random() * 400;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.1})`;
            for (let j = 0; j < 4; j++) {
                const cx = x + (Math.random() - 0.5) * 80;
                const cy = y + (Math.random() - 0.5) * 20;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 30 + Math.random() * 120, 8 + Math.random() * 20, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        // Stars
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 700; // mostly upper sky
            const brightness = 0.3 + Math.random() * 0.7;
            const size = 0.5 + Math.random() * 1.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Moon
        ctx.fillStyle = 'rgba(220, 220, 240, 0.8)';
        ctx.beginPath();
        ctx.arc(750, 180, 30, 0, Math.PI * 2);
        ctx.fill();
        // Moon glow
        const moonGlow = ctx.createRadialGradient(750, 180, 25, 750, 180, 80);
        moonGlow.addColorStop(0, 'rgba(180, 180, 220, 0.15)');
        moonGlow.addColorStop(1, 'rgba(180, 180, 220, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(750, 180, 80, 0, Math.PI * 2);
        ctx.fill();

        // Thin clouds
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * 1024;
            const y = 100 + Math.random() * 300;
            ctx.fillStyle = `rgba(40, 40, 60, ${0.1 + Math.random() * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(x, y, 50 + Math.random() * 100, 5 + Math.random() * 15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}

// ─── Free-Roam Camera ──────────────────────────────────────
function setupFreeRoam() {
    camera.getWorldDirection(freeRoamLookDir);
    yaw = Math.atan2(freeRoamLookDir.x, freeRoamLookDir.z);
    pitch = Math.asin(freeRoamLookDir.y);
}

function updateFreeRoam(delta) {
    freeRoamForward.set(Math.sin(yaw), 0, Math.cos(yaw));
    freeRoamRight.set(-Math.cos(yaw), 0, Math.sin(yaw));

    freeRoamVelocity.set(0, 0, 0);
    if (moveState.forward) freeRoamVelocity.add(freeRoamForward);
    if (moveState.backward) freeRoamVelocity.sub(freeRoamForward);
    if (moveState.right) freeRoamVelocity.add(freeRoamRight);
    if (moveState.left) freeRoamVelocity.sub(freeRoamRight);
    if (moveState.up) freeRoamVelocity.y += 1;
    if (moveState.down) freeRoamVelocity.y -= 1;

    if (freeRoamVelocity.lengthSq() > 0) {
        freeRoamVelocity.normalize().multiplyScalar(moveSpeed * delta);
        camera.position.add(freeRoamVelocity);
    }

    if (camera.position.y < 1.0) camera.position.y = 1.0;

    freeRoamLookDir.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
    );
    freeRoamLookTarget.copy(camera.position).add(freeRoamLookDir);
    camera.lookAt(freeRoamLookTarget);
}

// ─── Input Handlers ─────────────────────────────────────────
function onKeyDown(e) {
    if (!gameStarted) return;
    const tipOffActive = isSoloTipOffActive();
    const tipOffSetup = tipOffActive && tipOffState?.phase === 'setup';
    const tipOffContest = tipOffActive && tipOffState?.phase === 'contest';

    if (cameraMode === 'freeroam') {
        switch (e.code) {
            case 'ArrowUp':    case 'KeyW': moveState.forward = true; e.preventDefault(); break;
            case 'ArrowDown':  case 'KeyS': moveState.backward = true; e.preventDefault(); break;
            case 'ArrowLeft':  case 'KeyA': moveState.left = true; e.preventDefault(); break;
            case 'ArrowRight': case 'KeyD': moveState.right = true; e.preventDefault(); break;
            case 'Space': moveState.up = true; e.preventDefault(); break;
            case 'ShiftLeft': case 'ShiftRight': moveState.down = true; e.preventDefault(); break;
        }
    } else if (cameraMode === 'player') {
        if (tipOffSetup) {
            switch (e.code) {
                case 'ArrowUp': case 'KeyW':
                case 'ArrowDown': case 'KeyS':
                case 'ArrowLeft': case 'KeyA':
                case 'ArrowRight': case 'KeyD':
                case 'Space':
                case 'KeyZ':
                case 'KeyX':
                case 'KeyB':
                case 'KeyC':
                case 'KeyV':
                    e.preventDefault();
                    break;
            }
            return;
        }

        if (tipOffContest) {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': playerInput.forward = true; e.preventDefault(); break;
                case 'ArrowDown':  case 'KeyS': playerInput.backward = true; e.preventDefault(); break;
                case 'ArrowLeft':  case 'KeyA': playerInput.left = true; e.preventDefault(); break;
                case 'ArrowRight': case 'KeyD': playerInput.right = true; e.preventDefault(); break;
                case 'Space': playerInput.jump = true; e.preventDefault(); break;
                case 'KeyZ':
                    pickupQueued = true;
                    pickupAssistTimer = PICKUP_ASSIST_DURATION;
                    e.preventDefault();
                    break;
                case 'KeyX':
                case 'KeyB':
                case 'KeyC':
                case 'KeyV':
                    e.preventDefault();
                    break;
            }
            return;
        }

        if (shootingStance || passingStance) {
            // In shooting/pass stance: A/D = turn, X = fire, C = cancel
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': shootInput.aimUp = true; e.preventDefault(); break;
                case 'ArrowDown':  case 'KeyS': shootInput.aimDown = true; e.preventDefault(); break;
                case 'ArrowLeft':  case 'KeyA': shootInput.turnLeft = true; e.preventDefault(); break;
                case 'ArrowRight': case 'KeyD': shootInput.turnRight = true; e.preventDefault(); break;
                case 'KeyX': shootQueued = true; e.preventDefault(); break;
                case 'KeyB': blockHeld = true; e.preventDefault(); break;
                case 'KeyZ': if (passingStance) { passQueued = true; } e.preventDefault(); break;
                case 'KeyC': cancelShootQueued = true; e.preventDefault(); break;
            }
        } else {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': playerInput.forward = true; e.preventDefault(); break;
                case 'ArrowDown':  case 'KeyS': playerInput.backward = true; e.preventDefault(); break;
                case 'ArrowLeft':  case 'KeyA': playerInput.left = true; e.preventDefault(); break;
                case 'ArrowRight': case 'KeyD': playerInput.right = true; e.preventDefault(); break;
                case 'Space': playerInput.jump = true; e.preventDefault(); break;
                case 'KeyZ':
                    // If holding ball and teammates exist → pass; otherwise pickup
                    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData && teammates.length > 0) {
                        passQueued = true;
                    } else {
                        pickupQueued = true;
                        pickupAssistTimer = PICKUP_ASSIST_DURATION;
                    }
                    e.preventDefault();
                    break;
                case 'KeyX':
                    // Grounded + hold ball = shot stance. Mid-air + near rim = dunk attempt.
                    if (basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData) {
                        shootQueued = true;
                    }
                    e.preventDefault();
                    break;
                case 'KeyB':
                    blockHeld = true;
                    e.preventDefault();
                    break;
                case 'KeyC':
                    if (!blockHeld) sitToggleQueued = true;
                    e.preventDefault();
                    break;
                case 'KeyV':
                    if (playerData && !playerData.blocking && !shootingStance && !dunkState && !sitState && playerData.stunTimer <= 0 && playerData.stamina >= STAMINA_EXHAUSTED) {
                        playerData.punchQueued = true;
                        drainStamina(playerData, STAMINA_PUNCH_COST);
                    }
                    e.preventDefault();
                    break;
            }
        }
    }
}

function onKeyUp(e) {
    if (!gameStarted) return;

    // Clear all input states regardless of mode
    switch (e.code) {
        case 'ArrowUp':    case 'KeyW':
            moveState.forward = false; playerInput.forward = false;
            shootInput.aimUp = false; break;
        case 'ArrowDown':  case 'KeyS':
            moveState.backward = false; playerInput.backward = false;
            shootInput.aimDown = false; break;
        case 'ArrowLeft':  case 'KeyA':
            moveState.left = false; playerInput.left = false;
            shootInput.turnLeft = false; break;
        case 'ArrowRight': case 'KeyD':
            moveState.right = false; playerInput.right = false;
            shootInput.turnRight = false; break;
        case 'Space': moveState.up = false; playerInput.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': moveState.down = false; break;
        case 'KeyB': blockHeld = false; break;
    }
}

function onMouseMove(e) {
    if (!gameStarted) return;
    if (cameraMode !== 'freeroam' || !isPointerLocked) return;
    yaw -= e.movementX * lookSpeed;
    pitch -= e.movementY * lookSpeed;
    pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
}

function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('pointerlockchange', onPointerLockChange);

renderer.domElement.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;
    if (cameraMode === 'freeroam' && e.button === 0 && !isPointerLocked) {
        renderer.domElement.requestPointerLock();
    }
});

// ─── Camera Mode Switching ──────────────────────────────────
function switchCameraMode(mode) {
    if (!gameStarted) return;

    // Hide player when leaving player mode
    if (cameraMode === 'player' && playerData) {
        playerData.group.visible = false;
        playerData.velocity.set(0, 0, 0);
        playerData.velocityY = 0;
        playerData._pickupAssistActive = false;
        resetPlayerInput();
        resetShootInput();
        pickupQueued = false;
        pickupAssistTimer = 0;
        sitToggleQueued = false;
        shootQueued = false;
        cancelShootQueued = false;
        shootingStance = false;
        shootAngle = 52;
        shootTurnVelocity = 0;
        dunkState = null;
        sitState = null;
        playerData.blocking = false;
        blockHeld = false;
        if (basketballData) basketballData._dunkControl = false;
        resetPowerMeterCycle();
    }

    cameraMode = mode;

    if (mode === 'orbit') {
        if (isPointerLocked) document.exitPointerLock();
        controls.enabled = true;
        controls.target.set(0, 1, 0);
        controls.minDistance = 5;
        controls.maxDistance = 150;
        controls.update();
        resetMoveState();
        pickupQueued = false;
    } else if (mode === 'freeroam') {
        controls.enabled = false;
        setupFreeRoam();
        pickupQueued = false;
    } else if (mode === 'player') {
        if (isPointerLocked) document.exitPointerLock();
        controls.enabled = true;
        if (playerData) {
            playerData.group.visible = true;
            // Position camera behind and above the player
            const pp = playerData.group.position;
            const groundY = pp.y + (playerData.visualGroundOffsetY || 0);
            camera.position.set(pp.x, groundY + 4, pp.z + 8);
            controls.target.set(pp.x, groundY + 1.2, pp.z);
            controls.minDistance = 3;
            controls.maxDistance = 18;
            controls.update();
        }
        resetMoveState();
    }
    updateModeUI();
}

function updateModeUI() {
    const orbitBtn = document.getElementById('btn-orbit');
    const freeBtn = document.getElementById('btn-freeroam');
    const playerBtn = document.getElementById('btn-player');
    const hint = document.getElementById('controls-hint');
    if (orbitBtn && freeBtn && playerBtn) {
        orbitBtn.classList.toggle('active', cameraMode === 'orbit');
        freeBtn.classList.toggle('active', cameraMode === 'freeroam');
        playerBtn.classList.toggle('active', cameraMode === 'player');
    }
    if (hint) {
        if (cameraMode === 'orbit') {
            hint.textContent = 'Click & Drag to look around | Scroll to zoom | Right-click & drag to pan | BALL DROP to spawn basketball';
        } else if (cameraMode === 'freeroam') {
            hint.textContent = 'Click to capture mouse | WASD / Arrows to move | Mouse to look | Space up | Shift down | ESC release';
        } else if (cameraMode === 'player') {
            if (isSoloTipOffActive()) {
                hint.textContent = 'Jump Ball: Move with WASD / Arrows | Space to jump | Z to secure possession in the air';
            } else {
                hint.textContent = 'WASD / Arrows walk | Space jump | Z pick up / pass | X shoot / dunk | B hold block | V punch | C sit/stand';
            }
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (!gameStarted) return;
    if (e.code === 'Escape' && cameraMode === 'freeroam') {
        if (isPointerLocked) document.exitPointerLock();
    }
});

// ─── Animation Loop ─────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const rawDelta = clock.getDelta();
    const clampedDelta = Math.min(rawDelta, 0.05);
    smoothedDelta += (clampedDelta - smoothedDelta) * 0.45;
    const delta = smoothedDelta;
    stabilizedElapsed += delta;
    updatePowerMeter(delta, gameStarted && cameraMode === 'player' && (shootingStance || passingStance));
    const tipOffActive = isSoloTipOffActive();
    const tipOffSetup = tipOffActive && tipOffState?.phase === 'setup';

    if (startMenuActive) {
        updateStartMenuCamera(delta);
    } else if (cameraMode === 'orbit') {
        controls.update();
    } else if (cameraMode === 'freeroam') {
        updateFreeRoam(delta);
    } else if (cameraMode === 'player' && playerData) {
        // Camera-relative movement basis (modern third-person controls).
        camera.getWorldDirection(playerMoveForward);
        playerMoveForward.y = 0;
        if (playerMoveForward.lengthSq() < 1e-6) {
            const facing = playerData.facingAngle || 0;
            playerMoveForward.set(Math.sin(facing), 0, Math.cos(facing));
        } else {
            playerMoveForward.normalize();
        }
        playerMoveRight.crossVectors(playerMoveForward, worldUp).normalize();

        if (tipOffSetup) {
            setEntityPose(playerData, tipOffState?.playerMark || SOLO_TIPOFF_LAYOUT.player);
            playerData.velocity.set(0, 0, 0);
            playerData.velocityY = 0;
            playerData.isGrounded = true;
            playerData.isJumping = false;
            resetPlayerInput();
            resetShootInput();
            pickupQueued = false;
            pickupAssistTimer = 0;
            playerData._pickupAssistActive = false;
            shootQueued = false;
            passQueued = false;
            cancelShootQueued = false;
            sitToggleQueued = false;
            shootingStance = false;
            passingStance = false;
            passTargetTeammate = null;
        }

        if (!tipOffActive && sitToggleQueued) {
            if (sitState) {
                startStandingFromSeat();
            } else {
                const seat = findNearestSeat();
                if (seat) startSittingOnSeat(seat);
            }
            sitToggleQueued = false;
        }

        if (sitState) {
            updateSeating(delta);
            pickupAssistTimer = 0;
            playerData._pickupAssistActive = false;
            pickupQueued = false;
        } else if (tipOffSetup) {
            pickupAssistTimer = 0;
            playerData._pickupAssistActive = false;
            pickupQueued = false;
        } else {
            updatePickupAssist(delta);
        }

        if (tipOffActive) {
            shootingStance = false;
            passingStance = false;
            passTargetTeammate = null;
            shootQueued = false;
            passQueued = false;
            cancelShootQueued = false;
            sitToggleQueued = false;
            resetShootInput();
        }

        let playerBlocking = false;
        if (
            !tipOffActive &&
            !sitState &&
            !dunkState &&
            playerData?.stunTimer <= 0 &&
            playerData?.isGrounded &&
            blockHeld &&
            playerData.stamina > STAMINA_EXHAUSTED
        ) {
            playerBlocking = true;
            drainStamina(playerData, STAMINA_BLOCK_DRAIN * delta);

            if (shootingStance) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
                shootAngle = 52;
                shootTurnVelocity = 0;
            }
            if (passingStance) {
                passingStance = false;
                passTargetTeammate = null;
                if (basketballData) basketballData._passingStance = false;
            }

            shootQueued = false;
            passQueued = false;
            cancelShootQueued = false;
            pickupQueued = false;
            pickupAssistTimer = 0;
            playerData._pickupAssistActive = false;
            playerData.punchQueued = false;
            resetShootInput();
            resetPlayerInput();
            playerData.velocity.set(0, 0, 0);
        }
        playerData.blocking = playerBlocking;

        // ── Shooting state machine ────────────────────────
        if (playerData?.stunTimer > 0) {
            // Stunned — cancel all stances and block actions
            if (shootingStance) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
            }
            if (passingStance) {
                passingStance = false;
                passTargetTeammate = null;
                if (basketballData) basketballData._passingStance = false;
            }
            shootQueued = false;
            passQueued = false;
            cancelShootQueued = false;
            pickupQueued = false;
            resetShootInput();
            resetPlayerInput();
        } else if (playerBlocking) {
            shootingStance = false;
            shootQueued = false;
            cancelShootQueued = false;
            passQueued = false;
            resetShootInput();
            resetPlayerInput();
        } else if (sitState) {
            shootingStance = false;
            shootQueued = false;
            cancelShootQueued = false;
            resetShootInput();
            resetPlayerInput();
        } else if (dunkState) {
            shootingStance = false;
            shootQueued = false;
            cancelShootQueued = false;
            resetShootInput();
            resetPlayerInput();
        } else if (shootingStance) {
            // Cancel shooting stance
            if (cancelShootQueued) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
                shootAngle = 52;
                shootTurnVelocity = 0;
                cancelShootQueued = false;
                shootQueued = false;
                resetShootInput();
                resetPowerMeterCycle();
            }
            // Ball was lost (dribble collision, etc.)
            else if (!basketballData?.heldByPlayer) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
                shootAngle = 52;
                shootTurnVelocity = 0;
                shootQueued = false;
                resetShootInput();
                resetPowerMeterCycle();
            }
            // Fire the shot
            else if (shootQueued) {
                const releasePower = shotPowerMultiplier;
                lockPowerMeter(releasePower);
                shotsAttempted += 1;
                updateScoreHud();
                basketballData._shootingStance = false;
                shootBasketball(basketballData, playerData, shootAngle, releasePower);
                drainStamina(playerData, STAMINA_SHOOT_COST);
                shootingStance = false;
                shootAngle = 52;
                shootTurnVelocity = 0;
                shootQueued = false;
                resetShootInput();
            }
            else {
                // Adjust aim angle with W/S
                if (shootInput.aimUp) {
                    shootAngle = Math.min(SHOOT_ANGLE_MAX, shootAngle + SHOOT_ANGLE_SPEED * delta);
                }
                if (shootInput.aimDown) {
                    shootAngle = Math.max(SHOOT_ANGLE_MIN, shootAngle - SHOOT_ANGLE_SPEED * delta);
                }

                // Velocity-based turning — smooth ramp up/down, precise stops
                let turnTarget = 0;
                if (shootInput.turnLeft) turnTarget += 1;
                if (shootInput.turnRight) turnTarget -= 1;

                const desiredVel = turnTarget * SHOOT_TURN_MAX;
                const rate = turnTarget !== 0 ? SHOOT_TURN_ACCEL : SHOOT_TURN_DECEL;
                shootTurnVelocity += (desiredVel - shootTurnVelocity) * (1 - Math.exp(-rate * delta));
                if (Math.abs(shootTurnVelocity) < 0.005) shootTurnVelocity = 0;

                playerData.facingAngle += shootTurnVelocity * delta;
                playerData.group.rotation.y = playerData.facingAngle;
            }

            // Zero movement input so player stands still
            resetPlayerInput();
        } else if (shootQueued && !passingStance && basketballData?.heldByPlayer && !playerData?.isGrounded) {
            const dunkRim = findDunkRim();
            if (dunkRim && playerData.stamina >= STAMINA_EXHAUSTED) {
                startDunk(dunkRim);
                drainStamina(playerData, STAMINA_DUNK_COST);
            }
            shootQueued = false;
        } else if (shootQueued && !passingStance && basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData && playerData?.isGrounded && playerData.stamina >= STAMINA_EXHAUSTED) {
            // Enter shooting stance
            shootingStance = true;
            shootTurnVelocity = 0;
            resetPowerMeterCycle();
            basketballData._shootingStance = true;
            shootQueued = false;
            // Stop the player
            playerData.velocity.set(0, 0, 0);
            resetPlayerInput();
        } else {
            shootQueued = false;
        }

        // ── Pass state machine ──────────────────────────────
        // Handle active pass stance FIRST (so Z/X fire works before entry block clears passQueued)
        if (passingStance && !playerBlocking) {
            if (cancelShootQueued) {
                // C cancels pass stance
                passingStance = false;
                passTargetTeammate = null;
                if (basketballData) basketballData._passingStance = false;
                cancelShootQueued = false;
                resetPowerMeterCycle();
            } else if (shootQueued || passQueued) {
                // X or Z fires the aimed pass along facing direction
                const releasePower = shotPowerMultiplier;
                lockPowerMeter(releasePower);
                executePassAimed(releasePower);
                passingStance = false;
                passTargetTeammate = null;
                if (basketballData) basketballData._passingStance = false;
                resetPowerMeterCycle();
            } else {
                // A/D rotate player to aim
                let turnTarget = 0;
                if (shootInput.turnLeft) turnTarget += 1;
                if (shootInput.turnRight) turnTarget -= 1;
                if (Math.abs(turnTarget) > 0.01) {
                    shootTurnVelocity += (turnTarget * SHOOT_TURN_MAX - shootTurnVelocity)
                        * (1 - Math.exp(-SHOOT_TURN_ACCEL * delta));
                } else {
                    shootTurnVelocity *= Math.exp(-SHOOT_TURN_DECEL * delta);
                }
                playerData.facingAngle += shootTurnVelocity * delta;
                playerData.group.rotation.y = playerData.facingAngle;
            }
            shootQueued = false;
            passQueued = false;
            resetPlayerInput();
            resetShootInput();
        } else if (passQueued && basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData
            && !shootingStance && !dunkState && !sitState && !playerBlocking) {
            // Enter pass mode (not already in pass stance)
            const target = findNearestTeammate();
            if (target) {
                const dist = distToTeammate(target);
                if (dist <= PASS_CLOSE_RADIUS) {
                    // Quick chest pass — no stance needed
                    executePass(target, 'chest');
                } else {
                    // Enter pass stance for aimed/far pass
                    passingStance = true;
                    passTargetTeammate = target;
                    shootTurnVelocity = 0;
                    basketballData._passingStance = true;
                    resetPowerMeterCycle();
                    playerData.velocity.set(0, 0, 0);
                    // Face toward teammate
                    const dx = target.group.position.x - playerData.group.position.x;
                    const dz = target.group.position.z - playerData.group.position.z;
                    playerData.facingAngle = Math.atan2(dx, dz);
                    playerData.group.rotation.y = playerData.facingAngle;
                    resetPlayerInput();
                }
            }
            passQueued = false;
        } else {
            passQueued = false;
        }

        const needsCarry = !!(basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData || dunkState || sitState || playerBlocking);
        let carryState = null;
        if (needsCarry) {
            _carryState.holding = !!(basketballData?.heldByPlayer && basketballData.heldByPlayerData === playerData);
            _carryState.shooting = shootingStance;
            _carryState.dribbling = !playerBlocking && !shootingStance && !passingStance && !dunkState && !sitState && !!basketballData?.dribblingByPlayer && basketballData.heldByPlayerData === playerData;
            _carryState.dribblePhase = basketballData?.dribblePhase || 0;
            _carryState.dunking = !!dunkState && dunkState.phase !== 'hang';
            _carryState.hanging = !!dunkState && dunkState.phase === 'hang';
            _carryState.seated = !!sitState;
            _carryState.seatSettled = !!sitState && sitState.phase === 'sit';
            _carryState.blocking = playerBlocking;
            carryState = _carryState;
        }

        if (sitState || playerBlocking) {
            resetPlayerInput();
            playerData.velocity.set(0, 0, 0);
            playerData.velocityY = 0;
            if (sitState) {
                playerData.isGrounded = true;
                playerData.isJumping = false;
            }
        } else if (dunkState) {
            resetPlayerInput();
            playerData.velocity.set(0, 0, 0);
            playerData.velocityY = 0;
            playerData.isGrounded = false;
            playerData.isJumping = true;
        }

        updatePlayer(playerData, delta, playerInput, playerMoveBasis, playerColliders, carryState);

        if (dunkState) {
            updateDunk(delta);
        }

        // Smooth camera follow — orbit target tracks player position
        const pp = playerData.group.position;
        const groundY = pp.y + (playerData.visualGroundOffsetY || 0);
        playerCameraTarget.set(pp.x, groundY + 1.2, pp.z);
        const followLerp = 1 - Math.exp(-10 * delta);
        controls.target.lerp(playerCameraTarget, followLerp);
        controls.update();
    } else if (pickupQueued) {
        pickupQueued = false;
    }

    // ── Update opponents ─────────────────────────────
    updateOpponentColliders();
    updateTeammateColliders();
    updateTipOffState(delta);
    const tipOffActiveNow = isSoloTipOffActive();
    const tipOffSetupNow = tipOffActiveNow && tipOffState?.phase === 'setup';

    if (tipOffActiveNow) {
        for (let i = 0; i < opponents.length; i++) {
            const opp = opponents[i];
            if (opp === tipOffState?.contestOpponent) {
                updateTipOffContestOpponent(delta);
            } else {
                const mark = tipOffState?.opponentMarks?.[i] || SOLO_TIPOFF_LAYOUT.opponents[i - 1] || SOLO_TIPOFF_LAYOUT.opponents[0];
                updateTipOffStationaryEntity(opp, delta, mark);
            }
        }
    } else {
        for (const opp of opponents) {
            updateOpponentAI(opp, delta);
        }
    }

    // ── Update teammates ──────────────────────────────
    const allPlayers = (teammates.length > 0 || opponents.length > 0)
        ? [playerData, ...teammates, ...opponents] : null;
    if (tipOffActiveNow) {
        for (let i = 0; i < teammates.length; i++) {
            const mark = tipOffState?.teammateMarks?.[i] || SOLO_TIPOFF_LAYOUT.teammates[i] || SOLO_TIPOFF_LAYOUT.teammates[0];
            updateTipOffStationaryEntity(teammates[i], delta, mark);
        }
        updateTipOffReferee(delta);
    } else {
        for (const tm of teammates) {
            updateTeammateAI(tm, delta);
        }
        // Referee sideline behavior (walk off court, then idle)
        updateRefereeSideline(delta);
    }

    // ── Punch collision detection ────────────────────
    if (!tipOffActiveNow) updatePunchCollisions();

    if (tipOffSetupNow) {
        positionBallForTipOffHold();
    } else {
        updateBasketball(basketballData, delta, playerColliders, playerData, allPlayers);
    }

    // ── Teammate & opponent catch detection ──────────
    if (!tipOffActiveNow && basketballData?.active && !basketballData.heldByPlayer) {
        for (const tm of teammates) {
            if (tm.stunTimer > 0) continue;
            if (tm._aiSitState) continue;
            if (tryTeammateCatch(basketballData, tm) || tryPickUpBasketball(basketballData, tm)) {
                tm._holdSeed = Math.random();
                break;
            }
        }
        // Opponents catch passes and pick up free balls
        for (const opp of opponents) {
            if (opp.stunTimer > 0) continue;
            if (opp._aiSitState) continue;
            // Try catching a pass first (chest height), then ground pickup
            if (tryTeammateCatch(basketballData, opp) || tryPickUpBasketball(basketballData, opp)) {
                opp._holdSeed = Math.random();
                break;
            }
        }
    }
    if (tipOffActiveNow) updateTipOffState(0);

    // ── Stamina system ────────────────────────────────
    if (playerData && cameraMode === 'player') {
        updateStaminaForPlayer(playerData, delta, !!sitState);
        updatePlayerStaminaHUD(playerData);
        updateStaminaBar(playerData, camera); // 3D bar (visible when not full)
    }
    for (const tm of teammates) {
        if (!tm.group.visible) continue;
        const tmSitting = !!tm._aiSitState;
        updateStaminaForPlayer(tm, delta, tmSitting);
        if (matchLive) updateAISitting(tm, delta);
        updateStaminaBar(tm, camera);
    }
    for (const opp of opponents) {
        if (!opp.group.visible) continue;
        const oppSitting = !!opp._aiSitState;
        updateStaminaForPlayer(opp, delta, oppSitting);
        if (matchLive) updateAISitting(opp, delta);
        updateStaminaBar(opp, camera);
    }

    updateScoringSystem(delta);
    updateShootingArc(delta);
    updatePassLine(delta);
    updateBallLocatorIndicators(delta);

    updateDayNight(delta);

    for (const net of animatedNets) {
        const idx = net.userData.netIndex || 0;
        net.rotation.x = Math.sin(stabilizedElapsed * 1.5 + idx * 0.5) * 0.02;
        net.rotation.z = Math.cos(stabilizedElapsed * 1.2 + idx * 0.3) * 0.015;
    }

    for (const leaf of animatedLeaves) {
        leaf.rotation.y += delta * 0.05 * (leaf.userData.leafSway || 1);
    }

    renderer.render(scene, camera);
}

// ─── Resize Handler ─────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Expose for UI buttons ─────────────────────────────────
window.switchCameraMode = switchCameraMode;
window.toggleTransparentHelpers = toggleTransparentHelpers;
window.toggleDayNight = toggleDayNight;
window.dropBall = dropBall;
window.addTeammate = addTeammate;
window.addOpponent = addOpponent;
window.startSoloGame = startSoloGame;
window.startFreePlay = startFreePlay;

// ─── Start ──────────────────────────────────────────────────
setGameplayHudVisible(false);
buildScene();
animate();
