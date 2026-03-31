import * as THREE from 'three';

// ─── Constants ──────────────────────────────────────────────
const PLAYER_HEIGHT = 1.88;        // realistic basketball player height
const WALK_SPEED    = 4.5;
const JUMP_FORCE    = 6.5;
const GRAVITY       = -16.0;
const ACCELERATION  = 24.0;
const DECELERATION  = 28.0;
const ARM_SWING     = 0.55;
const LEG_SWING     = 0.65;
const KNEE_BEND_MAX = 0.55;
const ELBOW_BEND    = 0.35;
const TURN_SPEED    = 10;
const MOVE_BLEND_IN_SPEED = 14.0;
const MOVE_BLEND_OUT_SPEED = 10.0;
const PLAYER_COLLIDER_RADIUS = 0.22;
const STAMINA_ARC_RADIUS = 0.49;
const STAMINA_ARC_SWEEP = Math.PI * 1.10;
const STAMINA_ARC_SEGMENTS = 72;

// ── Stun constants ──────────────────────────────────────
const STUN_DURATION   = 1.8;     // total stun time in seconds
const STUN_RAMP_TIME  = 0.1;     // time for flinch to reach full intensity
const STUN_RECOIL     = 3.5;     // initial recoil speed (decays over stun)
const PUNCH_HIT_RADIUS = 0.55;   // how close fist must be to target center to register a hit
const COLLISION_EPSILON = 1e-4;
const PLAYER_FOOT_OFFSET = 0.265; // local Y from root origin to sole bottom
const GROUNDED_Y = -PLAYER_FOOT_OFFSET;

const tmpInputDir = new THREE.Vector3();
const tmpTargetVel = new THREE.Vector3();
const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);

function createStaminaArcPoints(radius, sweep, segments) {
    const pts = [];
    const start = -sweep * 0.5;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = start + t * sweep;
        pts.push(new THREE.Vector3(Math.sin(a) * radius, 0, Math.cos(a) * radius));
    }
    return pts;
}

