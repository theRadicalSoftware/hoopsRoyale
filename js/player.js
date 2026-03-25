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
const COLLISION_EPSILON = 1e-4;
const PLAYER_FOOT_OFFSET = 0.265; // local Y from root origin to sole bottom
const GROUNDED_Y = -PLAYER_FOOT_OFFSET;

const tmpInputDir = new THREE.Vector3();
const tmpTargetVel = new THREE.Vector3();
const WORLD_FORWARD = new THREE.Vector3(0, 0, -1);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);

// ─── Create Player ─────────────────────────────────────────
export function createPlayer(scene) {
    const root = new THREE.Group();
    root.name = 'player';

    // ── Materials ────────────────────────────────────────
    const skinMat = new THREE.MeshStandardMaterial({
        color: 0x8B6C42, roughness: 0.72, metalness: 0.02
    });
    const jerseyMat = new THREE.MeshStandardMaterial({
        color: 0xcc2222, roughness: 0.82, metalness: 0.0
    });
    const shortsMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e, roughness: 0.8, metalness: 0.0
    });
    const shoeMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee, roughness: 0.55, metalness: 0.08
    });
    const solesMat = new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.9, metalness: 0.0
    });
    const headbandMat = new THREE.MeshStandardMaterial({
        color: 0xcc2222, roughness: 0.7, metalness: 0.0
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

    // Jersey number (small "23" on back via a thin plane — optional detail)
    // Keep it simple for now

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

    // Start hidden — shown when player mode activated
    root.visible = false;
    root.position.set(0, GROUNDED_Y, 4);      // near center-court, slightly offset

    scene.add(root);

    return {
        group: root,
        joints,
        walkCycle: 0,
        moveBlend: 0,
        idleClock: 0,
        facingAngle: 0,
        velocity: new THREE.Vector3(),
        velocityY: 0,
        isJumping: false,
        isGrounded: true,
        jumpPressed: false,
        visualGroundOffsetY: PLAYER_FOOT_OFFSET
    };
}

// ─── Update Player (called every frame) ─────────────────────
export function updatePlayer(pd, delta, input, movementBasis = null, colliders = null, carryState = null) {
    const { group, joints } = pd;
    if (!group.visible) return;

    // ── Movement direction from arrow keys ───────────────
    const basisForward = movementBasis?.forward || WORLD_FORWARD;
    const basisRight = movementBasis?.right || WORLD_RIGHT;

    tmpInputDir.set(0, 0, 0);
    if (input.forward)  tmpInputDir.add(basisForward);
    if (input.backward) tmpInputDir.sub(basisForward);
    if (input.left)     tmpInputDir.sub(basisRight);
    if (input.right)    tmpInputDir.add(basisRight);
    tmpInputDir.y = 0;

    const hasMoveInput = tmpInputDir.lengthSq() > 0;

    if (hasMoveInput) {
        tmpInputDir.normalize();
    }

    // Velocity-based movement removes start/stop jitter and feels smoother.
    tmpTargetVel.copy(tmpInputDir).multiplyScalar(WALK_SPEED);
    const moveResponse = hasMoveInput ? ACCELERATION : DECELERATION;
    const velLerp = 1 - Math.exp(-moveResponse * delta);
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
    if (input.jump && !pd.jumpPressed && pd.isGrounded) {
        pd.velocityY = JUMP_FORCE;
        pd.isGrounded = false;
        pd.isJumping = true;
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

    // ── Animate limbs ────────────────────────────────────
    animateLimbs(pd, isMoving, delta, carryState);
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

// ─── Limb animation ─────────────────────────────────────────
function animateLimbs(pd, isMoving, delta, carryState = null) {
    const j = pd.joints;
    const t = pd.walkCycle;

    const moveBlendTarget = isMoving && pd.isGrounded ? 1 : 0;
    const moveBlendSpeed = moveBlendTarget > pd.moveBlend ? MOVE_BLEND_IN_SPEED : MOVE_BLEND_OUT_SPEED;
    const moveBlendLerp = 1 - Math.exp(-moveBlendSpeed * delta);
    pd.moveBlend += (moveBlendTarget - pd.moveBlend) * moveBlendLerp;

    const poseLerp = 1 - Math.exp(-16 * delta);
    const carryingBall = !!carryState?.holding;

    if (carryingBall) {
        const armLerp = 1 - Math.exp(-18 * delta);
        const dribbling = carryState?.dribbling ?? (isMoving && pd.isGrounded);
        const dribblePhase = carryState.dribblePhase || t;

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

            const handDown = Math.pow(Math.abs(Math.sin(dribblePhase)), 0.8);
            // Right hand drives dribble with forward angle and never fully straight.
            const rightShoulderX = THREE.MathUtils.lerp(-0.50, 0.06, handDown);
            const rightElbowX = THREE.MathUtils.lerp(-1.0, -0.58, handDown);
            const leftShoulderX = -0.68 + Math.sin(dribblePhase * 0.45) * 0.03;
            const leftElbowX = -1.02;

            j.rightShoulder.rotation.x += (rightShoulderX - j.rightShoulder.rotation.x) * armLerp;
            j.rightElbow.rotation.x += (rightElbowX - j.rightElbow.rotation.x) * armLerp;
            j.leftShoulder.rotation.x += (leftShoulderX - j.leftShoulder.rotation.x) * armLerp;
            j.leftElbow.rotation.x += (leftElbowX - j.leftElbow.rotation.x) * armLerp;

            j.leftShoulder.rotation.z += (-0.34 - j.leftShoulder.rotation.z) * armLerp;
            j.rightShoulder.rotation.z += (0.30 - j.rightShoulder.rotation.z) * armLerp;
            j.leftShoulder.rotation.y += (0.22 - j.leftShoulder.rotation.y) * armLerp;
            j.rightShoulder.rotation.y += (-0.14 - j.rightShoulder.rotation.y) * armLerp;
        } else {
            if (pd.isJumping) {
                const lerp = 1 - Math.exp(-10 * delta);
                const goingUp = pd.velocityY > 0;
                const hipTarget = goingUp ? 0.3 : 0.05;
                const kneeTarget = goingUp ? 0.5 : 0.1;
                j.leftHip.rotation.x += (hipTarget - j.leftHip.rotation.x) * lerp;
                j.rightHip.rotation.x += (hipTarget - j.rightHip.rotation.x) * lerp;
                j.leftKnee.rotation.x += (kneeTarget - j.leftKnee.rotation.x) * lerp;
                j.rightKnee.rotation.x += (kneeTarget - j.rightKnee.rotation.x) * lerp;
            } else {
                const legLerp = 1 - Math.exp(-8 * delta);
                j.leftHip.rotation.x += (0 - j.leftHip.rotation.x) * legLerp;
                j.rightHip.rotation.x += (0 - j.rightHip.rotation.x) * legLerp;
                j.leftKnee.rotation.x += (0 - j.leftKnee.rotation.x) * legLerp;
                j.rightKnee.rotation.x += (0 - j.rightKnee.rotation.x) * legLerp;
            }

            // Two-hand chest hold.
            pd.idleClock += delta;
            const holdBreathe = Math.sin(pd.idleClock * 2.1) * 0.02;
            const holdLerp = 1 - Math.exp(-9 * delta);

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
        return;
    }

    if (isMoving && pd.isGrounded) {
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
        const lerp = 1 - Math.exp(-10 * delta);
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
        const lerp = 1 - Math.exp(-6 * delta);

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
}
