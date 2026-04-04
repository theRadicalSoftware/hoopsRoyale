import * as THREE from 'three';

const BALL_RADIUS = 0.1193; // official size 7 radius (~9.39 in diameter)
const COURT_WIDTH = 15.24;
const COURT_LENGTH = 28.65;
const ASPHALT_PAD_X = 3.0;
const ASPHALT_PAD_Z = 4.0;

const GRAVITY = -11.5;
const AIR_DRAG = 0.12;
const FLOOR_BOUNCE = 0.74;
const WALL_BOUNCE = 0.58;
const GROUND_FRICTION = 6.0;
const ROLL_DAMP = 2.4;
const COLLIDER_BROADPHASE_PAD = 0.35;
const RIM_COLLISION_TUBE = 0.03;   // effective rim tube for collision (forgiving but realistic)
const RIM_BOUNCE = 0.55;          // restitution for rim hits
const PICKUP_RADIUS = 0.72;
const PICKUP_RADIUS_ASSIST = 1.02;
const PICKUP_VERTICAL_ASSIST = 1.55;
const HOLD_CHEST_HEIGHT = 1.18;
const HOLD_HAND_INSET = 0.018;
const DRIBBLE_HAND_SIDE = 0.018;
const DRIBBLE_HAND_FORWARD = 0.055;
const DRIBBLE_TOP_DWELL = 0.08;
const DRIBBLE_BOTTOM_DWELL = 0.06;
const DRIBBLE_MIN_CLEARANCE = 0.025;
const DRIBBLE_SPEED_MIN = 1.45;
const DRIBBLE_SPEED_MAX = 2.35;
const DRIBBLE_TRIGGER_SPEED = 0.45;
const DRIBBLE_CONTACT_GAP = 0.006;
const DRIBBLE_MIN_STROKE = 0.29;
const HOLD_SMOOTH_IDLE = 30.0;
const HOLD_SMOOTH_DRIBBLE = 30.0;

// ─── Shooting constants ────────────────────────────────────
const RIM_HEIGHT = 3.048;
const HALF_COURT_LENGTH = 14.325;
const BACKBOARD_FROM_BASELINE = 1.22;
const RIM_FROM_BACKBOARD = 0.15;
const RIM_RADIUS_HOOP = 0.2286;
const SHOT_RELEASE_HEIGHT = 2.15;       // above ground, overhead release point
const SHOT_MIN_ANGLE = 38;              // degrees — flattest allowed shot
const SHOT_MAX_ANGLE = 70;              // degrees — highest arc
const SHOT_DEFAULT_ANGLE = 52;          // degrees — comfortable mid-range arc
const SHOT_ANGLE_SPEED = 28;            // degrees per second when adjusting
const SHOT_BACKSPIN = 8.0;              // radians per second of visual backspin
const SHOT_POWER_MIN = 0.55;
const SHOT_POWER_MAX = 1.15;

const tmpNormal = new THREE.Vector3();
const tmpTangent = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpHoldTarget = new THREE.Vector3();
const tmpLeftHand = new THREE.Vector3();
const tmpRightHand = new THREE.Vector3();
const tmpChosenDribbleHand = new THREE.Vector3();
const tmpBallFromLeft = new THREE.Vector3();
const tmpBallFromRight = new THREE.Vector3();
const tmpHandSide = new THREE.Vector3();
const tmpPrevBallPos = new THREE.Vector3();
const heldCollisionHit = { hit: false, nx: 0, nz: 0 };

export function createBasketball(scene) {
    const texture = createBallTexture();
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 36, 28);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        roughness: 0.82,
        metalness: 0.02
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    scene.add(mesh);

    return {
        mesh,
        radius: BALL_RADIUS,
        active: false,
        heldByPlayer: false,
        dribblingByPlayer: false,
        dribblePhase: 0,
        sleeping: false,
        grounded: false,
        velocity: new THREE.Vector3(),
        prevPosition: new THREE.Vector3(),
        idleFrames: 0,
        _dunkControl: false,
        _ignoreRimTimer: 0,
        _ignorePlayerTimer: 0,
        _ignorePlayerRef: null,
        heldByPlayerData: null,
        _lastTouchRef: null
    };
}

export function dropBasketballAtCenter(ball) {
    if (!ball) return;

    ball.mesh.visible = true;
    ball.active = true;
    ball.heldByPlayer = false;
    ball.heldByPlayerData = null;
    ball.dribblingByPlayer = false;
    ball._shootingStance = false;
    ball._passingStance = false;
    ball._dunkControl = false;
    ball._ignoreRimTimer = 0;
    ball._ignorePlayerTimer = 0;
    ball._ignorePlayerRef = null;
    ball._lastTouchRef = null;
    ball.dribblePhase = 0;
    ball.sleeping = false;
    ball.grounded = false;
    ball.idleFrames = 0;
    ball.mesh.position.set(0, 2.25, 0);
    ball.prevPosition.copy(ball.mesh.position);

    // Tiny random drift so each drop feels natural.
    ball.velocity.set(
        (Math.random() - 0.5) * 0.45,
        -0.2,
        (Math.random() - 0.5) * 0.45
    );
}