// ─── Create Player ─────────────────────────────────────────
export function createPlayer(scene, options = {}) {
    const jerseyColor = options.jerseyColor ?? 0xcc2222;
    const skinColor = options.skinColor ?? 0x8B6C42;
    const shoeColor = options.shoeColor ?? 0xeeeeee;
    const spawnPos = options.spawnPosition ?? { x: 0, y: GROUNDED_Y, z: 4 };
    const spawnAngle = options.facingAngle ?? Math.PI;
    const playerName = options.name ?? 'player';
    const startVisible = options.visible ?? false;
    const jerseyNumber = options.jerseyNumber ?? null;

    const root = new THREE.Group();
    root.name = playerName;

    // ── Materials ────────────────────────────────────────
    const skinMat = new THREE.MeshStandardMaterial({
        color: skinColor, roughness: 0.72, metalness: 0.02
    });
    const jerseyMat = new THREE.MeshStandardMaterial({
        color: jerseyColor, roughness: 0.82, metalness: 0.0
    });
    const shortsMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e, roughness: 0.8, metalness: 0.0
    });
    const shoeMat = new THREE.MeshStandardMaterial({
        color: shoeColor, roughness: 0.55, metalness: 0.08
    });
    const solesMat = new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.9, metalness: 0.0
    });
    const headbandMat = new THREE.MeshStandardMaterial({
        color: jerseyColor, roughness: 0.7, metalness: 0.0
    });
    const sockMat = new THREE.MeshStandardMaterial({
        color: 0xdddddd, roughness: 0.8, metalness: 0.0
    });

    const joints = {};

    // ── Head ─────────────────────────────────────────────
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 16, 12),
        skinMat
    );
    head.position.y = PLAYER_HEIGHT - 0.105;
    head.castShadow = true;
    root.add(head);

    // Headband
    const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.013, 8, 20),
        headbandMat
    );
    headband.position.y = PLAYER_HEIGHT - 0.08;
    headband.rotation.x = Math.PI / 2;
    root.add(headband);

    // ── Neck ─────────────────────────────────────────────
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.048, 0.08, 8),
        skinMat
    );
    neck.position.y = PLAYER_HEIGHT - 0.25;
    root.add(neck);

    // ── Torso (jersey) ──────────────────────────────────
    // Upper torso — shoulders
    const upperTorso = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.20, 0.20),
        jerseyMat
    );
    upperTorso.position.y = 1.46;
    upperTorso.castShadow = true;
    root.add(upperTorso);

    // Lower torso
    const lowerTorso = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.22, 0.18),
        jerseyMat
    );
    lowerTorso.position.y = 1.25;
    lowerTorso.castShadow = true;
    root.add(lowerTorso);

    // Jersey number on front and back
    if (jerseyNumber !== null) {
        const numCanvas = document.createElement('canvas');
        numCanvas.width = 64;
        numCanvas.height = 64;
        const nctx = numCanvas.getContext('2d');
        nctx.clearRect(0, 0, 64, 64);
        nctx.fillStyle = '#ffffff';
        nctx.font = 'bold 48px sans-serif';
        nctx.textAlign = 'center';
        nctx.textBaseline = 'middle';
        nctx.fillText(String(jerseyNumber), 32, 34);
        const numTex = new THREE.CanvasTexture(numCanvas);
        numTex.colorSpace = THREE.SRGBColorSpace;
        const numMat = new THREE.MeshBasicMaterial({
            map: numTex, transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        // Front number
        const numFront = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), numMat);
        numFront.position.set(0, 1.32, 0.10);
        root.add(numFront);
        // Back number (slightly larger)
        const numBack = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.20), numMat);
        numBack.position.set(0, 1.35, -0.10);
        numBack.rotation.y = Math.PI;
        root.add(numBack);
    }

    // ── Waist / shorts top ──────────────────────────────
    const waist = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.10, 0.17),
        shortsMat
    );
    waist.position.y = 1.10;
    root.add(waist);

    // ── Arms ────────────────────────────────────────────
    function buildArm(side) {
        const sign = side === 'left' ? -1 : 1;

        // Shoulder pivot
        const shoulderPivot = new THREE.Group();
        shoulderPivot.position.set(sign * 0.23, 1.52, 0);
        joints[side + 'Shoulder'] = shoulderPivot;

        // Shoulder cap (round)
        const shoulderCap = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 8, 8),
            jerseyMat
        );
        shoulderPivot.add(shoulderCap);

        // Upper arm
        const upperArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.034, 0.27, 8),
            skinMat
        );
        upperArm.position.y = -0.16;
        upperArm.castShadow = true;
        shoulderPivot.add(upperArm);

        // Elbow pivot
        const elbowPivot = new THREE.Group();
        elbowPivot.position.set(0, -0.30, 0);
        joints[side + 'Elbow'] = elbowPivot;
        shoulderPivot.add(elbowPivot);

        // Elbow joint (round)
        const elbowJoint = new THREE.Mesh(
            new THREE.SphereGeometry(0.032, 8, 8),
            skinMat
        );
        elbowPivot.add(elbowJoint);

        // Lower arm
        const lowerArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.028, 0.25, 8),
            skinMat
        );
        lowerArm.position.y = -0.13;
        lowerArm.castShadow = true;
        elbowPivot.add(lowerArm);

        // Wrist / hand
        const hand = new THREE.Mesh(
            new THREE.SphereGeometry(0.032, 8, 8),
            skinMat
        );
        hand.position.y = -0.27;
        elbowPivot.add(hand);

        root.add(shoulderPivot);
    }

    buildArm('left');
    buildArm('right');

    // ── Legs ────────────────────────────────────────────
    function buildLeg(side) {
        const sign = side === 'left' ? -1 : 1;

        // Hip pivot
        const hipPivot = new THREE.Group();
        hipPivot.position.set(sign * 0.09, 1.05, 0);
        joints[side + 'Hip'] = hipPivot;

        // Upper leg (shorts material — basketball shorts reach knee)
        const upperLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.058, 0.048, 0.36, 8),
            shortsMat
        );
        upperLeg.position.y = -0.18;
        upperLeg.castShadow = true;
        hipPivot.add(upperLeg);

        // Knee pivot
        const kneePivot = new THREE.Group();
        kneePivot.position.set(0, -0.36, 0);
        joints[side + 'Knee'] = kneePivot;
        hipPivot.add(kneePivot);

        // Knee joint (round)
        const kneeJoint = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 8, 8),
            skinMat
        );
        kneePivot.add(kneeJoint);

        // Shin (skin)
        const shin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.042, 0.035, 0.30, 8),
            skinMat
        );
        shin.position.y = -0.15;
        shin.castShadow = true;
        kneePivot.add(shin);

        // Sock
        const sock = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.036, 0.08, 8),
            sockMat
        );
        sock.position.y = -0.32;
        kneePivot.add(sock);

        // Shoe
        const shoe = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.07, 0.19),
            shoeMat
        );
        shoe.position.set(0, -0.38, 0.02);
        shoe.castShadow = true;
        kneePivot.add(shoe);

        // Sole
        const sole = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.02, 0.20),
            solesMat
        );
        sole.position.set(0, -0.415, 0.02);
        kneePivot.add(sole);

        root.add(hipPivot);
    }

    buildLeg('left');
    buildLeg('right');

    // ── Shadow catcher (small disc under player for grounding) ──
    const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = PLAYER_FOOT_OFFSET + 0.01;
    root.add(shadowDisc);

    // ── 3D Stamina bar (floats above head) ─────────────────
    const STAM_BAR_W = 0.52, STAM_BAR_H = 0.055;
    const staminaBarGroup = new THREE.Group();
    staminaBarGroup.position.set(0, PLAYER_HEIGHT + 0.18, 0);

    const barBgGeo = new THREE.PlaneGeometry(STAM_BAR_W + 0.02, STAM_BAR_H + 0.016);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthTest: false });
    const barBg = new THREE.Mesh(barBgGeo, barBgMat);
    barBg.renderOrder = 998;
    staminaBarGroup.add(barBg);

    const barFillGeo = new THREE.PlaneGeometry(STAM_BAR_W, STAM_BAR_H);
    const barFillMat = new THREE.MeshBasicMaterial({ color: 0x44dd66, transparent: true, opacity: 0.88, depthTest: false });
    const barFill = new THREE.Mesh(barFillGeo, barFillMat);
    barFill.renderOrder = 999;
    barFill.position.z = 0.001;
    staminaBarGroup.add(barFill);

    staminaBarGroup.visible = false;
    root.add(staminaBarGroup);

    // ── Under-foot stamina arc (2K-style thin inner arc) ─────────
    const staminaArcGroup = new THREE.Group();
    staminaArcGroup.position.set(0, PLAYER_FOOT_OFFSET + 0.028, 0);

    const arcPoints = createStaminaArcPoints(STAMINA_ARC_RADIUS, STAMINA_ARC_SWEEP, STAMINA_ARC_SEGMENTS);
    const arcTrackGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcTrackMat = new THREE.LineBasicMaterial({
        color: 0x2f2808,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
    });
    const arcTrack = new THREE.Line(arcTrackGeo, arcTrackMat);
    arcTrack.renderOrder = 993;
    staminaArcGroup.add(arcTrack);

    const arcFillGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcFillMat = new THREE.LineBasicMaterial({
        color: 0xf6d651,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false
    });
    const arcFill = new THREE.Line(arcFillGeo, arcFillMat);
    arcFill.renderOrder = 994;
    staminaArcGroup.add(arcFill);

    staminaArcGroup.visible = false;
    root.add(staminaArcGroup);

    // Start hidden unless options say otherwise
    root.visible = startVisible;
    root.position.set(spawnPos.x, spawnPos.y ?? GROUNDED_Y, spawnPos.z);
    root.rotation.y = spawnAngle;

    scene.add(root);

    return {
        group: root,
        joints,
        walkCycle: 0,
        moveBlend: 0,
        idleClock: 0,
        facingAngle: spawnAngle,
        jerseyColor,
        isTeammate: !!options.isTeammate,
        velocity: new THREE.Vector3(),
        velocityY: 0,
        isJumping: false,
        isGrounded: true,
        jumpPressed: false,
        visualGroundOffsetY: PLAYER_FOOT_OFFSET,
        speedMultiplier: 1.0,
        // ── Stamina ────────────────────────────────
        stamina: 100,
        maxStamina: 100,
        _staminaBarGroup: staminaBarGroup,
        _staminaBarFill: barFill,
        _staminaBarFillMat: barFillMat,
        _staminaBarW: STAM_BAR_W,
        _staminaBarVisible: 0,     // opacity lerp target for fade in/out
        _staminaArcGroup: staminaArcGroup,
        _staminaArcFill: arcFill,
        _staminaArcFillMat: arcFillMat,
        _staminaArcTrackMat: arcTrackMat,
        _staminaArcPointCount: STAMINA_ARC_SEGMENTS + 1,
        // ── Punch state ──────────────────────────────
        punchQueued: false,
        punchActive: false,
        punchPhase: 'none',    // 'extend' | 'hold' | 'retract' | 'none'
        punchElapsed: 0,
        punchHand: 'left',     // which hand is currently punching
        punchNextHand: 'right', // which hand punches next (alternates)
        // ── Stun state (from being punched) ─────────
        stunTimer: 0,          // countdown — when >0, player is stunned
        stunDirX: 0,           // XZ direction of the hit (for recoil)
        stunDirZ: 0,
        stunIntensity: 0       // blend factor for flinch pose (ramps up then decays)
    };
}

