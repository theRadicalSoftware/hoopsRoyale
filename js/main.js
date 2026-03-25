import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCourt } from './court.js';
import { createHoops } from './hoops.js';
import { createPark } from './park.js';
import { createCity } from './city.js';
import { createLighting } from './lighting.js';
import { createPlayer, updatePlayer } from './player.js';
import { createBasketball, dropBasketballAtCenter, tryPickUpBasketball, updateBasketball, shootBasketball } from './ball.js';

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
let shootQueued = false;
let cancelShootQueued = false;
let shootingStance = false;   // true when player is in aiming/shooting stance
let shootAngle = 52;          // current launch angle in degrees
const SHOOT_ANGLE_MIN = 38;
const SHOOT_ANGLE_MAX = 70;
const SHOOT_ANGLE_SPEED = 28; // degrees per second
let hoopColliders = [];
let parkColliders = [];
let playerColliders = [];
const playerInput = { forward: false, backward: false, left: false, right: false, jump: false };
const shootInput = { aimUp: false, aimDown: false, turnLeft: false, turnRight: false };
const animatedNets = [];
const animatedLeaves = [];

const freeRoamForward = new THREE.Vector3();
const freeRoamRight = new THREE.Vector3();
const freeRoamVelocity = new THREE.Vector3();
const freeRoamLookDir = new THREE.Vector3();
const freeRoamLookTarget = new THREE.Vector3();
const playerCameraTarget = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const playerMoveForward = new THREE.Vector3();
const playerMoveRight = new THREE.Vector3();
const playerMoveBasis = { forward: playerMoveForward, right: playerMoveRight };
let smoothedDelta = 1 / 60;
let stabilizedElapsed = 0;
let gameStarted = false;
let startMenuActive = false;
const START_ORBIT_SPEED = 0.09;
const startOrbitCenter = new THREE.Vector3(0, 1.15, 0);
let startOrbitRadius = 34;
let startOrbitAngle = 0;
let startOrbitHeight = 13.5;

const startMenu = document.getElementById('start-menu');
const uiOverlay = document.getElementById('ui-overlay');
const uiButtons = document.getElementById('ui-buttons');
const controlsHint = document.getElementById('controls-hint');

function setGameplayHudVisible(visible) {
    const method = visible ? 'remove' : 'add';
    uiOverlay?.classList[method]('hud-hidden');
    uiButtons?.classList[method]('hud-hidden');
    controlsHint?.classList[method]('hud-hidden');
}

function setupStartMenuOrbit() {
    const dx = camera.position.x - startOrbitCenter.x;
    const dz = camera.position.z - startOrbitCenter.z;
    startOrbitRadius = THREE.MathUtils.clamp(Math.hypot(dx, dz), 20, 58);
    startOrbitAngle = Math.atan2(dx, dz);
    startOrbitHeight = THREE.MathUtils.clamp(camera.position.y, 9, 24);
}

function updateStartMenuCamera(delta) {
    startOrbitAngle -= START_ORBIT_SPEED * delta; // clockwise
    const yBob = Math.sin(stabilizedElapsed * 0.22) * 0.15;
    camera.position.set(
        startOrbitCenter.x + Math.sin(startOrbitAngle) * startOrbitRadius,
        startOrbitHeight + yBob,
        startOrbitCenter.z + Math.cos(startOrbitAngle) * startOrbitRadius
    );
    camera.lookAt(startOrbitCenter);
}

function showStartMenu() {
    startMenuActive = true;
    gameStarted = false;
    if (isPointerLocked) document.exitPointerLock();
    controls.enabled = false;
    setupStartMenuOrbit();
    setGameplayHudVisible(false);

    if (startMenu) {
        startMenu.style.display = 'flex';
        startMenu.classList.remove('fade-out');
        startMenu.classList.add('active');
        startMenu.setAttribute('aria-hidden', 'false');
    }
}