export function tryPickUpBasketball(ball, playerData) {
    if (!ball || !playerData?.group?.visible) return false;
    if (!ball.active || !ball.mesh.visible || ball.heldByPlayer) return false;

    const playerPos = playerData.group.position;
    const assistActive = !!playerData._pickupAssistActive;
    const pickupRadius = assistActive ? PICKUP_RADIUS_ASSIST : PICKUP_RADIUS;
    const dx = ball.mesh.position.x - playerPos.x;
    const dz = ball.mesh.position.z - playerPos.z;
    if (dx * dx + dz * dz > pickupRadius * pickupRadius) return false;

    const groundY = getPlayerGroundY(playerData);
    const verticalGap = Math.abs(ball.mesh.position.y - (groundY + 0.95));
    if (verticalGap > (assistActive ? PICKUP_VERTICAL_ASSIST : 1.35)) return false;

    ball.heldByPlayer = true;
    ball.heldByPlayerData = playerData;
    ball._lastTouchRef = playerData;
    ball.dribblingByPlayer = false;
    ball.dribblePhase = 0;
    ball._dunkControl = false;
    ball._ignoreRimTimer = 0;
    ball._ignorePlayerTimer = 0;
    ball.sleeping = false;
    ball.grounded = false;
    ball.idleFrames = 0;
    ball.velocity.set(0, 0, 0);

    updateHeldByPlayer(ball, playerData, 1 / 60, null, true);
    ball.prevPosition.copy(ball.mesh.position);
    return true;
}

export function updateBasketball(ball, delta, environmentColliders, playerData = null, allPlayers = null) {
    if (!ball || !ball.active || !ball.mesh.visible) return;

    if (ball.heldByPlayer) {
        if (ball._dunkControl) {
            ball.velocity.set(0, 0, 0);
            ball.sleeping = false;
            ball.grounded = false;
            ball.idleFrames = 0;
            ball.prevPosition.copy(ball.mesh.position);
            return;
        }
        // Use the actual holder for held-ball updates
        const holder = ball.heldByPlayerData || playerData;
        if (!holder?.group?.visible) {
            releaseHeldBall(ball, holder);
        } else {
            const releasedFromCollision = updateHeldByPlayer(ball, holder, delta, environmentColliders);
            if (!releasedFromCollision) return;
        }
    }

    if (ball._ignoreRimTimer > 0) ball._ignoreRimTimer = Math.max(0, ball._ignoreRimTimer - delta);
    if (ball._ignorePlayerTimer > 0) ball._ignorePlayerTimer = Math.max(0, ball._ignorePlayerTimer - delta);

    if (ball.sleeping) {
        // Wake if ANY player is nearby
        const players = allPlayers || (playerData ? [playerData] : []);
        let shouldWake = false;
        for (const pd of players) {
            if (!pd?.group?.visible) continue;
            const dx = pd.group.position.x - ball.mesh.position.x;
            const dz = pd.group.position.z - ball.mesh.position.z;
            if (dx * dx + dz * dz <= 1.44) { shouldWake = true; break; }
        }
        if (!shouldWake) return;
        ball.sleeping = false;
    }

    const dt = Math.min(delta, 0.033);
    const speed = ball.velocity.length();
    let substeps = 1;
    if (speed > 14) substeps = 5;
    else if (speed > 9) substeps = 4;
    else if (speed > 6) substeps = 3;
    else if (speed > 4.5) substeps = 2;
    const step = dt / substeps;

    for (let i = 0; i < substeps; i++) {
        if (!ball.sleeping) {
            ball.velocity.y += GRAVITY * step;
            const drag = Math.max(0, 1 - AIR_DRAG * step);
            ball.velocity.multiplyScalar(drag);
        }

        ball.mesh.position.addScaledVector(ball.velocity, step);
        resolveFloor(ball, step);
        resolveEnvironmentCollisions(ball, environmentColliders);
        // Resolve collision against all players
        const players = allPlayers || (playerData ? [playerData] : []);
        for (const pd of players) {
            resolvePlayerCollision(ball, pd);
        }
    }

    applyRollingRotation(ball);
    applySleep(ball);
}

function resolveFloor(ball, step) {
    const p = ball.mesh.position;
    const floorY = sampleFloorY(p.x, p.z);

    if (p.y - ball.radius > floorY) {
        ball.grounded = false;
        return;
    }

    p.y = floorY + ball.radius;
    ball.grounded = true;
    ball._backspin = null;

    if (Math.abs(ball.velocity.y) > 0.35) {
        ball.velocity.y = -ball.velocity.y * FLOOR_BOUNCE;
    } else {
        ball.velocity.y = 0;
    }

    const friction = Math.max(0, 1 - GROUND_FRICTION * step);
    ball.velocity.x *= friction;
    ball.velocity.z *= friction;
}

