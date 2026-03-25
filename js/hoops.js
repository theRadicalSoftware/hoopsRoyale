import * as THREE from 'three';

// ─── Dimensions (meters) ────────────────────────────────────
const RIM_HEIGHT = 3.048;           // 10 ft
const RIM_RADIUS = 0.2286;         // 18 in diameter / 2
const RIM_TUBE = 0.012;            // rim tube thickness
const BACKBOARD_WIDTH = 1.83;      // 72 in
const BACKBOARD_HEIGHT = 1.07;     // 42 in
const BACKBOARD_THICKNESS = 0.04;
const BACKBOARD_FROM_BASELINE = 1.22; // 4 ft from baseline to board face
const RIM_FROM_BACKBOARD = 0.15;    // 6 inches from board face to rim center
const HALF_COURT_LENGTH = 14.325;

const POLE_RADIUS = 0.1;
const POLE_COLOR = 0x333333;

export function createHoops(scene) {
    const hoopsGroup = new THREE.Group();
    hoopsGroup.name = 'hoops';
    const colliders = [];

    createHoopAssembly(hoopsGroup, -1, colliders);
    createHoopAssembly(hoopsGroup, 1, colliders);

    scene.userData.hoopColliders = colliders;
    scene.add(hoopsGroup);
    return hoopsGroup;
}

function createHoopAssembly(group, side, colliders) {
    const assembly = new THREE.Group();

    const baselineZ = side * HALF_COURT_LENGTH;
    // Backboard face position (inward from baseline)
    const backboardFaceZ = baselineZ - side * BACKBOARD_FROM_BASELINE;
    // Backboard center (half-thickness behind the face)
    const backboardCenterZ = backboardFaceZ + side * (BACKBOARD_THICKNESS / 2);
    // Rim center — extends out from the backboard face
    const rimCenterZ = backboardFaceZ - side * (RIM_FROM_BACKBOARD + RIM_RADIUS);

    // Backboard vertical center
    const boardCenterY = RIM_HEIGHT + BACKBOARD_HEIGHT * 0.15;

    createPoleStructure(assembly, side, baselineZ, backboardCenterZ, boardCenterY);
    createBackboard(assembly, backboardCenterZ, backboardFaceZ, boardCenterY);
    createRimAndBracket(assembly, rimCenterZ, backboardFaceZ, side);
    createNet(assembly, rimCenterZ);
    addHoopColliders(colliders, side, baselineZ, backboardCenterZ, backboardFaceZ, boardCenterY, rimCenterZ);

    group.add(assembly);
}

function addHoopColliders(colliders, side, baselineZ, backboardCenterZ, backboardFaceZ, boardCenterY, rimCenterZ) {
    const poleZ = baselineZ + side * 0.8;
    const boardMinY = boardCenterY - BACKBOARD_HEIGHT / 2;
    const boardMaxY = boardCenterY + BACKBOARD_HEIGHT / 2;

    // Main post + padding + base protection.
    colliders.push({
        type: 'cylinder',
        x: 0,
        z: poleZ,
        radius: 0.24,
        yMin: 0,
        yMax: 4.2
    });
    colliders.push({
        type: 'cylinder',
        x: 0,
        z: poleZ,
        radius: 0.46,
        yMin: 0,
        yMax: 0.32
    });

    // Backboard and frame slab.
    colliders.push({
        type: 'aabb',
        minX: -BACKBOARD_WIDTH * 0.5 - 0.07,
        maxX: BACKBOARD_WIDTH * 0.5 + 0.07,
        minZ: backboardCenterZ - (BACKBOARD_THICKNESS * 0.5 + 0.06),
        maxZ: backboardCenterZ + (BACKBOARD_THICKNESS * 0.5 + 0.06),
        yMin: boardMinY - 0.06,
        yMax: boardMaxY + 0.1
    });

    // Rim ring collision volume.
    colliders.push({
        type: 'cylinder',
        x: 0,
        z: rimCenterZ,
        radius: RIM_RADIUS + 0.08,
        yMin: RIM_HEIGHT - 0.09,
        yMax: RIM_HEIGHT + 0.09
    });

    // Net volume so jump/player body can't pass through the chain net.
    colliders.push({
        type: 'cylinder',
        x: 0,
        z: rimCenterZ,
        radius: RIM_RADIUS * 0.82,
        yMin: RIM_HEIGHT - 0.48,
        yMax: RIM_HEIGHT - 0.02
    });

    // Neck + mount bracket zone connecting rim to board.
    const neckStartZ = rimCenterZ + side * RIM_RADIUS;
    colliders.push({
        type: 'aabb',
        minX: -0.12,
        maxX: 0.12,
        minZ: Math.min(neckStartZ, backboardFaceZ) - 0.04,
        maxZ: Math.max(neckStartZ, backboardFaceZ) + 0.04,
        yMin: RIM_HEIGHT - 0.11,
        yMax: RIM_HEIGHT + 0.11
    });
}