// ─── Update Player (called every frame) ─────────────────────
export function updatePlayer(pd, delta, input, movementBasis = null, colliders = null, carryState = null) {
    const { group, joints } = pd;
    if (!group.visible) return;

    const seated = !!carryState?.seated;
    if (seated) {
        pd.velocity.set(0, 0, 0);
        pd.velocityY = 0;
        pd.isGrounded = true;
        pd.isJumping = false;
        pd.jumpPressed = false;
        group.rotation.y = pd.facingAngle;
        animateLimbs(pd, false, delta, carryState);
        syncDynamicPlayerCollider(pd);
        return;
    }

    // ── Stun update ─────────────────────────────────────
    if (pd.stunTimer > 0) {
        pd.stunTimer -= delta;
        // Intensity ramps up fast then decays over stun duration
        if (pd.stunTimer > STUN_DURATION - STUN_RAMP_TIME) {
            // Ramp up phase
            const t = (STUN_DURATION - pd.stunTimer) / STUN_RAMP_TIME;
            pd.stunIntensity = Math.min(t * t * (3 - 2 * t), 1); // smoothstep in
        } else {
            // Decay phase — ease out over remaining time
            pd.stunIntensity = Math.max(pd.stunTimer / (STUN_DURATION - STUN_RAMP_TIME), 0);
        }
        if (pd.stunTimer <= 0) {
            pd.stunTimer = 0;
            pd.stunIntensity = 0;
        }
    }

    const isStunned = pd.stunTimer > 0;

    // ── Movement direction from arrow keys ───────────────
    const basisForward = movementBasis?.forward || WORLD_FORWARD;
    const basisRight = movementBasis?.right || WORLD_RIGHT;

    tmpInputDir.set(0, 0, 0);
    if (!isStunned) {
        if (input.forward)  tmpInputDir.add(basisForward);
        if (input.backward) tmpInputDir.sub(basisForward);
        if (input.left)     tmpInputDir.sub(basisRight);
        if (input.right)    tmpInputDir.add(basisRight);
    }
    tmpInputDir.y = 0;

    const hasMoveInput = tmpInputDir.lengthSq() > 0;

    if (hasMoveInput) {
        tmpInputDir.normalize();
    }

    // Velocity-based movement removes start/stop jitter and feels smoother.
    tmpTargetVel.copy(tmpInputDir).multiplyScalar(WALK_SPEED * (pd.speedMultiplier ?? 1));

    // Apply stun recoil — pushback in hit direction, decays with stun intensity
    if (isStunned) {
        const recoil = STUN_RECOIL * pd.stunIntensity;
        tmpTargetVel.x = pd.stunDirX * recoil;
        tmpTargetVel.z = pd.stunDirZ * recoil;
    }

    const moveResponse = hasMoveInput ? ACCELERATION : DECELERATION;
    const velLerp = 1 - Math.exp(-(isStunned ? 8 : moveResponse) * delta);
    pd.velocity.x += (tmpTargetVel.x - pd.velocity.x) * velLerp;
    pd.velocity.z += (tmpTargetVel.z - pd.velocity.z) * velLerp;

    group.position.x += pd.velocity.x * delta;
    group.position.z += pd.velocity.z * delta;

    const horizontalSpeed = Math.hypot(pd.velocity.x, pd.velocity.z);
    const isMoving = horizontalSpeed > 0.08;

    if (isMoving) {
        // Smoothly rotate player to face actual movement vector.
        const targetAngle = Math.atan2(pd.velocity.x, pd.velocity.z);
        let diff = targetAngle - pd.facingAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnLerp = 1 - Math.exp(-TURN_SPEED * delta);
        pd.facingAngle += diff * turnLerp;
        group.rotation.y = pd.facingAngle;

        // Advance walk cycle based on true speed so animation matches movement.
        pd.walkCycle += horizontalSpeed * delta * 3.2;
    }

    // ── Jump ─────────────────────────────────────────────
    if (input.jump && !pd.jumpPressed && pd.isGrounded && !isStunned) {
        pd.velocityY = JUMP_FORCE;
        pd.isGrounded = false;
        pd.isJumping = true;
        pd._justJumped = true;
    }
    pd.jumpPressed = input.jump;

    if (!pd.isGrounded) {
        pd.velocityY += GRAVITY * delta;
        group.position.y += pd.velocityY * delta;
        if (group.position.y <= GROUNDED_Y) {
            group.position.y = GROUNDED_Y;
            pd.velocityY = 0;
            pd.isGrounded = true;
            pd.isJumping = false;
        }
    }

    resolvePlayerCollisions(pd, colliders);
    syncDynamicPlayerCollider(pd);

    // ── Punch state machine ──────────────────────────────
    updatePunchState(pd, delta, carryState);

    // ── Animate limbs ────────────────────────────────────
    animateLimbs(pd, isMoving, delta, carryState);
}

const PLAYER_BROADPHASE_PAD = 0.5;

function syncDynamicPlayerCollider(pd) {
    const collider = pd?._collider;
    if (!collider) return;
    const pos = pd.group.position;
    const groundY = pos.y + (pd.visualGroundOffsetY || PLAYER_FOOT_OFFSET);
    collider.x = pos.x;
    collider.z = pos.z;
    collider.yMin = groundY;
    collider.yMax = groundY + PLAYER_HEIGHT;
    // Invalidate broadphase cache after movement.
    collider._pbpX = undefined;
    collider._pbpZ = undefined;
    collider._pbpR = undefined;
}

function ensurePlayerBroadphase(c) {
    if (c._pbpR !== undefined) return;
    if (c.type === 'cylinder') {
        c._pbpX = c.x;
        c._pbpZ = c.z;
        c._pbpR = c.radius + PLAYER_COLLIDER_RADIUS + PLAYER_BROADPHASE_PAD;
    } else if (c.type === 'aabb') {
        c._pbpX = (c.minX + c.maxX) * 0.5;
        c._pbpZ = (c.minZ + c.maxZ) * 0.5;
        const hw = (c.maxX - c.minX) * 0.5;
        const hz = (c.maxZ - c.minZ) * 0.5;
        c._pbpR = Math.sqrt(hw * hw + hz * hz) + PLAYER_COLLIDER_RADIUS + PLAYER_BROADPHASE_PAD;
    }
}