function resolveEnvironmentCollisions(ball, colliders, hitInfo = null) {
    if (!colliders || colliders.length === 0) return false;

    const p = ball.mesh.position;
    const r = ball.radius;
    const top = p.y + r;
    const bottom = p.y - r;
    let hadCollision = false;

    for (const collider of colliders) {
        // Ball passes through the net — it's visual only for the ball
        if (collider.isNetVolume) continue;

        if (top <= collider.yMin || bottom >= collider.yMax) continue;

        ensureBallBroadphase(collider);
        const bdx = p.x - collider._ballCx;
        const bdz = p.z - collider._ballCz;
        const broadR = collider._ballBr + r;
        if (bdx * bdx + bdz * bdz > broadR * broadR) continue;

        // Rim uses torus collision — ball passes through the open center
        if (collider.isRim) {
            if (ball._ignoreRimTimer > 0) continue;
            if (resolveRimTorusCollision(ball, collider)) {
                hadCollision = true;
                if (hitInfo) { hitInfo.hit = true; hitInfo.nx = 0; hitInfo.nz = 0; }
            }
            continue;
        }

        if (collider.type === 'cylinder') {
            const dx = p.x - collider.x;
            const dz = p.z - collider.z;
            const combined = r + collider.radius;
            const distSq = dx * dx + dz * dz;
            if (distSq >= combined * combined) continue;

            let dist = Math.sqrt(Math.max(distSq, 1e-10));
            let nx = dx / dist;
            let nz = dz / dist;
            if (dist < 1e-5) {
                nx = 1;
                nz = 0;
                dist = 0;
            }

            const push = combined - dist + 1e-4;
            p.x += nx * push;
            p.z += nz * push;
            bounceAgainstNormal(ball, nx, nz, WALL_BOUNCE);
            hadCollision = true;
            if (hitInfo) {
                hitInfo.hit = true;
                hitInfo.nx = nx;
                hitInfo.nz = nz;
            }
            continue;
        }

        if (collider.type === 'aabb') {
            const cx = Math.max(collider.minX, Math.min(p.x, collider.maxX));
            const cz = Math.max(collider.minZ, Math.min(p.z, collider.maxZ));
            const dx = p.x - cx;
            const dz = p.z - cz;
            const distSq = dx * dx + dz * dz;
            if (distSq >= r * r) continue;

            let nx = 1;
            let nz = 0;
            let push = 0;

            if (distSq > 1e-8) {
                const dist = Math.sqrt(distSq);
                nx = dx / dist;
                nz = dz / dist;
                push = r - dist + 1e-4;
            } else {
                const toMinX = Math.abs(p.x - collider.minX);
                const toMaxX = Math.abs(collider.maxX - p.x);
                const toMinZ = Math.abs(p.z - collider.minZ);
                const toMaxZ = Math.abs(collider.maxZ - p.z);
                const minDist = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
                if (minDist === toMinX) {
                    nx = -1; nz = 0; push = toMinX + r + 1e-4;
                } else if (minDist === toMaxX) {
                    nx = 1; nz = 0; push = toMaxX + r + 1e-4;
                } else if (minDist === toMinZ) {
                    nx = 0; nz = -1; push = toMinZ + r + 1e-4;
                } else {
                    nx = 0; nz = 1; push = toMaxZ + r + 1e-4;
                }
            }

            p.x += nx * push;
            p.z += nz * push;
            bounceAgainstNormal(ball, nx, nz, WALL_BOUNCE);
            hadCollision = true;
            if (hitInfo) {
                hitInfo.hit = true;
                hitInfo.nx = nx;
                hitInfo.nz = nz;
            }
        }
    }
    return hadCollision;
}

function ensureBallBroadphase(collider) {
    if (collider._ballBroadphaseReady) return;

    if (collider.type === 'cylinder') {
        collider._ballCx = collider.x;
        collider._ballCz = collider.z;
        collider._ballBr = collider.radius + COLLIDER_BROADPHASE_PAD;
    } else {
        const cx = (collider.minX + collider.maxX) * 0.5;
        const cz = (collider.minZ + collider.maxZ) * 0.5;
        const hx = (collider.maxX - collider.minX) * 0.5;
        const hz = (collider.maxZ - collider.minZ) * 0.5;
        collider._ballCx = cx;
        collider._ballCz = cz;
        collider._ballBr = Math.hypot(hx, hz) + COLLIDER_BROADPHASE_PAD;
    }

    collider._ballBroadphaseReady = true;
}

function resolvePlayerCollision(ball, playerData) {
    if (!playerData?.group?.visible) return;
    if (ball._ignorePlayerTimer > 0 && ball._ignorePlayerRef === playerData) return;
    if (ball._ignorePlayerTimer > 0 && !ball._ignorePlayerRef) return;

    const p = ball.mesh.position;
    const playerPos = playerData.group.position;
    const playerGroundY = playerPos.y + (playerData.visualGroundOffsetY || 0);
    const playerTopY = playerGroundY + 1.9;
    if (p.y + ball.radius < playerGroundY || p.y - ball.radius > playerTopY) return;

    const playerRadius = 0.25;
    const dx = p.x - playerPos.x;
    const dz = p.z - playerPos.z;
    const combined = ball.radius + playerRadius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= combined * combined) return;

    let dist = Math.sqrt(Math.max(distSq, 1e-10));
    let nx = dx / dist;
    let nz = dz / dist;
    if (dist < 1e-5) {
        nx = 1;
        nz = 0;
        dist = 0;
    }

    const push = combined - dist + 1e-4;
    p.x += nx * push;
    p.z += nz * push;

    const playerVx = playerData.velocity?.x || 0;
    const playerVz = playerData.velocity?.z || 0;
    const playerAlongN = playerVx * nx + playerVz * nz;
    const assistActive = !!playerData?._pickupAssistActive;
    const impulse = Math.max(0, playerAlongN) + (assistActive ? 0.35 : 1.1);

    ball.velocity.x += nx * impulse;
    ball.velocity.z += nz * impulse;
    ball.velocity.y += assistActive ? 0.05 : 0.15;
    ball.sleeping = false;
    ball._lastTouchRef = playerData;
}

function bounceAgainstNormal(ball, nx, nz, restitution) {
    tmpNormal.set(nx, 0, nz).normalize();
    const vn = ball.velocity.dot(tmpNormal);
    if (vn < 0) {
        ball.velocity.addScaledVector(tmpNormal, -(1 + restitution) * vn);
    }

    // Tangential damping to avoid jittering/sliding forever along fences.
    const tangentFactor = 1 - Math.min(0.22, ROLL_DAMP * 0.016);
    tmpTangent.copy(ball.velocity);
    const nowVn = tmpTangent.dot(tmpNormal);
    tmpTangent.addScaledVector(tmpNormal, -nowVn);
    tmpTangent.multiplyScalar(tangentFactor);
    ball.velocity.x = tmpTangent.x + tmpNormal.x * nowVn;
    ball.velocity.z = tmpTangent.z + tmpNormal.z * nowVn;

    ball.sleeping = false;
}

/**
 * 3D bounce — reflects velocity off an arbitrary surface normal (used for rim hits).
 * Unlike bounceAgainstNormal which is XZ-only, this handles the full Y component
 * so balls hitting the top/side of the rim respond correctly.
 */