// ─── Pole Structure ─────────────────────────────────────────
function createPoleStructure(assembly, side, baselineZ, backboardCenterZ, boardCenterY) {
    const poleMat = new THREE.MeshStandardMaterial({
        color: POLE_COLOR, roughness: 0.4, metalness: 0.8
    });

    // Pole sits behind the baseline
    const poleZ = baselineZ + side * 0.8;
    // Pole must reach the top of the backboard
    const boardTop = boardCenterY + BACKBOARD_HEIGHT / 2;
    const verticalHeight = boardTop + 0.15;

    // Main vertical pole
    const vertPole = new THREE.Mesh(
        new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS * 1.15, verticalHeight, 16),
        poleMat
    );
    vertPole.position.set(0, verticalHeight / 2, poleZ);
    vertPole.castShadow = true;
    assembly.add(vertPole);

    // Horizontal arm — connects pole top to the backboard center
    const armStartZ = poleZ;
    const armEndZ = backboardCenterZ;
    const armLength = Math.abs(armStartZ - armEndZ);
    const armY = boardTop + 0.05;

    const horizArm = new THREE.Mesh(
        new THREE.CylinderGeometry(POLE_RADIUS * 0.7, POLE_RADIUS * 0.8, armLength, 12),
        poleMat
    );
    horizArm.rotation.x = Math.PI / 2;
    horizArm.position.set(0, armY, (armStartZ + armEndZ) / 2);
    horizArm.castShadow = true;
    assembly.add(horizArm);

    // Diagonal brace — from partway up the pole to the arm midpoint
    const braceBottomY = armY - 1.5;
    const braceMidZ = (armStartZ + armEndZ) / 2;
    const braceDeltaY = armY - braceBottomY;
    const braceDeltaZ = braceMidZ - poleZ;
    const braceLength = Math.sqrt(braceDeltaY * braceDeltaY + braceDeltaZ * braceDeltaZ);
    const braceAngle = Math.atan2(braceDeltaZ, braceDeltaY);

    const brace = new THREE.Mesh(
        new THREE.CylinderGeometry(POLE_RADIUS * 0.35, POLE_RADIUS * 0.35, braceLength, 8),
        poleMat
    );
    brace.position.set(0, (armY + braceBottomY) / 2, (poleZ + braceMidZ) / 2);
    brace.rotation.x = braceAngle;
    brace.castShadow = true;
    assembly.add(brace);

    // Base plate
    const basePlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 0.08, 16),
        poleMat
    );
    basePlate.position.set(0, 0.04, poleZ);
    basePlate.castShadow = true;
    assembly.add(basePlate);

    // Bolts
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const bolt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.03, 6), poleMat
        );
        bolt.position.set(Math.cos(angle) * 0.28, 0.09, poleZ + Math.sin(angle) * 0.28);
        assembly.add(bolt);
    }

    // Safety padding on lower pole
    const paddingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const padding = new THREE.Mesh(
        new THREE.CylinderGeometry(POLE_RADIUS + 0.06, POLE_RADIUS + 0.06, 1.8, 12),
        paddingMat
    );
    padding.position.set(0, 1.5, poleZ);
    padding.castShadow = true;
    assembly.add(padding);
}

