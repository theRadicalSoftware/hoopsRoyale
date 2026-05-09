// ─── Hoops Royale Audio Engine ─────────────────────────────
// Pure procedural Web Audio synthesis — no external sample files, no
// network dependencies. Mirrors the project's "all procedural textures"
// aesthetic and ships subtle, tuned-down volumes by default. Each sound
// is a small chain of oscillators / filtered noise routed through a
// master gain so the whole bus can be muted in one ramp.
//
// Public API: ensureContext / resumeAudio / setMuted / toggleMute
// /isMuted / setMasterVolume + named playX() helpers.
//
// 3D positional sounds accept an optional { position, camera } and use
// distance attenuation + stereo panning.

import * as THREE from 'three';

let ctx = null;
let masterGain = null;
let muted = false;
let initialized = false;
let masterVolume = 0.55;          // soft default
let _noiseBuffer = null;
let _ambientNodes = null;

const KEY_MUTE   = 'hr_audio_muted';
const KEY_VOLUME = 'hr_audio_volume';

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();

// ─── Init ───────────────────────────────────────────────────

function buildNoiseBuffer() {
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 2, sr); // 2s loop, plenty for one-shots
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    _noiseBuffer = buf;
}

function ensureContext() {
    if (initialized) return ctx;
    try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        masterGain = ctx.createGain();

        const storedVol = parseFloat(localStorage.getItem(KEY_VOLUME) || 'NaN');
        if (!Number.isNaN(storedVol)) masterVolume = Math.max(0, Math.min(1, storedVol));
        if (localStorage.getItem(KEY_MUTE) === '1') muted = true;

        masterGain.gain.value = muted ? 0 : masterVolume;
        masterGain.connect(ctx.destination);

        buildNoiseBuffer();
        initialized = true;
    } catch (e) {
        console.warn('[audio] init failed', e);
    }
    return ctx;
}

export function resumeAudio() {
    if (!initialized) ensureContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
}

export function isMuted() { return muted; }

export function setMuted(m) {
    ensureContext();
    muted = !!m;
    localStorage.setItem(KEY_MUTE, muted ? '1' : '0');
    if (masterGain && ctx) {
        const target = muted ? 0 : masterVolume;
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(target, now + 0.08);
    }
}

export function toggleMute() {
    setMuted(!muted);
    return muted;
}

export function setMasterVolume(v) {
    ensureContext();
    masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem(KEY_VOLUME, String(masterVolume));
    if (!muted && masterGain && ctx) {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(masterVolume, now + 0.06);
    }
}

export function getMasterVolume() { return masterVolume; }

// ─── 3D positional helpers ─────────────────────────────────

function compute3D(position, camera, maxDist) {
    if (!camera || !position) return { vol: 1, pan: 0 };
    _v3a.copy(position);
    const dx = _v3a.x - camera.position.x;
    const dy = _v3a.y - camera.position.y;
    const dz = _v3a.z - camera.position.z;
    const dist = Math.hypot(dx, dy, dz);
    const vol = dist >= maxDist ? 0 : Math.max(0, 1 - (dist / maxDist));
    if (vol < 0.02) return { vol: 0, pan: 0 };

    // Pan: project relative position onto camera right vector
    camera.getWorldDirection(_v3b);
    _v3c.copy(_v3b).cross(camera.up).normalize();
    const horizDist = Math.max(Math.hypot(dx, dz), 0.5);
    const pan = Math.max(-1, Math.min(1, (dx * _v3c.x + dz * _v3c.z) / horizDist));
    return { vol, pan };
}

function makeOutput(volume, pan = 0) {
    const gain = ctx.createGain();
    gain.gain.value = volume;
    if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gain.connect(panner);
        panner.connect(masterGain);
    } else {
        gain.connect(masterGain);
    }
    return gain;
}

// Throttle: prevent sound spam from rapid-fire triggers
const _lastPlay = new Map();
function throttle(key, minIntervalMs) {
    const now = performance.now();
    const last = _lastPlay.get(key) || 0;
    if (now - last < minIntervalMs) return false;
    _lastPlay.set(key, now);
    return true;
}