function bounceAgainstNormal3D(ball, nx, ny, nz, restitution) {
    const vn = ball.velocity.x * nx + ball.velocity.y * ny + ball.velocity.z * nz;
    if (vn < 0) {
        ball.velocity.x -= (1 + restitution) * vn * nx;
        ball.velocity.y -= (1 + restitution) * vn * ny;
        ball.velocity.z -= (1 + restitution) * vn * nz;
    }
    ball.sleeping = false;
}

/**
 * Torus collision — ball vs rim ring.
 *
 * The rim is a ring (torus) with a major radius (rimRingRadius) and a small
 * tube radius (RIM_COLLISION_TUBE). The ball should bounce off the metal tube
 * but pass freely through the open center of the ring.
 *
 * Math: find the closest point on the rim circle (a circle in 3D at y = rimY),
 * then check sphere-vs-sphere between the ball and a virtual sphere at that
 * closest point with radius = RIM_COLLISION_TUBE.
 */
function resolveRimTorusCollision(ball, collider) {
    const p = ball.mesh.position;
    const r = ball.radius;
    const rimY = (collider.yMin + collider.yMax) * 0.5;
    const ringR = collider.rimRingRadius;

    // Vector from rim center to ball in XZ plane
    const dx = p.x - collider.x;
    const dz = p.z - collider.z;
    const distXZ = Math.hypot(dx, dz);

    // Closest point on the rim ring circle to the ball center
    let closestX, closestZ;
    if (distXZ > 1e-6) {
        closestX = collider.x + (dx / distXZ) * ringR;
        closestZ = collider.z + (dz / distXZ) * ringR;
    } else {
        // Ball directly above ring center — pick any point on the ring
        closestX = collider.x + ringR;
        closestZ = collider.z;
    }

    // 3D distance from ball center to closest point on ring
    const ddx = p.x - closestX;
    const ddy = p.y - rimY;
    const ddz = p.z - closestZ;
    const distToRing = Math.hypot(ddx, ddy, ddz);

    const combined = r + RIM_COLLISION_TUBE;
    if (distToRing >= combined) return false;

    // Collision — compute normal pointing from ring surface toward ball
    let nx, ny, nz;
    if (distToRing > 1e-6) {
        nx = ddx / distToRing;
        ny = ddy / distToRing;
        nz = ddz / distToRing;
    } else {
        // Exactly on the ring — push upward
        nx = 0; ny = 1; nz = 0;
    }

    const push = combined - distToRing + 1e-4;
    p.x += nx * push;
    p.y += ny * push;
    p.z += nz * push;

    bounceAgainstNormal3D(ball, nx, ny, nz, RIM_BOUNCE);
    return true;
}

function applyRollingRotation(ball) {
    const displacement = tmpAxis.copy(ball.mesh.position).sub(ball.prevPosition);
    ball.prevPosition.copy(ball.mesh.position);

    // Visual backspin during shot flight
    if (ball._backspin && !ball.grounded && !ball.heldByPlayer) {
        const spin = ball._backspin;
        tmpQuat.setFromAxisAngle(spin.axis, spin.speed * 0.016);
        ball.mesh.quaternion.premultiply(tmpQuat);
        // Decay spin over time
        spin.speed *= 0.995;
        if (spin.speed < 0.5) ball._backspin = null;
    }

    const horizontalDist = Math.hypot(displacement.x, displacement.z);
    if (horizontalDist < 1e-6) return;

    // Roll axis is perpendicular to travel direction on ground plane.
    tmpAxis.set(displacement.z / horizontalDist, 0, -displacement.x / horizontalDist);
    const angle = horizontalDist / ball.radius;
    tmpQuat.setFromAxisAngle(tmpAxis, angle);
    ball.mesh.quaternion.premultiply(tmpQuat);
}

function applySleep(ball) {
    const horizontalSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
    const verticalSpeed = Math.abs(ball.velocity.y);
    if (ball.grounded && horizontalSpeed < 0.03 && verticalSpeed < 0.03) {
        ball.idleFrames += 1;
        if (ball.idleFrames > 24) {
            ball.sleeping = true;
            ball.velocity.set(0, 0, 0);
        }
    } else {
        ball.idleFrames = 0;
        ball.sleeping = false;
    }
}