function startGame() {
    if (!startMenuActive) return;

    startMenuActive = false;
    gameStarted = true;

    if (startMenu) {
        startMenu.classList.remove('active');
        startMenu.classList.add('fade-out');
        startMenu.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!startMenuActive && startMenu) startMenu.style.display = 'none';
        }, 560);
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
    // Reset shooting stance if active
    if (shootingStance) {
        shootingStance = false;
        basketballData._shootingStance = false;
        shootAngle = 52;
        shootQueued = false;
        cancelShootQueued = false;
        Object.keys(shootInput).forEach(k => shootInput[k] = false);
    }
    dropBasketballAtCenter(basketballData);

    const btn = document.getElementById('btn-balldrop');
    if (btn) {
        btn.style.background = 'rgba(255, 138, 51, 0.85)';
        setTimeout(() => {
            btn.style.background = '';
        }, 220);
    }
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

function applyDayNightState(t) {
    // t: 0 = day, 1 = night

    // Fog color
    const dayFog = new THREE.Color(0x87CEEB);
    const nightFog = new THREE.Color(0x0a0a1a);
    scene.fog.color.copy(dayFog).lerp(nightFog, t);

    // Tone mapping exposure
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.1, 0.45, t);

    // Sky blend via background color (smooth transition)
    if (t < 0.5) {
        scene.background = daySkyTexture;
    } else {
        scene.background = nightSkyTexture;
    }

    // Update lights
    if (lightingGroup) {
        lightingGroup.traverse((child) => {
            if (child.isLight) {
                if (child.userData.lightRole === 'sun') {
                    child.intensity = THREE.MathUtils.lerp(1.8, 0.05, t);
                    child.color.copy(new THREE.Color(0xffeedd).lerp(new THREE.Color(0x222244), t));
                } else if (child.userData.lightRole === 'ambient') {
                    child.intensity = THREE.MathUtils.lerp(0.45, 0.12, t);
                } else if (child.userData.lightRole === 'hemi') {
                    child.intensity = THREE.MathUtils.lerp(0.5, 0.08, t);
                } else if (child.userData.lightRole === 'fill') {
                    child.intensity = THREE.MathUtils.lerp(0.35, 0.02, t);
                } else if (child.userData.lightRole === 'rim') {
                    child.intensity = THREE.MathUtils.lerp(0.25, 0.0, t);
                } else if (child.userData.lightRole === 'lamppost') {
                    // Lamp posts illuminate brightly at night
                    if (child.isSpotLight) {
                        child.intensity = THREE.MathUtils.lerp(0.5, 4.0, t);
                    } else {
                        child.intensity = THREE.MathUtils.lerp(0.15, 2.0, t);
                        child.distance = THREE.MathUtils.lerp(12, 25, t);
                    }
                } else if (child.userData.lightRole === 'moon') {
                    // Moonlight fades in at night
                    child.intensity = THREE.MathUtils.lerp(0.0, 0.35, t);
                }
            }
        });
    }

    // Sun & Moon 3D objects
    if (sunMesh) {
        sunMesh.material.opacity = THREE.MathUtils.lerp(1.0, 0.0, t);
        sunMesh.children.forEach(c => {
            if (c.material) c.material.opacity = THREE.MathUtils.lerp(c === sunMesh.children[0] ? 0.15 : 0.06, 0.0, t);
        });
    }
    if (moonMesh) {
        moonMesh.material.opacity = THREE.MathUtils.lerp(0.0, 0.95, t);
        moonMesh.traverse(c => {
            if (c === moonMesh) return;
            if (c.material && c.userData.isMoonCrater) {
                c.material.opacity = THREE.MathUtils.lerp(0.0, 0.5, t);
            } else if (c.material && c.userData.isMoonHalo) {
                c.material.opacity = THREE.MathUtils.lerp(0.0, 0.04, t);
            } else if (c === moonGlowMesh && c.material) {
                c.material.opacity = THREE.MathUtils.lerp(0.0, 0.1, t);
            }
        });
    }

    // Window & lamp bulb glow at night
    scene.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
            if (child.userData.isWindowLit) {
                child.material.emissiveIntensity = THREE.MathUtils.lerp(0.4, 2.5, t);
            } else if (child.userData.isWindowDark) {
                child.material.emissiveIntensity = THREE.MathUtils.lerp(0.15, 0.8, t);
            } else if (child.userData.isLampBulb) {
                // Lamp bulbs glow bright warm at night
                child.material.emissiveIntensity = THREE.MathUtils.lerp(0.3, 4.0, t);
                child.material.opacity = THREE.MathUtils.lerp(0.35, 1.0, t);
            }
        }
    });
}