// ─── Sound generators ─────────────────────────────────────

// Ball bounce on floor — soft rubber thud (two-layer: low body + filtered noise pop)
export function playBounce(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('bounce', 35)) return;
    const { intensity = 1, position = null, camera = null, hard = false } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 35) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.5, intensity));

    // Layer 1: filtered noise burst (the rubber slap)
    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 0.35 + Math.random() * 0.18;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = hard ? 320 : 240;
    lp.Q.value = 1.4;
    const ng = makeOutput(0.16 * vol * I, pan);
    ng.gain.setValueAtTime(0.16 * vol * I, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    noise.connect(lp).connect(ng);
    noise.start(now);
    noise.stop(now + 0.1);

    // Layer 2: low-frequency body
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = (hard ? 140 : 110) + Math.random() * 18;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 0.07);
    const og = makeOutput(0.10 * vol * I, pan);
    og.gain.setValueAtTime(0.10 * vol * I, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(og);
    osc.start(now);
    osc.stop(now + 0.09);
}

// Rim hit — bright metallic ping
export function playRim(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('rim', 25)) return;
    const { intensity = 1, position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 35) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.5, intensity));

    const freqs = [880 + Math.random() * 80, 1320 + Math.random() * 100];
    for (let i = 0; i < freqs.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freqs[i];
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freqs[i];
        bp.Q.value = 9;
        const layerVol = 0.10 * vol * I * (i === 0 ? 1 : 0.55);
        const g = makeOutput(layerVol, pan);
        g.gain.setValueAtTime(layerVol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18 + i * 0.05);
        osc.connect(bp).connect(g);
        osc.start(now);
        osc.stop(now + 0.25);
    }
}

// Swish through chain net — high-frequency shimmer
export function playSwish(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('swish', 80)) return;
    const { position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 35) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 1.0 + Math.random() * 0.2;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200;
    bp.Q.value = 2.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = makeOutput(0.18 * vol, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18 * vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    noise.connect(bp).connect(hp).connect(g);
    noise.start(now);
    noise.stop(now + 0.36);
}

// Backboard hit — wood-glass thunk
export function playBackboard(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('backboard', 40)) return;
    const { intensity = 1, position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 35) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.5, intensity));

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.10);
    const og = makeOutput(0.13 * vol * I, pan);
    og.gain.setValueAtTime(0.13 * vol * I, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(og);
    osc.start(now);
    osc.stop(now + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 0.9;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 1.8;
    const ng = makeOutput(0.07 * vol * I, pan);
    ng.gain.setValueAtTime(0.07 * vol * I, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(bp).connect(ng);
    noise.start(now);
    noise.stop(now + 0.06);
}

// Punch impact — body thud
export function playPunch(opts = {}) {
    if (!ensureContext() || muted) return;
    const { intensity = 1, position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 30) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.5, intensity));

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.10);
    const og = makeOutput(0.20 * vol * I, pan);
    og.gain.setValueAtTime(0.20 * vol * I, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(og);
    osc.start(now);
    osc.stop(now + 0.18);

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    const ng = makeOutput(0.10 * vol * I, pan);
    ng.gain.setValueAtTime(0.10 * vol * I, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(lp).connect(ng);
    noise.start(now);
    noise.stop(now + 0.08);
}

// Sneaker squeak — short tonal chirp
export function playSqueak(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('squeak', 220)) return;
    const { intensity = 1, position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 22) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.5, intensity));

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = 1100 + Math.random() * 350;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.55, now + 0.10);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = baseFreq;
    bp.Q.value = 6;
    const g = makeOutput(0.06 * vol * I, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06 * vol * I, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(bp).connect(g);
    osc.start(now);
    osc.stop(now + 0.15);
}