function updateHeldByPlayer(ball, playerData, delta, environmentColliders = null, snap = false) {
    const dt = Math.max(1 / 240, Math.min(delta || 1 / 60, 0.05));
    const playerPos = playerData.group.position;
    const groundY = getPlayerGroundY(playerData);
    const speed = Math.hypot(playerData.velocity?.x || 0, playerData.velocity?.z || 0);
    const dribbling = playerData.isGrounded && speed > DRIBBLE_TRIGGER_SPEED;

    const facing = playerData.facingAngle || 0;
    tmpForward.set(Math.sin(facing), 0, Math.cos(facing));
    if (tmpForward.lengthSq() < 1e-8) tmpForward.set(0, 0, 1);
    tmpForward.normalize();
    tmpRight.set(tmpForward.z, 0, -tmpForward.x).normalize();
    // Update only the dirty matrices (not forced recursive) — renderer will
    // handle the rest; localToWorld in getHandWorldPosition only needs the
    // elbow's chain to be current, which updateMatrixWorld() handles lazily.
    playerData.group.updateMatrixWorld();

    getHandWorldPosition(playerData, 'right', tmpRightHand, playerPos, groundY);
    getHandWorldPosition(playerData, 'left', tmpLeftHand, playerPos, groundY);
    selectPlayerRightHand(tmpChosenDribbleHand, tmpRightHand, tmpLeftHand, playerPos, tmpRight, playerData);
    let phase01 = 0;

    // ── Shooting stance hold ──────────────────────────
    if (ball._shootingStance) {
        // Ball held above head, slightly in front — follows shooting hand
        const shootHoldY = groundY + SHOT_RELEASE_HEIGHT;
        tmpHoldTarget.set(
            playerPos.x + tmpForward.x * 0.15,
            shootHoldY,
            playerPos.z + tmpForward.z * 0.15
        );

        const follow = snap ? 1 : (1 - Math.exp(-HOLD_SMOOTH_IDLE * dt));
        ball.mesh.position.lerp(tmpHoldTarget, follow);
        ball.velocity.set(0, 0, 0);
        ball.sleeping = false;
        ball.grounded = false;
        ball.idleFrames = 0;
        ball.prevPosition.copy(ball.mesh.position);
        return false;
    }

    // ── Passing stance hold — chest level ──────────────
    if (ball._passingStance) {
        const passHoldY = groundY + HOLD_CHEST_HEIGHT;
        tmpHoldTarget.set(
            playerPos.x + tmpForward.x * 0.18,
            passHoldY,
            playerPos.z + tmpForward.z * 0.18
        );

        const follow = snap ? 1 : (1 - Math.exp(-HOLD_SMOOTH_IDLE * dt));
        ball.mesh.position.lerp(tmpHoldTarget, follow);
        ball.velocity.set(0, 0, 0);
        ball.sleeping = false;
        ball.grounded = false;
        ball.idleFrames = 0;
        ball.prevPosition.copy(ball.mesh.position);
        return false;
    }

    if (dribbling) {
        const speedT = THREE.MathUtils.clamp((speed - DRIBBLE_TRIGGER_SPEED) / 3.2, 0, 1);
        const cadence = THREE.MathUtils.lerp(DRIBBLE_SPEED_MIN, DRIBBLE_SPEED_MAX, speedT);
        ball.dribblePhase += dt * cadence * Math.PI * 2;
        if (ball.dribblePhase > Math.PI * 2) ball.dribblePhase %= Math.PI * 2;

        // Keep dribble under the right hand, slightly in front of the player.
        tmpHoldTarget.copy(tmpChosenDribbleHand);
        tmpHoldTarget.addScaledVector(tmpForward, DRIBBLE_HAND_FORWARD);
        tmpHoldTarget.addScaledVector(tmpRight, DRIBBLE_HAND_SIDE);

        const floorY = sampleFloorY(tmpHoldTarget.x, tmpHoldTarget.z);
        const minY = floorY + ball.radius + DRIBBLE_MIN_CLEARANCE;
        const contactY = tmpChosenDribbleHand.y - ball.radius + DRIBBLE_CONTACT_GAP;
        const maxY = Math.max(contactY, minY + DRIBBLE_MIN_STROKE, groundY + 0.84);
        phase01 = (ball.dribblePhase / (Math.PI * 2)) % 1;
        const downEnd = 0.5;
        const bounceEnd = downEnd + DRIBBLE_BOTTOM_DWELL;

        if (phase01 < DRIBBLE_TOP_DWELL) {
            // Hand contact at top before pushing the ball down.
            tmpHoldTarget.y = maxY;
        } else if (phase01 < downEnd) {
            const t = (phase01 - DRIBBLE_TOP_DWELL) / (downEnd - DRIBBLE_TOP_DWELL);
            const eased = t * t * (3 - 2 * t);
            tmpHoldTarget.y = THREE.MathUtils.lerp(maxY, minY, eased);
        } else if (phase01 < bounceEnd) {
            // Short floor compression/rebound moment.
            const t = (phase01 - downEnd) / DRIBBLE_BOTTOM_DWELL;
            tmpHoldTarget.y = THREE.MathUtils.lerp(minY, minY + 0.015, t);
        } else {
            const t = (phase01 - bounceEnd) / (1 - bounceEnd);
            const eased = t * t * (3 - 2 * t);
            tmpHoldTarget.y = THREE.MathUtils.lerp(minY, maxY, eased);
        }

        // Keep the ball clearly on the right side and out in front during dribble.
        constrainHeldBallFromPlayer(ball, playerData, tmpHoldTarget, true, tmpForward, tmpRight);
    } else {
        ball.dribblePhase = 0;

        // Place ball exactly between both hands so it does not appear to float.
        tmpBallFromRight.copy(tmpRightHand)
            .addScaledVector(tmpRight, -(ball.radius - HOLD_HAND_INSET));
        tmpBallFromLeft.copy(tmpLeftHand)
            .addScaledVector(tmpRight, (ball.radius - HOLD_HAND_INSET));
        tmpHoldTarget.copy(tmpBallFromRight).add(tmpBallFromLeft).multiplyScalar(0.5);
        tmpHoldTarget.y = Math.max(tmpHoldTarget.y, groundY + HOLD_CHEST_HEIGHT - 0.08);
        constrainHeldBallFromPlayer(ball, playerData, tmpHoldTarget, false, tmpForward, tmpRight);
    }

    const smooth = dribbling ? HOLD_SMOOTH_DRIBBLE : HOLD_SMOOTH_IDLE;
    let follow = snap ? 1 : (1 - Math.exp(-smooth * dt));
    // At hand-contact phase, pin tightly so top of dribble reaches the hand.
    if (dribbling && phase01 < DRIBBLE_TOP_DWELL + 0.03) {
        follow = Math.max(follow, 0.96);
    }
    tmpPrevBallPos.copy(ball.mesh.position);
    ball.mesh.position.lerp(tmpHoldTarget, follow);

    if (dribbling && environmentColliders && environmentColliders.length > 0) {
        const invDt = 1 / Math.max(dt, 1e-4);
        ball.velocity.copy(ball.mesh.position).sub(tmpPrevBallPos).multiplyScalar(invDt);

        heldCollisionHit.hit = false;
        heldCollisionHit.nx = 0;
        heldCollisionHit.nz = 0;
        const collided = resolveEnvironmentCollisions(ball, environmentColliders, heldCollisionHit);

        if (collided && heldCollisionHit.hit) {
            // Bounce away from player along impact angle, then release control.
            const awayX = ball.mesh.position.x - playerPos.x;
            const awayZ = ball.mesh.position.z - playerPos.z;
            const awayLen = Math.hypot(awayX, awayZ);
            const awayBoost = Math.max(1.0, speed * 0.65);

            if (awayLen > 1e-5) {
                ball.velocity.x += (awayX / awayLen) * awayBoost;
                ball.velocity.z += (awayZ / awayLen) * awayBoost;
            } else {
                ball.velocity.addScaledVector(tmpRight, awayBoost);
            }

            ball.velocity.y = Math.max(ball.velocity.y, 0.28);
            releaseHeldBall(ball, playerData, true);
            ball.prevPosition.copy(ball.mesh.position);
            return true;
        }
    }

    if (dribbling) {
        const spin = THREE.MathUtils.lerp(6.5, 10.5, THREE.MathUtils.clamp(speed / 4.8, 0, 1));
        tmpAxis.copy(tmpRight);
        tmpQuat.setFromAxisAngle(tmpAxis, spin * dt);
        ball.mesh.quaternion.premultiply(tmpQuat);
    }

    ball.heldByPlayer = true;
    ball.dribblingByPlayer = dribbling;
    ball.velocity.set(0, 0, 0);
    ball.sleeping = false;
    ball.grounded = false;
    ball.idleFrames = 0;
    ball.prevPosition.copy(ball.mesh.position);
    return false;
}