// ─── Loading ────────────────────────────────────────────────
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingScreen = document.getElementById('loading-screen');

function updateLoading(progress, text) {
    loadingBar.style.width = progress + '%';
    loadingText.textContent = text;
}

// ─── Build Scene ────────────────────────────────────────────
async function buildScene() {
    updateLoading(5, 'Painting the sky...');
    daySkyTexture = createSkyTexture('day');
    nightSkyTexture = createSkyTexture('night');
    scene.background = daySkyTexture;
    scene.environment = daySkyTexture;
    await delay(80);

    updateLoading(15, 'Laying the court surface...');
    createCourt(scene);
    await delay(80);

    updateLoading(30, 'Setting up the hoops...');
    createHoops(scene);
    hoopColliders = scene.userData.hoopColliders || [];
    playerColliders = hoopColliders.concat(parkColliders);
    await delay(80);

    updateLoading(45, 'Planting trees & scenery...');
    createPark(scene);
    parkColliders = scene.userData.parkColliders || [];
    playerColliders = hoopColliders.concat(parkColliders);
    await delay(80);

    updateLoading(60, 'Building the city...');
    createCity(scene);
    await delay(80);

    updateLoading(80, 'Adjusting the lighting...');
    lightingGroup = createLighting(scene);
    await delay(80);

    updateLoading(82, 'Creating player...');
    playerData = createPlayer(scene);
    await delay(80);

    updateLoading(85, 'Preparing basketball...');
    basketballData = createBasketball(scene);
    await delay(80);

    updateLoading(88, 'Placing celestial bodies...');
    createCelestialBodies();
    await delay(80);

    updateLoading(92, 'Final touches...');
    collectTransparentObjects();
    collectAnimatedObjects();
    tagCityWindows();
    await delay(100);

    updateLoading(100, 'Game on!');
    await delay(500);
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.style.display = 'none', 1000);
    setTimeout(() => showStartMenu(), 650);
}