// Referee whistle — bright tonal blast with trill
export function playWhistle(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('whistle', 250)) return;
    const { duration = 0.32 } = opts;
    resumeAudio();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2400;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 32;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(osc.frequency);

    const g = makeOutput(0.14, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.025);
    g.gain.linearRampToValueAtTime(0.14, now + duration - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    lfo.start(now);
    lfo.stop(now + duration + 0.02);
}

// Score chime — quick double sine, subtle
export function playScoreChime(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('chime', 200)) return;
    const { isThree = false } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const notes = isThree ? [659.25, 880, 1046.5] : [659.25, 880]; // E5 A5 (+C6 for 3)
    for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        const start = now + i * 0.07;
        const g = makeOutput(0.10, 0);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.10, start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
        osc.connect(g);
        osc.start(start);
        osc.stop(start + 0.35);
    }
}

// UI click — soft tap (menus, mute toggle)
export function playUiClick() {
    if (!ensureContext() || muted) return;
    resumeAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
    const g = makeOutput(0.07, 0);
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.1);
}

// Steal swipe — quick whoosh (fires on every reach attempt)
export function playSwipe(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('swipe', 80)) return;
    const { position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 22) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 1.0;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2000, now);
    bp.frequency.exponentialRampToValueAtTime(750, now + 0.18);
    bp.Q.value = 2.5;
    const g = makeOutput(0.08 * vol, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08 * vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    noise.connect(bp).connect(g);
    noise.start(now);
    noise.stop(now + 0.22);
}

// Steal success — sharp affirmative blip
export function playStealSuccess(opts = {}) {
    if (!ensureContext() || muted) return;
    const { position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 28) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    const g = makeOutput(0.11 * vol, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.11 * vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.2);
}

// Dunk slam — combined low thud + rim ring (composed)
export function playDunk(opts = {}) {
    if (!ensureContext() || muted) return;
    const { position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;

    playRim({ intensity: 1.4, position, camera });

    const { vol, pan } = position && camera ? compute3D(position, camera, 35) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const g = makeOutput(0.18 * vol, pan);
    g.gain.setValueAtTime(0.18 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.28);
}

// Jump landing — a fainter version of bounce, for player feet
export function playLand(opts = {}) {
    if (!ensureContext() || muted) return;
    if (!throttle('land', 80)) return;
    const { intensity = 1, position = null, camera = null } = opts;
    resumeAudio();
    const now = ctx.currentTime;
    const { vol, pan } = position && camera ? compute3D(position, camera, 25) : { vol: 1, pan: 0 };
    if (vol < 0.02) return;
    const I = Math.max(0.25, Math.min(1.2, intensity));

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = makeOutput(0.08 * vol * I, pan);
    g.gain.setValueAtTime(0.08 * vol * I, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(lp).connect(g);
    noise.start(now);
    noise.stop(now + 0.14);
}

// ─── Ambient pad ────────────────────────────────────────────
// Subtle filtered-noise wash + slow LFO breathing — a touch of distant
// city/park atmosphere. Started when game enters live play, stopped on
// menu.
export function startAmbient() {
    if (!ensureContext() || muted) return;
    if (_ambientNodes) return;
    resumeAudio();
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = _noiseBuffer;
    noise.loop = true;
    noise.playbackRate.value = 0.42;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.025, now + 1.5);
    g.connect(masterGain);

    noise.connect(hp).connect(lp).connect(g);
    noise.start(now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.012;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start(now);

    _ambientNodes = { noise, lp, hp, g, lfo };
}

export function stopAmbient() {
    if (!_ambientNodes || !ctx) return;
    const { noise, g, lfo } = _ambientNodes;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.5);
    setTimeout(() => {
        try { noise.stop(); } catch (_) {}
        try { lfo.stop(); } catch (_) {}
    }, 600);
    _ambientNodes = null;
}

// Convenience initializer — call once on first user interaction so the
// AudioContext is unlocked. Browsers block AudioContext.start() until a
// user gesture, so main.js calls this from the first click/keypress.
export function initOnFirstGesture() {
    ensureContext();
    resumeAudio();
}