function getHandWorldPosition(playerData, side, out, playerPos, groundY) {
    const elbow = side === 'right' ? playerData.joints?.rightElbow : playerData.joints?.leftElbow;
    if (elbow) {
        out.set(0, -0.29, 0.01);
        elbow.localToWorld(out);
        return out;
    }

    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const rightX = fwdZ;
    const rightZ = -fwdX;
    const sideSign = side === 'right' ? 1 : -1;
    out.set(
        playerPos.x + fwdX * 0.2 + rightX * sideSign * 0.24,
        groundY + 1.12,
        playerPos.z + fwdZ * 0.2 + rightZ * sideSign * 0.24
    );
    return out;
}

function selectPlayerRightHand(out, rightHand, leftHand, playerPos, rightDir, playerData) {
    const rightDot = tmpHandSide.copy(rightHand).sub(playerPos).dot(rightDir);
    const leftDot = tmpHandSide.copy(leftHand).sub(playerPos).dot(rightDir);
    const useRight = rightDot >= leftDot;
    out.copy(useRight ? rightHand : leftHand);
    // Tag which hand is dribbling so the punch system can use the other
    if (playerData) playerData._dribbleHand = useRight ? 'right' : 'left';
    return out;
}

function constrainHeldBallFromPlayer(ball, playerData, target, dribbling, forward, right) {
    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;
    let dx = target.x - px;
    let dz = target.z - pz;
    const minDist = dribbling ? 0.34 : 0.16;
    let distSq = dx * dx + dz * dz;

    if (distSq < minDist * minDist) {
        let nx;
        let nz;
        if (distSq < 1e-8) {
            nx = forward.x + (dribbling ? right.x * 0.4 : 0);
            nz = forward.z + (dribbling ? right.z * 0.4 : 0);
            const nLen = Math.hypot(nx, nz) || 1;
            nx /= nLen;
            nz /= nLen;
        } else {
            const dist = Math.sqrt(distSq);
            nx = dx / dist;
            nz = dz / dist;
        }
        target.x = px + nx * minDist;
        target.z = pz + nz * minDist;
        dx = target.x - px;
        dz = target.z - pz;
        distSq = dx * dx + dz * dz;
    }

    if (dribbling) {
        const sideAlongRight = dx * right.x + dz * right.z;
        if (sideAlongRight < 0.07) {
            target.x += right.x * (0.07 - sideAlongRight);
            target.z += right.z * (0.07 - sideAlongRight);
        }
    }
}

function releaseHeldBall(ball, playerData = null, preserveVelocity = false) {
    if (!ball.heldByPlayer) return;

    ball.heldByPlayer = false;
    ball.heldByPlayerData = null;
    ball._dunkControl = false;
    ball._ignoreRimTimer = 0;
    ball._ignorePlayerTimer = 0;
    ball.dribblingByPlayer = false;
    ball._shootingStance = false;
    ball._passingStance = false;
    ball.idleFrames = 0;
    ball.grounded = false;
    ball.sleeping = false;

    if (!preserveVelocity) {
        const vx = (playerData?.velocity?.x || 0) * 0.35;
        const vz = (playerData?.velocity?.z || 0) * 0.35;
        ball.velocity.set(vx, 0.1, vz);
    } else {
        const hs = Math.hypot(ball.velocity.x, ball.velocity.z);
        if (hs < 0.15) {
            ball.velocity.x += (playerData?.velocity?.x || 0) * 0.5;
            ball.velocity.z += (playerData?.velocity?.z || 0) * 0.5;
        }
        ball.velocity.y = Math.max(ball.velocity.y, 0.08);
    }

    ball.prevPosition.copy(ball.mesh.position);
}

// ─── Shooting ───────────────────────────────────────────────

/**
 * Compute the two rim center positions (z coordinates) for both hoops.
 * Returns the one the player is facing (dot product with facing direction).
 */