function resolvePlayerCollisions(pd, colliders) {
    if (!colliders || colliders.length === 0) return;

    let x = pd.group.position.x;
    let z = pd.group.position.z;
    const feetY = pd.group.position.y + PLAYER_FOOT_OFFSET;
    const headY = feetY + PLAYER_HEIGHT;
    const radius = PLAYER_COLLIDER_RADIUS;
    const radiusSq = radius * radius;

    for (let iter = 0; iter < 3; iter++) {
        let hadPenetration = false;

        for (const collider of colliders) {
            // Broadphase: skip colliders clearly too far away
            ensurePlayerBroadphase(collider);
            const bdx = x - collider._pbpX;
            const bdz = z - collider._pbpZ;
            if (bdx * bdx + bdz * bdz > collider._pbpR * collider._pbpR) continue;

            if (headY <= collider.yMin || feetY >= collider.yMax) continue;

            if (collider.type === 'cylinder') {
                const dx = x - collider.x;
                const dz = z - collider.z;
                const combined = radius + collider.radius;
                const combinedSq = combined * combined;
                const distSq = dx * dx + dz * dz;

                if (distSq < combinedSq) {
                    let nx = 1;
                    let nz = 0;
                    let dist = Math.sqrt(Math.max(distSq, 1e-10));

                    if (dist > 1e-5) {
                        nx = dx / dist;
                        nz = dz / dist;
                    } else {
                        const velLen = Math.hypot(pd.velocity.x, pd.velocity.z);
                        if (velLen > 1e-5) {
                            nx = pd.velocity.x / velLen;
                            nz = pd.velocity.z / velLen;
                        } else {
                            nx = x >= collider.x ? 1 : -1;
                            nz = 0;
                        }
                        dist = 0;
                    }

                    const penetration = combined - dist + COLLISION_EPSILON;
                    x += nx * penetration;
                    z += nz * penetration;
                    removeInwardVelocity(pd, nx, nz);
                    hadPenetration = true;
                }
                continue;
            }

            if (collider.type === 'aabb') {
                const closestX = Math.max(collider.minX, Math.min(x, collider.maxX));
                const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
                const dx = x - closestX;
                const dz = z - closestZ;
                const distSq = dx * dx + dz * dz;

                if (distSq >= radiusSq) continue;

                let nx = 1;
                let nz = 0;
                let penetration = 0;

                if (distSq > 1e-8) {
                    const dist = Math.sqrt(distSq);
                    nx = dx / dist;
                    nz = dz / dist;
                    penetration = radius - dist + COLLISION_EPSILON;
                } else {
                    // Center is inside the box projection; push out via nearest face.
                    const toMinX = Math.abs(x - collider.minX);
                    const toMaxX = Math.abs(collider.maxX - x);
                    const toMinZ = Math.abs(z - collider.minZ);
                    const toMaxZ = Math.abs(collider.maxZ - z);
                    const minDist = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);

                    if (minDist === toMinX) {
                        nx = -1; nz = 0; penetration = toMinX + radius + COLLISION_EPSILON;
                    } else if (minDist === toMaxX) {
                        nx = 1; nz = 0; penetration = toMaxX + radius + COLLISION_EPSILON;
                    } else if (minDist === toMinZ) {
                        nx = 0; nz = -1; penetration = toMinZ + radius + COLLISION_EPSILON;
                    } else {
                        nx = 0; nz = 1; penetration = toMaxZ + radius + COLLISION_EPSILON;
                    }
                }

                x += nx * penetration;
                z += nz * penetration;
                removeInwardVelocity(pd, nx, nz);
                hadPenetration = true;
            }
        }

        if (!hadPenetration) break;
    }

    pd.group.position.x = x;
    pd.group.position.z = z;
}

function removeInwardVelocity(pd, nx, nz) {
    const dot = pd.velocity.x * nx + pd.velocity.z * nz;
    if (dot < 0) {
        pd.velocity.x -= dot * nx;
        pd.velocity.z -= dot * nz;
    }
}

// ─── Punch system ───────────────────────────────────────────
const PUNCH_EXTEND_TIME  = 0.08;   // fast jab forward
const PUNCH_HOLD_TIME    = 0.04;   // brief peak
const PUNCH_RETRACT_TIME = 0.16;   // controlled pullback
const PUNCH_TOTAL_TIME   = PUNCH_EXTEND_TIME + PUNCH_HOLD_TIME + PUNCH_RETRACT_TIME;

// Hook punch pose — arm lifts outward to the side, fist swings forward in front
const PUNCH_SHOULDER_X   = -0.35;   // arm roughly horizontal, slightly forward
const PUNCH_ELBOW_X      = -1.25;   // bent elbow (~75° angle, proper hook form)
const PUNCH_SHOULDER_Y_L =  1.15;   // left fist drives forward and across in front
const PUNCH_SHOULDER_Y_R = -1.15;   // right fist drives forward and across in front
const PUNCH_SHOULDER_Z_L = -1.15;   // left arm lifts OUT to the left (away from body)
const PUNCH_SHOULDER_Z_R =  1.15;   // right arm lifts OUT to the right (away from body)

function updatePunchState(pd, delta, carryState) {
    // Don't punch during shooting, sitting, dunking, or stun
    if (carryState?.shooting || carryState?.seated || carryState?.dunking || carryState?.hanging || pd.stunTimer > 0) {
        pd.punchQueued = false;
        pd.punchActive = false;
        pd.punchPhase = 'none';
        return;
    }

    // Start a new punch on queue
    if (pd.punchQueued && !pd.punchActive) {
        pd.punchQueued = false;
        pd.punchActive = true;
        pd.punchPhase = 'extend';
        pd.punchElapsed = 0;
        pd._punchHitLanded = false; // reset hit flag for new punch

        // Determine which hand punches
        if (carryState?.dribbling) {
            // Punch with the hand that ISN'T dribbling
            const dribbleHand = pd._dribbleHand || 'right';
            pd.punchHand = dribbleHand === 'right' ? 'left' : 'right';
        } else if (carryState?.holding && !carryState?.dribbling) {
            // Both hands hold ball at chest — left jab
            pd.punchHand = 'left';
        } else {
            // No ball — alternate hands
            pd.punchHand = pd.punchNextHand;
            pd.punchNextHand = pd.punchNextHand === 'left' ? 'right' : 'left';
        }
    } else {
        pd.punchQueued = false;
    }

    // Advance punch phases
    if (pd.punchActive) {
        pd.punchElapsed += delta;

        if (pd.punchPhase === 'extend' && pd.punchElapsed >= PUNCH_EXTEND_TIME) {
            pd.punchPhase = 'hold';
            pd.punchElapsed = 0;
        } else if (pd.punchPhase === 'hold' && pd.punchElapsed >= PUNCH_HOLD_TIME) {
            pd.punchPhase = 'retract';
            pd.punchElapsed = 0;
        } else if (pd.punchPhase === 'retract' && pd.punchElapsed >= PUNCH_RETRACT_TIME) {
            pd.punchActive = false;
            pd.punchPhase = 'none';
            pd.punchElapsed = 0;
        }
    }
}