// ─── Backboard ──────────────────────────────────────────────
// NOT tagged as transparent helper — backboards should always be visible
function createBackboard(assembly, backboardCenterZ, backboardFaceZ, boardCenterY) {
    // Glass board
    const boardMat = new THREE.MeshPhysicalMaterial({
        color: 0xddeeff,
        roughness: 0.1,
        metalness: 0.0,
        transmission: 0.4,
        thickness: BACKBOARD_THICKNESS,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });

    const backboard = new THREE.Mesh(
        new THREE.BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_THICKNESS),
        boardMat
    );
    backboard.position.set(0, boardCenterY, backboardCenterZ);
    backboard.castShadow = true;
    assembly.add(backboard);

    // Metal frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.9 });
    const ft = 0.03;
    const fd = BACKBOARD_THICKNESS + 0.02;

    const frameParts = [
        [0, boardCenterY + BACKBOARD_HEIGHT / 2, BACKBOARD_WIDTH + ft * 2, ft, fd],
        [0, boardCenterY - BACKBOARD_HEIGHT / 2, BACKBOARD_WIDTH + ft * 2, ft, fd],
        [-BACKBOARD_WIDTH / 2, boardCenterY, ft, BACKBOARD_HEIGHT, fd],
        [BACKBOARD_WIDTH / 2, boardCenterY, ft, BACKBOARD_HEIGHT, fd],
    ];
    for (const [x, y, w, h, d] of frameParts) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        frame.position.set(x, y, backboardCenterZ);
        frame.castShadow = true;
        assembly.add(frame);
    }

    // Shooter's square (on the front face of the backboard)
    const sqW = 0.61, sqH = 0.46;
    const sqMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    const sqCY = RIM_HEIGHT + sqH / 2;
    const faceDist = BACKBOARD_THICKNESS / 2 + 0.003;

    // Draw the square outline on both faces
    for (const zOff of [faceDist, -faceDist]) {
        const z = backboardCenterZ + zOff;

        // Top
        const top = new THREE.Mesh(new THREE.PlaneGeometry(sqW, 0.015), sqMat);
        top.position.set(0, sqCY + sqH / 2, z);
        assembly.add(top);

        // Bottom
        const bot = new THREE.Mesh(new THREE.PlaneGeometry(sqW, 0.015), sqMat);
        bot.position.set(0, sqCY - sqH / 2, z);
        assembly.add(bot);

        // Left
        const left = new THREE.Mesh(new THREE.PlaneGeometry(0.015, sqH), sqMat);
        left.position.set(-sqW / 2, sqCY, z);
        assembly.add(left);

        // Right
        const right = new THREE.Mesh(new THREE.PlaneGeometry(0.015, sqH), sqMat);
        right.position.set(sqW / 2, sqCY, z);
        assembly.add(right);
    }
}

// ─── Rim & Bracket (properly connected to backboard) ────────
function createRimAndBracket(assembly, rimCenterZ, backboardFaceZ, side) {
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0xff4400, roughness: 0.4, metalness: 0.8,
        emissive: 0x331100, emissiveIntensity: 0.1
    });

    // Rim ring (torus, lying flat)
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(RIM_RADIUS, RIM_TUBE, 16, 32),
        rimMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, RIM_HEIGHT, rimCenterZ);
    rim.castShadow = true;
    assembly.add(rim);

    // Bracket / neck connecting rim to backboard
    // Goes from the back edge of the rim ring to the backboard face
    const rimBackEdge = rimCenterZ + side * RIM_RADIUS; // closest point of rim to board
    const neckStartZ = rimBackEdge;
    const neckEndZ = backboardFaceZ;
    const neckLength = Math.abs(neckEndZ - neckStartZ);
    const neckMidZ = (neckStartZ + neckEndZ) / 2;

    // Main neck bar
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(RIM_TUBE * 2, RIM_TUBE * 2, neckLength, 8),
        rimMat
    );
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, RIM_HEIGHT, neckMidZ);
    neck.castShadow = true;
    assembly.add(neck);

    // Mounting bracket plate (where neck meets backboard)
    const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.12, 0.04),
        rimMat
    );
    bracket.position.set(0, RIM_HEIGHT, backboardFaceZ);
    assembly.add(bracket);

    // Two support arms from bracket sides to rim sides (makes it look sturdy)
    for (const xOff of [-1, 1]) {
        const armStartX = xOff * 0.06;
        const armEndX = xOff * (RIM_RADIUS * 0.6);
        const armStartZ = backboardFaceZ;
        const armEndZ = rimCenterZ + side * (RIM_RADIUS * 0.3);
        const dx = armEndX - armStartX;
        const dz = armEndZ - armStartZ;
        const armLen = Math.sqrt(dx * dx + dz * dz);

        const supportArm = new THREE.Mesh(
            new THREE.CylinderGeometry(RIM_TUBE * 1.2, RIM_TUBE * 1.2, armLen, 6),
            rimMat
        );
        supportArm.position.set(
            (armStartX + armEndX) / 2,
            RIM_HEIGHT,
            (armStartZ + armEndZ) / 2
        );
        // Rotate to align
        const angleY = Math.atan2(dx, dz);
        supportArm.rotation.x = Math.PI / 2;
        supportArm.rotation.y = angleY;
        assembly.add(supportArm);
    }

    // Net attachment hooks around rim
    const hookMat = new THREE.MeshStandardMaterial({ color: 0xcc3300, roughness: 0.5, metalness: 0.8 });
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const hook = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.025, 4),
            hookMat
        );
        hook.position.set(
            Math.cos(angle) * RIM_RADIUS,
            RIM_HEIGHT - 0.013,
            rimCenterZ + Math.sin(angle) * RIM_RADIUS
        );
        assembly.add(hook);
    }
}