function getTargetRimPosition(playerData) {
    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;

    const rims = [];
    for (const side of [-1, 1]) {
        const baselineZ = side * HALF_COURT_LENGTH;
        const backboardFaceZ = baselineZ - side * BACKBOARD_FROM_BASELINE;
        const rimZ = backboardFaceZ - side * (RIM_FROM_BACKBOARD + RIM_RADIUS_HOOP);
        rims.push({ x: 0, y: RIM_HEIGHT, z: rimZ });
    }

    // Pick the rim the player is more facing toward
    let best = rims[0];
    let bestDot = -Infinity;
    for (const rim of rims) {
        const dx = rim.x - px;
        const dz = rim.z - pz;
        const dot = dx * fwdX + dz * fwdZ;
        if (dot > bestDot) {
            bestDot = dot;
            best = rim;
        }
    }
    return best;
}

/**
 * Shoot the basketball toward the nearest hoop the player is facing.
 * Uses projectile motion formula to calculate the required initial velocity
 * given the launch angle, release position, and target (rim center).
 *
 * @param {object} ball - ball state object
 * @param {object} playerData - player state object
 * @param {number} launchAngleDeg - launch angle in degrees from horizontal
 * @param {number} powerMultiplier - shot force multiplier from the power meter
 * @returns {boolean} true if shot was released successfully
 */
export function shootBasketball(ball, playerData, launchAngleDeg, powerMultiplier = 1.0) {
    if (!ball || !ball.heldByPlayer || !playerData) return false;
    ball._lastShooterRef = playerData;
    ball._lastTouchRef = playerData;
    const shotPower = THREE.MathUtils.clamp(powerMultiplier, SHOT_POWER_MIN, SHOT_POWER_MAX);

    const rim = getTargetRimPosition(playerData);
    const groundY = getPlayerGroundY(playerData);
    const releaseY = groundY + SHOT_RELEASE_HEIGHT;

    const px = playerData.group.position.x;
    const pz = playerData.group.position.z;

    // Track shooter distance from rim at release time (for three-point detection)
    ball._lastShotReleaseDistToRim = Math.hypot(px - rim.x, pz - rim.z);

    // Use player facing direction for the shot, not raw aim at rim
    const facing = playerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);

    // Horizontal distance from release point to rim center
    const dx = rim.x - px;
    const dz = rim.z - pz;
    const horizontalDist = Math.hypot(dx, dz);

    // Height difference (target - release)
    const dy = rim.y - releaseY;

    // Clamp launch angle
    const angleDeg = Math.max(SHOT_MIN_ANGLE, Math.min(SHOT_MAX_ANGLE, launchAngleDeg));
    const angleRad = angleDeg * Math.PI / 180;

    const cosA = Math.cos(angleRad);
    const tanA = Math.tan(angleRad);
    const g = Math.abs(GRAVITY); // use ball.js GRAVITY (11.5)

    // Projectile formula: speed = sqrt(g * d^2 / (2 * cos^2(a) * (d*tan(a) - dy)))
    const denominator = horizontalDist * tanA - dy;
    if (denominator <= 0.01) {
        // Angle too flat to reach the target — just lob it forward
        ball.velocity.set(fwdX * 5 * shotPower, 6 * shotPower, fwdZ * 5 * shotPower);
        releaseHeldBall(ball, playerData, true);
        return true;
    }

    const speedSq = (g * horizontalDist * horizontalDist) / (2 * cosA * cosA * denominator);
    if (speedSq <= 0) {
        ball.velocity.set(fwdX * 5 * shotPower, 6 * shotPower, fwdZ * 5 * shotPower);
        releaseHeldBall(ball, playerData, true);
        return true;
    }

    const speed = Math.sqrt(speedSq);

    // Cap speed to prevent absurd launches from very close range
    const cappedSpeed = Math.min(speed, 18);
    const poweredSpeed = Math.min(cappedSpeed * shotPower, 20);

    // Decompose into 3D velocity using PLAYER FACING direction
    const vHorizontal = poweredSpeed * cosA;
    const vy = poweredSpeed * Math.sin(angleRad);

    // Aim correction: blend facing direction with actual rim direction
    // This gives the player's facing direction priority but gently corrects
    // toward the rim so shots don't fly wildly off target
    const rimDirX = horizontalDist > 0.1 ? dx / horizontalDist : fwdX;
    const rimDirZ = horizontalDist > 0.1 ? dz / horizontalDist : fwdZ;

    // 70% facing direction + 30% actual rim direction = some aim assist
    const aimX = fwdX * 0.7 + rimDirX * 0.3;
    const aimZ = fwdZ * 0.7 + rimDirZ * 0.3;
    const aimLen = Math.hypot(aimX, aimZ) || 1;

    ball.velocity.set(
        vHorizontal * (aimX / aimLen),
        vy,
        vHorizontal * (aimZ / aimLen)
    );

    // Position ball at release point (above head)
    ball.mesh.position.set(px + fwdX * 0.15, releaseY, pz + fwdZ * 0.15);

    // Release the ball
    releaseHeldBall(ball, playerData, true);

    // Add visual backspin (rotate around the right axis relative to facing)
    const spinAxis = new THREE.Vector3(fwdZ, 0, -fwdX).normalize();
    ball._backspin = { axis: spinAxis, speed: SHOT_BACKSPIN };

    return true;
}

function getPlayerGroundY(playerData) {
    return playerData.group.position.y + (playerData.visualGroundOffsetY || 0);
}

function sampleFloorY(x, z) {
    // Main painted playing surface
    if (Math.abs(x) <= COURT_WIDTH / 2 && Math.abs(z) <= COURT_LENGTH / 2) {
        return 0.06;
    }

    // Surrounding blacktop/asphalt pad
    if (
        Math.abs(x) <= COURT_WIDTH / 2 + ASPHALT_PAD_X &&
        Math.abs(z) <= COURT_LENGTH / 2 + ASPHALT_PAD_Z
    ) {
        return 0.045;
    }

    // Park base ground plane
    return -0.02;
}

// ─── Passing ─────────────────────────────────────────────────
const PASS_CHEST_HEIGHT = 1.18;
const TEAMMATE_CATCH_RADIUS = 0.65;