// Returns 0→1 punch blend: 0 = rest pose, 1 = full punch extension
function getPunchBlend(pd) {
    if (!pd.punchActive) return 0;
    if (pd.punchPhase === 'extend') {
        // Fast ease-out for snappy jab
        const t = Math.min(pd.punchElapsed / PUNCH_EXTEND_TIME, 1);
        return t * (2 - t); // ease-out quad
    }
    if (pd.punchPhase === 'hold') return 1;
    if (pd.punchPhase === 'retract') {
        const t = Math.min(pd.punchElapsed / PUNCH_RETRACT_TIME, 1);
        return 1 - t * t; // ease-in quad (smooth pullback)
    }
    return 0;
}

// ─── Limb animation ─────────────────────────────────────────
function animateLimbs(pd, isMoving, delta, carryState = null) {
    const j = pd.joints;
    const t = pd.walkCycle;

    // Pre-compute common lerp factors (avoids repeated Math.exp calls)
    const lerp8  = 1 - Math.exp(-8 * delta);
    const lerp9  = 1 - Math.exp(-9 * delta);
    const lerp10 = 1 - Math.exp(-10 * delta);
    const lerp12 = 1 - Math.exp(-12 * delta);
    const lerp14 = 1 - Math.exp(-14 * delta);
    const lerp16 = 1 - Math.exp(-16 * delta);
    const lerp18 = 1 - Math.exp(-18 * delta);
    const lerp6  = 1 - Math.exp(-6 * delta);

    const moveBlendTarget = isMoving && pd.isGrounded ? 1 : 0;
    const moveBlendLerp = moveBlendTarget > pd.moveBlend
        ? (1 - Math.exp(-MOVE_BLEND_IN_SPEED * delta))
        : (1 - Math.exp(-MOVE_BLEND_OUT_SPEED * delta));
    pd.moveBlend += (moveBlendTarget - pd.moveBlend) * moveBlendLerp;

    const seated = !!carryState?.seated;
    if (seated) {
        const settled = !!carryState?.seatSettled;
        const seatLerp = lerp14;
        // Negative hip = thighs swing forward; positive knee = shins bend down
        const hipTarget = settled ? -1.40 : -1.15;
        const kneeTarget = settled ? 1.45 : 1.20;

        j.leftHip.rotation.x += (hipTarget - j.leftHip.rotation.x) * seatLerp;
        j.rightHip.rotation.x += (hipTarget - j.rightHip.rotation.x) * seatLerp;
        j.leftKnee.rotation.x += (kneeTarget - j.leftKnee.rotation.x) * seatLerp;
        j.rightKnee.rotation.x += (kneeTarget - j.rightKnee.rotation.x) * seatLerp;

        // Arms resting on thighs — slight forward lean, hands on knees
        j.leftShoulder.rotation.x += (-0.50 - j.leftShoulder.rotation.x) * seatLerp;
        j.rightShoulder.rotation.x += (-0.50 - j.rightShoulder.rotation.x) * seatLerp;
        j.leftElbow.rotation.x += (-0.75 - j.leftElbow.rotation.x) * seatLerp;
        j.rightElbow.rotation.x += (-0.75 - j.rightElbow.rotation.x) * seatLerp;
        j.leftShoulder.rotation.z += (-0.12 - j.leftShoulder.rotation.z) * seatLerp;
        j.rightShoulder.rotation.z += (0.12 - j.rightShoulder.rotation.z) * seatLerp;
        j.leftShoulder.rotation.y += (0.05 - j.leftShoulder.rotation.y) * seatLerp;
        j.rightShoulder.rotation.y += (-0.05 - j.rightShoulder.rotation.y) * seatLerp;
        return;
    }

    const dunking = !!carryState?.dunking;
    const hanging = !!carryState?.hanging;
    if (dunking || hanging) {
        const dunkLerp = lerp14;
        if (hanging) {
            j.leftShoulder.rotation.x += (-3.05 - j.leftShoulder.rotation.x) * dunkLerp;
            j.rightShoulder.rotation.x += (-3.05 - j.rightShoulder.rotation.x) * dunkLerp;
            j.leftElbow.rotation.x += (-0.04 - j.leftElbow.rotation.x) * dunkLerp;
            j.rightElbow.rotation.x += (-0.04 - j.rightElbow.rotation.x) * dunkLerp;
            j.leftHip.rotation.x += (0.25 - j.leftHip.rotation.x) * dunkLerp;
            j.rightHip.rotation.x += (0.25 - j.rightHip.rotation.x) * dunkLerp;
            j.leftKnee.rotation.x += (0.68 - j.leftKnee.rotation.x) * dunkLerp;
            j.rightKnee.rotation.x += (0.68 - j.rightKnee.rotation.x) * dunkLerp;
        } else {
            j.leftShoulder.rotation.x += (-2.85 - j.leftShoulder.rotation.x) * dunkLerp;
            j.rightShoulder.rotation.x += (-2.85 - j.rightShoulder.rotation.x) * dunkLerp;
            j.leftElbow.rotation.x += (-0.18 - j.leftElbow.rotation.x) * dunkLerp;
            j.rightElbow.rotation.x += (-0.18 - j.rightElbow.rotation.x) * dunkLerp;
            j.leftHip.rotation.x += (0.18 - j.leftHip.rotation.x) * dunkLerp;
            j.rightHip.rotation.x += (0.18 - j.rightHip.rotation.x) * dunkLerp;
            j.leftKnee.rotation.x += (0.5 - j.leftKnee.rotation.x) * dunkLerp;
            j.rightKnee.rotation.x += (0.5 - j.rightKnee.rotation.x) * dunkLerp;
        }

        j.leftShoulder.rotation.z += (-0.08 - j.leftShoulder.rotation.z) * dunkLerp;
        j.rightShoulder.rotation.z += (0.08 - j.rightShoulder.rotation.z) * dunkLerp;
        j.leftShoulder.rotation.y += (0.02 - j.leftShoulder.rotation.y) * dunkLerp;
        j.rightShoulder.rotation.y += (-0.02 - j.rightShoulder.rotation.y) * dunkLerp;
        return;
    }

    const poseLerp = lerp16;
    const carryingBall = !!carryState?.holding;

    if (carryingBall) {
        const armLerp = lerp18;
        const shooting = !!carryState?.shooting;
        const dribbling = !shooting && (carryState?.dribbling ?? (isMoving && pd.isGrounded));
        const dribblePhase = carryState.dribblePhase || t;

        if (shooting) {
            // ── Shooting stance ───────────────────────────
            // Legs slightly bent, stable base
            const shotLerp = lerp12;
            const kneeBend = 0.22;
            j.leftHip.rotation.x += (0.08 - j.leftHip.rotation.x) * shotLerp;
            j.rightHip.rotation.x += (0.08 - j.rightHip.rotation.x) * shotLerp;
            j.leftKnee.rotation.x += (kneeBend - j.leftKnee.rotation.x) * shotLerp;
            j.rightKnee.rotation.x += (kneeBend - j.rightKnee.rotation.x) * shotLerp;

            // Ball above head — both arms extended upward
            // Shoulders rotate backward (negative X = arms go up/behind)
            // Guide hand (left) slightly lower, shooting hand (right) higher
            const rightShoulderX = -2.6;   // arm extended up overhead
            const leftShoulderX = -2.4;    // guide hand slightly below
            const rightElbowX = -0.35;     // slight elbow bend for control
            const leftElbowX = -0.55;      // guide hand more relaxed

            j.rightShoulder.rotation.x += (rightShoulderX - j.rightShoulder.rotation.x) * shotLerp;
            j.leftShoulder.rotation.x += (leftShoulderX - j.leftShoulder.rotation.x) * shotLerp;
            j.rightElbow.rotation.x += (rightElbowX - j.rightElbow.rotation.x) * shotLerp;
            j.leftElbow.rotation.x += (leftElbowX - j.leftElbow.rotation.x) * shotLerp;

            // Arms close to body, not spread wide
            j.leftShoulder.rotation.z += (-0.18 - j.leftShoulder.rotation.z) * shotLerp;
            j.rightShoulder.rotation.z += (0.12 - j.rightShoulder.rotation.z) * shotLerp;
            j.leftShoulder.rotation.y += (0.06 - j.leftShoulder.rotation.y) * shotLerp;
            j.rightShoulder.rotation.y += (-0.06 - j.rightShoulder.rotation.y) * shotLerp;
            return;
        }

        if (dribbling) {
            // Keep lower body walk cycle while upper body enters dribble pose.
            const leftHipTarget = Math.sin(t) * LEG_SWING * pd.moveBlend;
            const rightHipTarget = Math.sin(t + Math.PI) * LEG_SWING * pd.moveBlend;
            j.leftHip.rotation.x += (leftHipTarget - j.leftHip.rotation.x) * poseLerp;
            j.rightHip.rotation.x += (rightHipTarget - j.rightHip.rotation.x) * poseLerp;

            const leftKneeTarget = Math.max(0, -Math.sin(t) * KNEE_BEND_MAX + 0.15) * pd.moveBlend;
            const rightKneeTarget = Math.max(0, -Math.sin(t + Math.PI) * KNEE_BEND_MAX + 0.15) * pd.moveBlend;
            j.leftKnee.rotation.x += (leftKneeTarget - j.leftKnee.rotation.x) * poseLerp;
            j.rightKnee.rotation.x += (rightKneeTarget - j.rightKnee.rotation.x) * poseLerp;

            // ── Dribble arm animation synced to ball.js phases ──
            // Ball phase (0→1): 0→0.08 top dwell, 0.08→0.50 push down,
            //   0.50→0.56 floor bounce, 0.56→1.0 ball rises back up.
            // Arm must match: hand pushes ball down, then rises to meet it.
            const phase01 = (dribblePhase / (Math.PI * 2)) % 1;
            const TOP_DWELL = 0.08;
            const DOWN_END = 0.50;
            const BOUNCE_END = DOWN_END + 0.06;

            let armPush; // 0 = hand at top (waiting for ball), 1 = hand at bottom (fully extended down)
            const HAND_UP_END = 0.76; // hand finishes rising here — well before ball arrives at 1.0
            if (phase01 < TOP_DWELL) {
                // Top dwell — hand waiting at peak, ball arriving into palm
                armPush = 0;
            } else if (phase01 < DOWN_END) {
                // Pushing ball down — smoothstep ease-in-out
                const t = (phase01 - TOP_DWELL) / (DOWN_END - TOP_DWELL);
                armPush = t * t * (3 - 2 * t);
            } else if (phase01 < BOUNCE_END) {
                // Floor contact — hand stays low briefly
                armPush = 1;
            } else if (phase01 < HAND_UP_END) {
                // Hand snaps back up FAST — reaches top well before ball does
                const t = (phase01 - BOUNCE_END) / (HAND_UP_END - BOUNCE_END);
                const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out cubic (fast middle)
                armPush = 1 - eased;
            } else {
                // Hand already at top, waiting for ball to bounce up into it
                armPush = 0;
            }

            // Shoulder: -0.40 at top (arm forward, hand at waist) → 0.20 at bottom (reaching down)
            const dribbleShoulderX = THREE.MathUtils.lerp(-0.40, 0.20, armPush);
            // Elbow: -1.05 at top (bent, cupping ball) → -0.25 at bottom (extended, pushing through)
            const dribbleElbowX = THREE.MathUtils.lerp(-1.05, -0.25, armPush);
            // Off-hand: relaxed jog position with subtle sway
            const offShoulderX = -0.62 + Math.sin(dribblePhase * 0.45) * 0.04;
            const offElbowX = -0.95;

            const dribbleIsRight = (pd._dribbleHand || 'right') === 'right';
            const dribbleShoulder = dribbleIsRight ? j.rightShoulder : j.leftShoulder;
            const dribbleElbow = dribbleIsRight ? j.rightElbow : j.leftElbow;
            const offShoulder = dribbleIsRight ? j.leftShoulder : j.rightShoulder;
            const offElbow = dribbleIsRight ? j.leftElbow : j.rightElbow;

            dribbleShoulder.rotation.x += (dribbleShoulderX - dribbleShoulder.rotation.x) * armLerp;
            dribbleElbow.rotation.x += (dribbleElbowX - dribbleElbow.rotation.x) * armLerp;
            offShoulder.rotation.x += (offShoulderX - offShoulder.rotation.x) * armLerp;
            offElbow.rotation.x += (offElbowX - offElbow.rotation.x) * armLerp;

            // Dribble arm angled slightly outward, off arm tucked
            const dribbleZ = dribbleIsRight ? 0.25 : -0.25;
            const offZ = dribbleIsRight ? -0.30 : 0.30;
            const dribbleY = dribbleIsRight ? -0.10 : 0.10;
            const offY = dribbleIsRight ? 0.18 : -0.18;
            dribbleShoulder.rotation.z += (dribbleZ - dribbleShoulder.rotation.z) * armLerp;
            offShoulder.rotation.z += (offZ - offShoulder.rotation.z) * armLerp;
            dribbleShoulder.rotation.y += (dribbleY - dribbleShoulder.rotation.y) * armLerp;
            offShoulder.rotation.y += (offY - offShoulder.rotation.y) * armLerp;
        } else {
            if (pd.isJumping) {
                const lerp = lerp10;
                const goingUp = pd.velocityY > 0;
                const hipTarget = goingUp ? 0.3 : 0.05;
                const kneeTarget = goingUp ? 0.5 : 0.1;
                j.leftHip.rotation.x += (hipTarget - j.leftHip.rotation.x) * lerp;
                j.rightHip.rotation.x += (hipTarget - j.rightHip.rotation.x) * lerp;
                j.leftKnee.rotation.x += (kneeTarget - j.leftKnee.rotation.x) * lerp;
                j.rightKnee.rotation.x += (kneeTarget - j.rightKnee.rotation.x) * lerp;
            } else {
                const legLerp = lerp8;
                j.leftHip.rotation.x += (0 - j.leftHip.rotation.x) * legLerp;
                j.rightHip.rotation.x += (0 - j.rightHip.rotation.x) * legLerp;
                j.leftKnee.rotation.x += (0 - j.leftKnee.rotation.x) * legLerp;
                j.rightKnee.rotation.x += (0 - j.rightKnee.rotation.x) * legLerp;
            }

            // Two-hand chest hold.
            pd.idleClock += delta;
            const holdBreathe = Math.sin(pd.idleClock * 2.1) * 0.02;
            const holdLerp = lerp9;

            const leftShoulderX = -0.66 + holdBreathe;
            const rightShoulderX = -0.66 - holdBreathe;
            const leftElbowX = -1.12;
            const rightElbowX = -1.12;

            j.leftShoulder.rotation.x += (leftShoulderX - j.leftShoulder.rotation.x) * holdLerp;
            j.rightShoulder.rotation.x += (rightShoulderX - j.rightShoulder.rotation.x) * holdLerp;
            j.leftElbow.rotation.x += (leftElbowX - j.leftElbow.rotation.x) * holdLerp;
            j.rightElbow.rotation.x += (rightElbowX - j.rightElbow.rotation.x) * holdLerp;

            j.leftShoulder.rotation.z += (-0.35 - j.leftShoulder.rotation.z) * holdLerp;
            j.rightShoulder.rotation.z += (0.35 - j.rightShoulder.rotation.z) * holdLerp;
            j.leftShoulder.rotation.y += (0.14 - j.leftShoulder.rotation.y) * holdLerp;
            j.rightShoulder.rotation.y += (-0.14 - j.rightShoulder.rotation.y) * holdLerp;
        }
    } else if (isMoving && pd.isGrounded) {
        // ── Walk cycle ──────────────────────────────────
        // Legs
        const leftHipTarget = Math.sin(t) * LEG_SWING * pd.moveBlend;
        const rightHipTarget = Math.sin(t + Math.PI) * LEG_SWING * pd.moveBlend;
        j.leftHip.rotation.x += (leftHipTarget - j.leftHip.rotation.x) * poseLerp;
        j.rightHip.rotation.x += (rightHipTarget - j.rightHip.rotation.x) * poseLerp;

        // Knees — bend more when leg swings backward
        const leftKneeTarget = Math.max(0, -Math.sin(t) * KNEE_BEND_MAX + 0.15) * pd.moveBlend;
        const rightKneeTarget = Math.max(0, -Math.sin(t + Math.PI) * KNEE_BEND_MAX + 0.15) * pd.moveBlend;
        j.leftKnee.rotation.x += (leftKneeTarget - j.leftKnee.rotation.x) * poseLerp;
        j.rightKnee.rotation.x += (rightKneeTarget - j.rightKnee.rotation.x) * poseLerp;

        // Arms — opposite to legs
        const leftShoulderTarget = Math.sin(t + Math.PI) * ARM_SWING * pd.moveBlend;
        const rightShoulderTarget = Math.sin(t) * ARM_SWING * pd.moveBlend;
        j.leftShoulder.rotation.x += (leftShoulderTarget - j.leftShoulder.rotation.x) * poseLerp;
        j.rightShoulder.rotation.x += (rightShoulderTarget - j.rightShoulder.rotation.x) * poseLerp;

        // Elbows — bend during back-swing
        const leftElbowTarget = (-Math.abs(Math.sin(t + Math.PI)) * ELBOW_BEND - 0.08) * pd.moveBlend - 0.06 * (1 - pd.moveBlend);
        const rightElbowTarget = (-Math.abs(Math.sin(t)) * ELBOW_BEND - 0.08) * pd.moveBlend - 0.06 * (1 - pd.moveBlend);
        j.leftElbow.rotation.x += (leftElbowTarget - j.leftElbow.rotation.x) * poseLerp;
        j.rightElbow.rotation.x += (rightElbowTarget - j.rightElbow.rotation.x) * poseLerp;

        j.leftShoulder.rotation.y += (0 - j.leftShoulder.rotation.y) * poseLerp;
        j.rightShoulder.rotation.y += (0 - j.rightShoulder.rotation.y) * poseLerp;
        j.leftShoulder.rotation.z += (0 - j.leftShoulder.rotation.z) * poseLerp;
        j.rightShoulder.rotation.z += (0 - j.rightShoulder.rotation.z) * poseLerp;
    } else if (pd.isJumping) {
        // ── Jump pose ───────────────────────────────────
        const lerp = lerp10;
        const goingUp = pd.velocityY > 0;

        // Arms reach upward when rising, down when falling
        const armTarget = goingUp ? -1.2 : -0.3;
        j.leftShoulder.rotation.x += (armTarget - j.leftShoulder.rotation.x) * lerp;
        j.rightShoulder.rotation.x += (armTarget - j.rightShoulder.rotation.x) * lerp;
        j.leftElbow.rotation.x += (-0.2 - j.leftElbow.rotation.x) * lerp;
        j.rightElbow.rotation.x += (-0.2 - j.rightElbow.rotation.x) * lerp;

        // Legs tuck on the way up
        const hipTarget = goingUp ? 0.3 : 0.05;
        const kneeTarget = goingUp ? 0.5 : 0.1;
        j.leftHip.rotation.x += (hipTarget - j.leftHip.rotation.x) * lerp;
        j.rightHip.rotation.x += (hipTarget - j.rightHip.rotation.x) * lerp;
        j.leftKnee.rotation.x += (kneeTarget - j.leftKnee.rotation.x) * lerp;
        j.rightKnee.rotation.x += (kneeTarget - j.rightKnee.rotation.x) * lerp;

        j.leftShoulder.rotation.y += (0 - j.leftShoulder.rotation.y) * lerp;
        j.rightShoulder.rotation.y += (0 - j.rightShoulder.rotation.y) * lerp;
        j.leftShoulder.rotation.z += (0 - j.leftShoulder.rotation.z) * lerp;
        j.rightShoulder.rotation.z += (0 - j.rightShoulder.rotation.z) * lerp;
    } else {
        // ── Idle — subtle breathing ─────────────────────
        pd.idleClock += delta;
        const breathe = Math.sin(pd.idleClock * 2.4) * 0.015;
        const lerp = lerp6;

        j.leftShoulder.rotation.x += (breathe - j.leftShoulder.rotation.x) * lerp;
        j.rightShoulder.rotation.x += (-breathe - j.rightShoulder.rotation.x) * lerp;
        j.leftElbow.rotation.x += (-0.06 - j.leftElbow.rotation.x) * lerp;
        j.rightElbow.rotation.x += (-0.06 - j.rightElbow.rotation.x) * lerp;
        j.leftHip.rotation.x += (0 - j.leftHip.rotation.x) * lerp;
        j.rightHip.rotation.x += (0 - j.rightHip.rotation.x) * lerp;
        j.leftKnee.rotation.x += (0 - j.leftKnee.rotation.x) * lerp;
        j.rightKnee.rotation.x += (0 - j.rightKnee.rotation.x) * lerp;
        j.leftShoulder.rotation.y += (0 - j.leftShoulder.rotation.y) * lerp;
        j.rightShoulder.rotation.y += (0 - j.rightShoulder.rotation.y) * lerp;
        j.leftShoulder.rotation.z += (0 - j.leftShoulder.rotation.z) * lerp;
        j.rightShoulder.rotation.z += (0 - j.rightShoulder.rotation.z) * lerp;
    }

    // ── Punch overlay — blends on top of whatever arm pose is active ──
    const punchBlend = getPunchBlend(pd);
    if (punchBlend > 0.001) {
        const hand = pd.punchHand;
        const shoulder = hand === 'left' ? j.leftShoulder : j.rightShoulder;
        const elbow = hand === 'left' ? j.leftElbow : j.rightElbow;
        const yTarget = hand === 'left' ? PUNCH_SHOULDER_Y_L : PUNCH_SHOULDER_Y_R;
        const zTarget = hand === 'left' ? PUNCH_SHOULDER_Z_L : PUNCH_SHOULDER_Z_R;

        // Blend from current pose toward punch pose
        shoulder.rotation.x += (PUNCH_SHOULDER_X - shoulder.rotation.x) * punchBlend;
        elbow.rotation.x += (PUNCH_ELBOW_X - elbow.rotation.x) * punchBlend;
        shoulder.rotation.y += (yTarget - shoulder.rotation.y) * punchBlend;
        shoulder.rotation.z += (zTarget - shoulder.rotation.z) * punchBlend;
    }

    // ── Flinch overlay — when stunned, body recoils and arms go limp ──
    const fb = pd.stunIntensity;
    if (fb > 0.001) {
        // Torso leans back (head tilts via root rotation would need torso joint;
        // instead we use arm + leg poses to sell the flinch)
        // Arms drop and flail outward
        j.leftShoulder.rotation.x += (0.3 - j.leftShoulder.rotation.x) * fb;
        j.rightShoulder.rotation.x += (0.3 - j.rightShoulder.rotation.x) * fb;
        j.leftShoulder.rotation.z += (-0.5 - j.leftShoulder.rotation.z) * fb;
        j.rightShoulder.rotation.z += (0.5 - j.rightShoulder.rotation.z) * fb;
        j.leftElbow.rotation.x += (-0.3 - j.leftElbow.rotation.x) * fb;
        j.rightElbow.rotation.x += (-0.3 - j.rightElbow.rotation.x) * fb;
        // Knees buckle slightly
        j.leftKnee.rotation.x += (0.35 - j.leftKnee.rotation.x) * fb;
        j.rightKnee.rotation.x += (0.35 - j.rightKnee.rotation.x) * fb;
        j.leftHip.rotation.x += (-0.15 - j.leftHip.rotation.x) * fb;
        j.rightHip.rotation.x += (-0.15 - j.rightHip.rotation.x) * fb;
    }
}