// ─── Net (proper diamond-pattern chain net) ─────────────────
// A real chain net forms a cone shape hanging from the rim with
// interlocking diamond patterns. We create it as a series of rings
// connected by diagonal links forming the diamond mesh pattern.
function createNet(assembly, rimCenterZ) {
    const netGroup = new THREE.Group();

    const chainMat = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        roughness: 0.25,
        metalness: 0.92,
    });

    const HOOKS = 12;          // attachment points on rim
    const ROWS = 10;           // vertical layers
    const NET_LENGTH = 0.45;   // total hang distance
    const TOP_RADIUS = RIM_RADIUS - 0.005;
    const BOTTOM_RADIUS = RIM_RADIUS * 0.65; // wide enough for a ball to drop through
    const LINK_RADIUS = 0.004; // thickness of each chain link

    // Build the node grid — each node is a position where links meet
    // Odd rows are offset by half a column (diamond pattern)
    const nodes = [];

    for (let row = 0; row <= ROWS; row++) {
        const t = row / ROWS;
        // Gentle taper — stays wide through the body, narrows gradually at bottom
        // Uses a curve that keeps the net open in the upper 2/3 then tapers
        const taper = t < 0.5 ? t * 0.3 : 0.15 + (t - 0.5) * 1.7 * 0.5;
        const radius = TOP_RADIUS + (BOTTOM_RADIUS - TOP_RADIUS) * Math.min(taper / 0.5, 1.0);
        const y = RIM_HEIGHT - t * NET_LENGTH;
        // Slight belly — net bows out in the upper-mid section
        const belly = Math.sin(t * Math.PI * 0.8) * 0.02;
        const r = radius + belly;

        const rowNodes = [];
        const offset = (row % 2 === 1) ? (Math.PI / HOOKS) : 0;

        for (let col = 0; col < HOOKS; col++) {
            const angle = (col / HOOKS) * Math.PI * 2 + offset;
            rowNodes.push({
                x: Math.cos(angle) * r,
                y: y,
                z: rimCenterZ + Math.sin(angle) * r,
                angle: angle
            });
        }
        nodes.push(rowNodes);
    }

    // Create links between adjacent nodes
    for (let row = 0; row < ROWS; row++) {
        const currentRow = nodes[row];
        const nextRow = nodes[row + 1];
        const isEvenRow = row % 2 === 0;

        for (let col = 0; col < HOOKS; col++) {
            const node = currentRow[col];

            // Diagonal link down-left
            const leftIdx = isEvenRow ? col : (col + HOOKS - 1) % HOOKS;
            const nodeDownLeft = nextRow[leftIdx];
            addChainLink(netGroup, node, nodeDownLeft, LINK_RADIUS, chainMat);

            // Diagonal link down-right
            const rightIdx = isEvenRow ? (col + 1) % HOOKS : col;
            const nodeDownRight = nextRow[rightIdx];
            addChainLink(netGroup, node, nodeDownRight, LINK_RADIUS, chainMat);
        }
    }

    // Bottom ring — small horizontal links around the bottom
    const bottomRow = nodes[ROWS];
    for (let col = 0; col < HOOKS; col++) {
        const a = bottomRow[col];
        const b = bottomRow[(col + 1) % HOOKS];
        addChainLink(netGroup, a, b, LINK_RADIUS * 0.8, chainMat);
    }

    assembly.add(netGroup);
}

function addChainLink(group, from, to, radius, material) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 0.001) return;

    const link = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, 4),
        material
    );

    // Position at midpoint
    link.position.set(
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
        (from.z + to.z) / 2
    );

    // Orient along the direction vector
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Use quaternion to align the cylinder (which points along Y by default)
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(up, dir);
    link.setRotationFromQuaternion(quat);

    group.add(link);
}