export function passBallToTarget(ball, fromPlayerData, targetPosition, passType) {
    if (!ball || !ball.heldByPlayer || !fromPlayerData) return false;

    const facing = fromPlayerData.facingAngle || 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const groundY = getPlayerGroundY(fromPlayerData);
    const releaseY = groundY + PASS_CHEST_HEIGHT;

    const px = fromPlayerData.group.position.x;
    const pz = fromPlayerData.group.position.z;

    // Release point slightly in front
    const releaseX = px + fwdX * 0.25;
    const releaseZ = pz + fwdZ * 0.25;

    const dx = targetPosition.x - releaseX;
    const dy = targetPosition.y - releaseY;
    const dz = targetPosition.z - releaseZ;
    const horizontalDist = Math.hypot(dx, dz);

    if (passType === 'chest') {
        // Quick direct pass — fast, slight loft
        const speed = THREE.MathUtils.clamp(horizontalDist * 2.2 + 4, 6, 14);
        const dirX = horizontalDist > 0.1 ? dx / horizontalDist : fwdX;
        const dirZ = horizontalDist > 0.1 ? dz / horizontalDist : fwdZ;
        const loft = 0.6 + horizontalDist * 0.08;

        ball.velocity.set(dirX * speed, loft + dy * 0.3, dirZ * speed);
    } else {
        // Aimed pass — uses player facing direction (like shooting)
        const speed = THREE.MathUtils.clamp(horizontalDist * 1.8 + 5, 7, 16);
        const loft = 0.4 + horizontalDist * 0.06;

        ball.velocity.set(fwdX * speed, loft + dy * 0.25, fwdZ * speed);
    }

    // Position at release point
    ball.mesh.position.set(releaseX, releaseY, releaseZ);

    // Ignore the passer so ball clears them before collision kicks in
    ball._ignorePlayerRef = fromPlayerData;
    ball._lastTouchRef = fromPlayerData;
    releaseHeldBall(ball, fromPlayerData, true);
    ball._ignorePlayerTimer = 0.45;

    return true;
}

export function tryTeammateCatch(ball, teammateData) {
    if (!ball || !ball.active || !ball.mesh.visible) return false;
    if (ball.heldByPlayer) return false;
    if (!teammateData?.group?.visible) return false;
    // Don't catch if this player just threw the ball
    if (ball._ignorePlayerTimer > 0 && ball._ignorePlayerRef === teammateData) return false;

    const bPos = ball.mesh.position;
    const tPos = teammateData.group.position;
    const groundY = getPlayerGroundY(teammateData);

    // Check XZ distance
    const dx = bPos.x - tPos.x;
    const dz = bPos.z - tPos.z;
    if (dx * dx + dz * dz > TEAMMATE_CATCH_RADIUS * TEAMMATE_CATCH_RADIUS) return false;

    // Check vertical — ball should be between knees and head
    const ballRelY = bPos.y - groundY;
    if (ballRelY < 0.3 || ballRelY > 2.0) return false;

    // Catch it
    ball.heldByPlayer = true;
    ball.heldByPlayerData = teammateData;
    ball._lastTouchRef = teammateData;
    ball.dribblingByPlayer = false;
    ball.dribblePhase = 0;
    ball._dunkControl = false;
    ball._ignoreRimTimer = 0;
    ball._ignorePlayerTimer = 0;
    ball._ignorePlayerRef = null;
    ball.sleeping = false;
    ball.grounded = false;
    ball.idleFrames = 0;
    ball.velocity.set(0, 0, 0);

    updateHeldByPlayer(ball, teammateData, 1 / 60, null, true);
    ball.prevPosition.copy(ball.mesh.position);
    return true;
}

/**
 * Force-drop the ball from whoever is holding it (e.g. when punched).
 * Ball pops up and away in the given direction.
 */
export function forceDropBall(ball, hitDirX, hitDirZ, puncher = null) {
    if (!ball || !ball.heldByPlayer) return;
    const holder = ball.heldByPlayerData;
    releaseHeldBall(ball, holder, false);
    // Give it a pop-up and push in the hit direction
    ball.velocity.set(hitDirX * 2.5, 3.0, hitDirZ * 2.5);
    // The puncher deflected the ball — they are the last to touch
    if (puncher) ball._lastTouchRef = puncher;
}

function createBallTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Leather base
    const grad = ctx.createRadialGradient(size * 0.35, size * 0.32, size * 0.08, size * 0.5, size * 0.5, size * 0.75);
    grad.addColorStop(0, '#ea8d3a');
    grad.addColorStop(0.5, '#d97a2f');
    grad.addColorStop(1, '#bf5f22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Pebbled texture noise
    for (let i = 0; i < 30000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const a = 0.03 + Math.random() * 0.08;
        const light = 120 + Math.floor(Math.random() * 70);
        ctx.fillStyle = `rgba(${light}, ${Math.floor(light * 0.55)}, ${Math.floor(light * 0.2)}, ${a})`;
        ctx.fillRect(x, y, 1.3, 1.3);
    }

    // Dark seams
    ctx.strokeStyle = '#1a140f';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';

    // Equator + meridian
    ctx.beginPath();
    ctx.moveTo(0, size * 0.5);
    ctx.lineTo(size, size * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size);
    ctx.stroke();

    // Curved side seams
    ctx.beginPath();
    ctx.moveTo(size * 0.25, 0);
    ctx.bezierCurveTo(size * 0.38, size * 0.23, size * 0.38, size * 0.77, size * 0.25, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.75, 0);
    ctx.bezierCurveTo(size * 0.62, size * 0.23, size * 0.62, size * 0.77, size * 0.75, size);
    ctx.stroke();

    // Seam highlights for depth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.5 - 4);
    ctx.lineTo(size, size * 0.5 - 4);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