// ─── Punch hit detection helpers (exported for main.js) ─────

const _tmpFistPos = new THREE.Vector3();

/**
 * Returns the world position of the punching fist during the active punch.
 * Returns null if no punch is active or not in the hit-registering phase.
 */
export function getPunchFistPosition(pd) {
    if (!pd.punchActive) return null;
    if (pd._punchHitLanded) return null; // already landed this punch
    // Only register hits during strong extension (blend > 0.5) and hold
    const blend = getPunchBlend(pd);
    if (blend < 0.5) return null;

    const hand = pd.punchHand;
    const elbow = hand === 'right' ? pd.joints?.rightElbow : pd.joints?.leftElbow;
    if (elbow) {
        pd.group.updateMatrixWorld();
        _tmpFistPos.set(0, -0.29, 0.01);
        elbow.localToWorld(_tmpFistPos);
        return _tmpFistPos;
    }

    // Fallback: estimate fist position from facing angle
    const facing = pd.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const pos = pd.group.position;
    const groundY = pos.y + (pd.visualGroundOffsetY || 0);
    _tmpFistPos.set(
        pos.x + fwdX * 0.45,
        groundY + 1.3,
        pos.z + fwdZ * 0.45
    );
    return _tmpFistPos;
}

/**
 * Apply stun to a player — called when they get punched.
 * dirX, dirZ = normalized direction FROM puncher TO target.
 */