function tagCityWindows() {
    scene.traverse((child) => {
        if (child.isMesh && child.material) {
            // Tag lit windows
            if (child.material.emissive && child.material.emissive.getHex() === 0xffcc66) {
                child.userData.isWindowLit = true;
            }
            // Tag dark windows
            if (child.material.emissive && child.material.emissive.getHex() === 0x334455) {
                child.userData.isWindowDark = true;
            }
            // Tag lamp bulbs
            if (child.material.emissive && child.material.emissive.getHex() === 0xffeebb &&
                child.material.transparent) {
                child.userData.isLampBulb = true;
            }
        }
    });
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        if (shootingStance) {
            // In shooting stance: W/S = aim angle, A/D = turn, X = shoot, C = cancel
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': shootInput.aimUp = true; e.preventDefault(); break;
                case 'ArrowDown':  case 'KeyS': shootInput.aimDown = true; e.preventDefault(); break;
                case 'ArrowLeft':  case 'KeyA': shootInput.turnLeft = true; e.preventDefault(); break;
                case 'ArrowRight': case 'KeyD': shootInput.turnRight = true; e.preventDefault(); break;
                case 'KeyX': shootQueued = true; e.preventDefault(); break;
                case 'KeyC': cancelShootQueued = true; e.preventDefault(); break;
            }
        } else {
            switch (e.code) {
                case 'ArrowUp':    case 'KeyW': playerInput.forward = true; e.preventDefault(); break;
                case 'ArrowDown':  case 'KeyS': playerInput.backward = true; e.preventDefault(); break;
                case 'ArrowLeft':  case 'KeyA': playerInput.left = true; e.preventDefault(); break;
                case 'ArrowRight': case 'KeyD': playerInput.right = true; e.preventDefault(); break;
                case 'Space': playerInput.jump = true; e.preventDefault(); break;
                case 'KeyZ': pickupQueued = true; e.preventDefault(); break;
                case 'KeyX':
                    // Enter shooting stance if holding ball and grounded
                    if (basketballData?.heldByPlayer && playerData?.isGrounded) {
                        shootQueued = true;
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
        Object.keys(playerInput).forEach(k => playerInput[k] = false);
        Object.keys(shootInput).forEach(k => shootInput[k] = false);
        pickupQueued = false;
        shootQueued = false;
        cancelShootQueued = false;
        shootingStance = false;
        shootAngle = 52;
    }

    cameraMode = mode;

    if (mode === 'orbit') {
        if (isPointerLocked) document.exitPointerLock();
        controls.enabled = true;
        controls.target.set(0, 1, 0);
        controls.minDistance = 5;
        controls.maxDistance = 150;
        controls.update();
        Object.keys(moveState).forEach(k => moveState[k] = false);
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
        Object.keys(moveState).forEach(k => moveState[k] = false);
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
            hint.textContent = 'WASD / Arrows to walk | Space jump | Z pick up ball | X shoot (hold ball) | In shot stance: W/S aim angle, A/D turn, X shoot, C cancel';
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
    smoothedDelta += (clampedDelta - smoothedDelta) * 0.18;
    const delta = smoothedDelta;
    stabilizedElapsed += delta;

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

        if (pickupQueued && basketballData && !basketballData.heldByPlayer) {
            tryPickUpBasketball(basketballData, playerData);
            pickupQueued = false;
        }

        // ── Shooting state machine ────────────────────────
        if (shootingStance) {
            // Cancel shooting stance
            if (cancelShootQueued) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
                shootAngle = 52;
                cancelShootQueued = false;
                shootQueued = false;
                Object.keys(shootInput).forEach(k => shootInput[k] = false);
            }
            // Ball was lost (dribble collision, etc.)
            else if (!basketballData?.heldByPlayer) {
                shootingStance = false;
                if (basketballData) basketballData._shootingStance = false;
                shootAngle = 52;
                shootQueued = false;
                Object.keys(shootInput).forEach(k => shootInput[k] = false);
            }
            // Fire the shot
            else if (shootQueued) {
                basketballData._shootingStance = false;
                shootBasketball(basketballData, playerData, shootAngle);
                shootingStance = false;
                shootAngle = 52;
                shootQueued = false;
                Object.keys(shootInput).forEach(k => shootInput[k] = false);
            }
            else {
                // Adjust aim angle with W/S
                if (shootInput.aimUp) {
                    shootAngle = Math.min(SHOOT_ANGLE_MAX, shootAngle + SHOOT_ANGLE_SPEED * delta);
                }
                if (shootInput.aimDown) {
                    shootAngle = Math.max(SHOOT_ANGLE_MIN, shootAngle - SHOOT_ANGLE_SPEED * delta);
                }

                // Turn player with A/D (rotate facing angle directly)
                const turnRate = 2.2; // radians per second
                if (shootInput.turnLeft) {
                    playerData.facingAngle -= turnRate * delta;
                    playerData.group.rotation.y = playerData.facingAngle;
                }
                if (shootInput.turnRight) {
                    playerData.facingAngle += turnRate * delta;
                    playerData.group.rotation.y = playerData.facingAngle;
                }
            }

            // Zero movement input so player stands still
            Object.keys(playerInput).forEach(k => playerInput[k] = false);
        } else if (shootQueued && basketballData?.heldByPlayer && playerData?.isGrounded) {
            // Enter shooting stance
            shootingStance = true;
            basketballData._shootingStance = true;
            shootQueued = false;
            // Stop the player
            playerData.velocity.set(0, 0, 0);
            Object.keys(playerInput).forEach(k => playerInput[k] = false);
        } else {
            shootQueued = false;
        }

        const carryState = basketballData?.heldByPlayer
            ? {
                holding: true,
                shooting: shootingStance,
                dribbling: !shootingStance && !!basketballData.dribblingByPlayer,
                dribblePhase: basketballData.dribblePhase || 0
            }
            : null;

        updatePlayer(playerData, delta, playerInput, playerMoveBasis, playerColliders, carryState);

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

    updateBasketball(basketballData, delta, playerColliders, playerData);

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
window.startGame = startGame;

// ─── Start ──────────────────────────────────────────────────
setGameplayHudVisible(false);
buildScene();
animate();