export function applyStun(pd, dirX, dirZ) {
    if (pd.stunTimer > 0) return; // already stunned, don't stack
    pd.stunTimer = STUN_DURATION;
    pd.stunDirX = dirX;
    pd.stunDirZ = dirZ;
    pd.stunIntensity = 0; // will ramp up in updatePlayer
    // Cancel any active punch
    pd.punchActive = false;
    pd.punchPhase = 'none';
    pd.punchQueued = false;
}

/**
 * Update the under-foot stamina arc for a player.
 * Kept as updateStaminaBar() for call-site compatibility.
 */
export function updateStaminaBar(pd, _camera) {
    if (!pd._staminaArcGroup || !pd._staminaArcFill) return;
    const frac = Math.max(0, Math.min(1, pd.stamina / pd.maxStamina));
    const shouldShow = frac < 0.98;

    // Fade in/out
    const target = shouldShow ? 1 : 0;
    pd._staminaBarVisible += (target - pd._staminaBarVisible) * 0.12;
    if (pd._staminaBarGroup) pd._staminaBarGroup.visible = false; // hide legacy head bar
    if (pd._staminaBarVisible < 0.01) { pd._staminaArcGroup.visible = false; return; }
    pd._staminaArcGroup.visible = true;

    // Draw-range controls arc length (thin arc fill)
    const pointCount = pd._staminaArcPointCount || 2;
    const visiblePoints = Math.max(2, Math.floor((pointCount - 1) * frac) + 1);
    pd._staminaArcFill.geometry.setDrawRange(0, visiblePoints);

    // Eloquent stamina yellow
    const barOpacity = pd._staminaBarVisible;
    pd._staminaArcFillMat.color.setHex(0xf6d651);
    pd._staminaArcFillMat.opacity = 0.84 * barOpacity;
    pd._staminaArcTrackMat.opacity = 0.26 * barOpacity;
}

export { PUNCH_HIT_RADIUS };
