import * as THREE from 'three';

const COURT_WIDTH = 15.24;
const COURT_LENGTH = 28.65;

export function createPark(scene) {
    const parkGroup = new THREE.Group();
    parkGroup.name = 'park';
    const parkColliders = [];

    createFencing(parkGroup, parkColliders);
    createTrees(parkGroup);
    createBenches(parkGroup, parkColliders);
    createTrashCans(parkGroup, parkColliders);
    createLampPosts(parkGroup);
    createPathways(parkGroup);
    createBleachers(parkGroup, parkColliders);
    createDrinkingFountain(parkGroup);
    createScatteredDetails(parkGroup);

    scene.userData.parkColliders = parkColliders;
    scene.add(parkGroup);
    return parkGroup;
}

// ─── Chain-Link Fence ───────────────────────────────────────
// Diamond-pattern chain-link texture between posts with gate openings
// behind each basketball hoop.
function createFencing(group, colliders) {
    const fenceHeight = 3.0;
    const padX = 4.5;
    const padZ = 6.0;
    const halfW = COURT_WIDTH / 2 + padX;
    const halfL = COURT_LENGTH / 2 + padZ;
    const gateWidth = 2.8;
    const panelThickness = 0.06;
    const panelEndPad = 0.05;
    const postColliderMap = new Map();

    function upsertPostCollider(x, z, radius, yMax) {
        const key = `${x.toFixed(3)}|${z.toFixed(3)}`;
        const existingIndex = postColliderMap.get(key);
        if (existingIndex !== undefined) {
            const existing = colliders[existingIndex];
            existing.radius = Math.max(existing.radius, radius);
            existing.yMax = Math.max(existing.yMax, yMax);
            return;
        }
        const collider = {
            type: 'cylinder',
            x,
            z,
            radius,
            yMin: 0,
            yMax
        };
        const idx = colliders.push(collider) - 1;
        postColliderMap.set(key, idx);
    }

    // Materials
    const fenceMat = new THREE.MeshStandardMaterial({
        color: 0x888888, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide
    });
    const gateMat = new THREE.MeshStandardMaterial({
        color: 0x666666, roughness: 0.4, metalness: 0.8
    });

    // Chain-link texture (separate color + alpha)
    const { colorTex, alphaTex } = createChainLinkTexture();
    const chainMat = new THREE.MeshStandardMaterial({
        map: colorTex,
        alphaMap: alphaTex,
        transparent: true,
        alphaTest: 0.3,
        roughness: 0.35,
        metalness: 0.85,
        color: 0x999999,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    // Define fence segments — each is [startX, startZ, endX, endZ]
    // We split the back and front sides to leave gate openings behind each hoop.
    // Gates are centered at x=0 on the back (Z negative) and front (Z positive) sides.
    const gateHalf = gateWidth / 2;

    const segments = [
        // Left side (full)
        [-halfW, -halfL, -halfW, halfL],
        // Right side (full)
        [halfW, -halfL, halfW, halfL],
        // Back side — split around gate at center
        [-halfW, -halfL, -gateHalf, -halfL],
        [gateHalf, -halfL, halfW, -halfL],
        // Front side — split around gate at center
        [-halfW, halfL, -gateHalf, halfL],
        [gateHalf, halfL, halfW, halfL],
    ];

    for (const [sx, sz, ex, ez] of segments) {
        const dx = ex - sx;
        const dz = ez - sz;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length < 0.5) continue;
        const angle = Math.atan2(dx, dz);
        const mx = (sx + ex) / 2;
        const mz = (sz + ez) / 2;

        // Chain-link panel (toggleable)
        const texRepeatX = length / 1.5;
        const texRepeatY = fenceHeight / 1.5;
        const panelGeo = new THREE.PlaneGeometry(length, fenceHeight);
        // Adjust UVs for tiling
        const uvAttr = panelGeo.attributes.uv;
        for (let i = 0; i < uvAttr.count; i++) {
            uvAttr.setX(i, uvAttr.getX(i) * texRepeatX);
            uvAttr.setY(i, uvAttr.getY(i) * texRepeatY);
        }

        const wire = new THREE.Mesh(panelGeo, chainMat);
        wire.position.set(mx, fenceHeight / 2, mz);
        wire.rotation.y = angle + Math.PI / 2;
        wire.castShadow = true;
        wire.userData.isTransparentHelper = true;
        group.add(wire);

        // Posts along this segment
        const postSpacing = 2.8;
        const postCount = Math.max(1, Math.round(length / postSpacing));
        for (let i = 0; i <= postCount; i++) {
            const t = i / postCount;
            const px = sx + dx * t;
            const pz = sz + dz * t;

            const post = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.04, fenceHeight + 0.2, 8),
                fenceMat
            );
            post.position.set(px, (fenceHeight + 0.2) / 2, pz);
            post.castShadow = true;
            group.add(post);
            upsertPostCollider(px, pz, 0.08, fenceHeight + 0.2);

            // Post cap
            const cap = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 8, 6),
                fenceMat
            );
            cap.position.set(px, fenceHeight + 0.22, pz);
            group.add(cap);
        }

        // Top rail
        const rail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, length, 8),
            fenceMat
        );
        rail.position.set(mx, fenceHeight + 0.05, mz);
        rail.rotation.set(0, angle + Math.PI / 2, Math.PI / 2);
        rail.castShadow = true;
        group.add(rail);

        // Bottom rail
        const bottomRail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, length, 8),
            fenceMat
        );
        bottomRail.position.set(mx, 0.1, mz);
        bottomRail.rotation.set(0, angle + Math.PI / 2, Math.PI / 2);
        group.add(bottomRail);

        // Physical fence panel collider (preserves gate openings via split segments).
        const xMin = Math.min(sx, ex);
        const xMax = Math.max(sx, ex);
        const zMin = Math.min(sz, ez);
        const zMax = Math.max(sz, ez);
        if (Math.abs(dx) < 1e-6) {
            // Vertical segment (constant X)
            colliders.push({
                type: 'aabb',
                minX: sx - panelThickness,
                maxX: sx + panelThickness,
                minZ: zMin - panelEndPad,
                maxZ: zMax + panelEndPad,
                yMin: 0,
                yMax: fenceHeight + 0.15
            });
        } else if (Math.abs(dz) < 1e-6) {
            // Horizontal segment (constant Z)
            colliders.push({
                type: 'aabb',
                minX: xMin - panelEndPad,
                maxX: xMax + panelEndPad,
                minZ: sz - panelThickness,
                maxZ: sz + panelThickness,
                yMin: 0,
                yMax: fenceHeight + 0.15
            });
        } else {
            // Fallback for non-axis-aligned segments.
            colliders.push({
                type: 'aabb',
                minX: xMin - panelThickness,
                maxX: xMax + panelThickness,
                minZ: zMin - panelThickness,
                maxZ: zMax + panelThickness,
                yMin: 0,
                yMax: fenceHeight + 0.15
            });
        }
    }

    // Gate posts (thicker, at each gate opening)
    const gateOpenings = [
        { x: 0, z: -halfL },  // back gate (behind hoop)
        { x: 0, z: halfL },   // front gate (behind hoop)
    ];

    for (const gate of gateOpenings) {
        for (const xOff of [-gateHalf, gateHalf]) {
            // Gate post
            const gp = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, fenceHeight + 0.3, 8),
                gateMat
            );
            gp.position.set(gate.x + xOff, (fenceHeight + 0.3) / 2, gate.z);
            gp.castShadow = true;
            group.add(gp);
            upsertPostCollider(gate.x + xOff, gate.z, 0.11, fenceHeight + 0.3);

            // Gate post cap
            const gc = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 6),
                gateMat
            );
            gc.position.set(gate.x + xOff, fenceHeight + 0.32, gate.z);
            group.add(gc);
        }

        // Gate top bar (horizontal between gate posts)
        const gateBar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, gateWidth, 8),
            gateMat
        );
        gateBar.position.set(gate.x, fenceHeight + 0.05, gate.z);
        gateBar.rotation.z = Math.PI / 2;
        group.add(gateBar);
    }
}

// Generate chain-link diamond pattern textures (color + alpha)
function createChainLinkTexture() {
    const size = 512;
    const cellSize = 40;   // diamond cell size in px
    const wireWidth = 4;   // thick enough to be clearly visible

    // ── Alpha texture (white wire on black background) ──────────
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = size;
    alphaCanvas.height = size;
    const actx = alphaCanvas.getContext('2d');

    actx.fillStyle = '#000';
    actx.fillRect(0, 0, size, size);

    actx.strokeStyle = '#ffffff';
    actx.lineWidth = wireWidth;
    actx.lineCap = 'round';

    // Diagonal lines  (\)
    for (let i = -size; i < size * 2; i += cellSize) {
        actx.beginPath();
        actx.moveTo(i, 0);
        actx.lineTo(i + size, size);
        actx.stroke();
    }
    // Diagonal lines  (/)
    for (let i = -size; i < size * 2; i += cellSize) {
        actx.beginPath();
        actx.moveTo(i, size);
        actx.lineTo(i + size, 0);
        actx.stroke();
    }
    // Thicken intersections
    actx.fillStyle = '#ffffff';
    for (let x = 0; x < size; x += cellSize / 2) {
        for (let y = 0; y < size; y += cellSize / 2) {
            actx.beginPath();
            actx.arc(x, y, wireWidth * 1.0, 0, Math.PI * 2);
            actx.fill();
        }
    }

    const alphaTex = new THREE.CanvasTexture(alphaCanvas);
    alphaTex.wrapS = THREE.RepeatWrapping;
    alphaTex.wrapT = THREE.RepeatWrapping;

    // ── Color texture (metallic wire look) ──────────────────────
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cctx = colorCanvas.getContext('2d');

    cctx.fillStyle = '#888888';
    cctx.fillRect(0, 0, size, size);

    // Draw lighter wire highlight
    cctx.strokeStyle = '#bbbbbb';
    cctx.lineWidth = wireWidth;
    cctx.lineCap = 'round';

    for (let i = -size; i < size * 2; i += cellSize) {
        cctx.beginPath();
        cctx.moveTo(i, 0);
        cctx.lineTo(i + size, size);
        cctx.stroke();
    }
    for (let i = -size; i < size * 2; i += cellSize) {
        cctx.beginPath();
        cctx.moveTo(i, size);
        cctx.lineTo(i + size, 0);
        cctx.stroke();
    }

    // Metallic sheen dots at intersections
    cctx.fillStyle = '#ccccdd';
    for (let x = 0; x < size; x += cellSize / 2) {
        for (let y = 0; y < size; y += cellSize / 2) {
            cctx.beginPath();
            cctx.arc(x, y, wireWidth * 1.0, 0, Math.PI * 2);
            cctx.fill();
        }
    }

    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.wrapS = THREE.RepeatWrapping;
    colorTex.wrapT = THREE.RepeatWrapping;

    return { colorTex, alphaTex };
}

// ─── Trees ──────────────────────────────────────────────────
function createTrees(group) {
    const treePositions = [
        // Surrounding the court at various distances
        [-18, 15], [-22, 5], [-20, -8], [-16, -18],
        [18, 12], [22, -3], [19, -15], [16, 20],
        [-25, 22], [25, -20], [-12, 28], [12, -28],
        // Deeper park trees
        [-30, 0], [30, 5], [-28, -25], [28, 25],
        [-35, 15], [35, -10], [-32, -15], [32, 18],
        [-15, 35], [15, -35], [0, 38], [0, -38],
        [-38, -5], [38, 8], [-25, 35], [25, -35],
        // Far background trees
        [-45, 20], [45, -15], [-40, -30], [40, 30],
        [-50, 0], [50, 5], [-20, 45], [20, -45],
    ];

    for (const [x, z] of treePositions) {
        const dist = Math.sqrt(x * x + z * z);
        const scale = 0.7 + Math.random() * 0.6;
        const treeType = Math.random();

        if (treeType < 0.5) {
            createDeciduousTree(group, x, z, scale);
        } else if (treeType < 0.8) {
            createOakTree(group, x, z, scale);
        } else {
            createPineTree(group, x, z, scale);
        }
    }
}

function createDeciduousTree(group, x, z, scale) {
    const trunkHeight = (3 + Math.random() * 2) * scale;
    const trunkMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.25 + Math.random() * 0.1, 0.15 + Math.random() * 0.05, 0.08),
        roughness: 0.95,
        metalness: 0.0
    });

    // Trunk
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * scale, 0.18 * scale, trunkHeight, 8),
        trunkMat
    );
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    group.add(trunk);

    // Canopy (multiple overlapping spheres for organic look)
    const leafColor = new THREE.Color(
        0.1 + Math.random() * 0.1,
        0.35 + Math.random() * 0.25,
        0.08 + Math.random() * 0.1
    );
    const leafMat = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.9,
        metalness: 0.0
    });

    const canopyY = trunkHeight + 0.5 * scale;
    const canopyRadius = (1.8 + Math.random() * 1.2) * scale;

    // Main canopy mass
    for (let i = 0; i < 5; i++) {
        const r = canopyRadius * (0.5 + Math.random() * 0.5);
        const offsetX = (Math.random() - 0.5) * canopyRadius * 0.6;
        const offsetY = (Math.random() - 0.3) * canopyRadius * 0.4;
        const offsetZ = (Math.random() - 0.5) * canopyRadius * 0.6;
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(r, 8, 8),
            leafMat
        );
        sphere.position.set(x + offsetX, canopyY + offsetY, z + offsetZ);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        sphere.userData.isLeaves = true;
        sphere.userData.leafSway = 0.5 + Math.random() * 1.5;
        group.add(sphere);
    }
}

function createOakTree(group, x, z, scale) {
    const trunkHeight = (4 + Math.random() * 3) * scale;
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.95
    });

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, trunkHeight, 8),
        trunkMat
    );
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    group.add(trunk);

    // Broader, flatter canopy
    const leafMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.12, 0.38 + Math.random() * 0.15, 0.1),
        roughness: 0.9
    });

    const canopyY = trunkHeight;
    const canopyRadius = (2.5 + Math.random() * 1.5) * scale;

    for (let i = 0; i < 7; i++) {
        const r = canopyRadius * (0.4 + Math.random() * 0.5);
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * canopyRadius * 0.5;
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(r, 8, 6),
            leafMat
        );
        sphere.scale.y = 0.6;
        sphere.position.set(
            x + Math.cos(angle) * dist,
            canopyY + Math.random() * canopyRadius * 0.3,
            z + Math.sin(angle) * dist
        );
        sphere.castShadow = true;
        sphere.userData.isLeaves = true;
        sphere.userData.leafSway = 0.3 + Math.random();
        group.add(sphere);
    }
}

function createPineTree(group, x, z, scale) {
    const trunkHeight = (2 + Math.random()) * scale;
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x3d2817,
        roughness: 0.95
    });

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * scale, 0.14 * scale, trunkHeight, 6),
        trunkMat
    );
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    group.add(trunk);

    const pineMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.06, 0.25 + Math.random() * 0.1, 0.08),
        roughness: 0.85
    });

    // Tiered cone canopy
    const tiers = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < tiers; i++) {
        const t = i / tiers;
        const tierRadius = (2.0 - t * 1.2) * scale;
        const tierHeight = 1.8 * scale;
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(tierRadius, tierHeight, 8),
            pineMat
        );
        cone.position.set(x, trunkHeight + i * tierHeight * 0.55, z);
        cone.castShadow = true;
        cone.userData.isLeaves = true;
        cone.userData.leafSway = 0.2 + Math.random() * 0.5;
        group.add(cone);
    }
}

// ─── Park Benches ───────────────────────────────────────────
function createBenches(group, colliders) {
    const benchPositions = [
        // Inside fence, on the blacktop edge, facing the court
        { x: -10.5, z: -6, rot: Math.PI / 2 },
        { x: -10.5, z: 0, rot: Math.PI / 2 },
        { x: -10.5, z: 6, rot: Math.PI / 2 },
        { x: 10.5, z: -6, rot: -Math.PI / 2 },
        { x: 10.5, z: 0, rot: -Math.PI / 2 },
        { x: 10.5, z: 6, rot: -Math.PI / 2 },
    ];

    for (const { x, z, rot } of benchPositions) {
        createBench(group, x, z, rot, colliders);
    }
}

function createBench(group, x, z, rotation, colliders) {
    const bench = new THREE.Group();

    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6b4226,
        roughness: 0.85,
        metalness: 0.0
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.4,
        metalness: 0.8
    });

    const seatWidth = 1.5;
    const seatDepth = 0.4;
    const seatHeight = 0.45;

    // Seat planks
    for (let i = 0; i < 4; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(seatWidth, 0.03, 0.08),
            woodMat
        );
        plank.position.set(0, seatHeight, -seatDepth / 2 + i * 0.12);
        plank.castShadow = true;
        bench.add(plank);
    }

    // Backrest planks
    for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(seatWidth, 0.03, 0.08),
            woodMat
        );
        plank.position.set(0, seatHeight + 0.15 + i * 0.12, -seatDepth / 2 - 0.02);
        plank.rotation.x = -0.15;
        plank.castShadow = true;
        bench.add(plank);
    }

    // Metal legs
    for (const xOff of [-seatWidth / 2 + 0.1, seatWidth / 2 - 0.1]) {
        // Front leg
        const frontLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, seatHeight, 0.04),
            metalMat
        );
        frontLeg.position.set(xOff, seatHeight / 2, seatDepth / 2 - 0.05);
        frontLeg.castShadow = true;
        bench.add(frontLeg);

        // Back leg
        const backLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, seatHeight + 0.4, 0.04),
            metalMat
        );
        backLeg.position.set(xOff, (seatHeight + 0.4) / 2, -seatDepth / 2);
        backLeg.castShadow = true;
        bench.add(backLeg);

        // Armrest
        const armrest = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.03, seatDepth + 0.05),
            metalMat
        );
        armrest.position.set(xOff, seatHeight + 0.25, 0);
        bench.add(armrest);
    }

    bench.position.set(x, 0, z);
    bench.rotation.y = rotation;
    group.add(bench);

    // Physical collider for bench body/legs so player cannot clip through.
    const benchW = 1.58;
    const benchD = 0.52;
    const c = Math.abs(Math.cos(rotation));
    const s = Math.abs(Math.sin(rotation));
    const halfX = c * (benchW / 2) + s * (benchD / 2) + 0.02;
    const halfZ = s * (benchW / 2) + c * (benchD / 2) + 0.02;
    colliders.push({
        type: 'aabb',
        minX: x - halfX,
        maxX: x + halfX,
        minZ: z - halfZ,
        maxZ: z + halfZ,
        yMin: 0,
        yMax: 1.15
    });
}

// ─── Trash Cans ─────────────────────────────────────────────
function createTrashCans(group, colliders) {
    const positions = [
        [-11, -10], [11, 12], [-11, 18], [11, -18]
    ];

    const canMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a2a,
        roughness: 0.7,
        metalness: 0.3
    });

    for (const [x, z] of positions) {
        const can = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.28, 0.9, 12),
            canMat
        );
        body.position.y = 0.45;
        body.castShadow = true;
        can.add(body);

        // Rim
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.3, 0.02, 8, 12),
            new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.9;
        can.add(rim);

        // Lid (dome)
        const lid = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3),
            canMat
        );
        lid.position.y = 0.92;
        can.add(lid);

        can.position.set(x, 0, z);
        group.add(can);

        // Physical cylinder collider for can + rim.
        colliders.push({
            type: 'cylinder',
            x,
            z,
            radius: 0.34,
            yMin: 0,
            yMax: 1.02
        });
    }
}

// ─── Lamp Posts ─────────────────────────────────────────────
function createLampPosts(group) {
    // Positions just outside the fence (halfW ~12.12)
    const positions = [
        { x: -13.5, z: -14, facing: 1 },
        { x: -13.5, z: 14, facing: 1 },
        { x: 13.5, z: -14, facing: -1 },
        { x: 13.5, z: 14, facing: -1 },
        // Extra lamps along the long sides
        { x: -13.5, z: 0, facing: 1 },
        { x: 13.5, z: 0, facing: -1 },
    ];

    const darkIronMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, roughness: 0.35, metalness: 0.85
    });
    const ironMat = new THREE.MeshStandardMaterial({
        color: 0x252525, roughness: 0.3, metalness: 0.9
    });
    const brassMat = new THREE.MeshStandardMaterial({
        color: 0x665533, roughness: 0.4, metalness: 0.7
    });

    for (const { x, z, facing } of positions) {
        const lamp = new THREE.Group();
        const poleH = 5.5;

        // ── Ornate base ──────────────────────────────────
        // Wide footing
        const footing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.35, 0.08, 8),
            darkIronMat
        );
        footing.position.y = 0.04;
        lamp.add(footing);

        // Base pedestal
        const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8),
            darkIronMat
        );
        pedestal.position.y = 0.18;
        lamp.add(pedestal);

        // Decorative ring above base
        const ring1 = new THREE.Mesh(
            new THREE.TorusGeometry(0.18, 0.025, 8, 16),
            ironMat
        );
        ring1.position.y = 0.32;
        ring1.rotation.x = Math.PI / 2;
        lamp.add(ring1);

        // Tapered lower section
        const lowerPole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.16, 0.6, 8),
            darkIronMat
        );
        lowerPole.position.y = 0.62;
        lamp.add(lowerPole);

        // Decorative mid-ring
        const ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.10, 0.02, 8, 16),
            ironMat
        );
        ring2.position.y = 0.95;
        ring2.rotation.x = Math.PI / 2;
        lamp.add(ring2);

        // ── Main pole shaft ──────────────────────────────
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.07, poleH - 1.0, 8),
            darkIronMat
        );
        shaft.position.y = 1.0 + (poleH - 1.0) / 2;
        shaft.castShadow = true;
        lamp.add(shaft);

        // Upper collar ring
        const ring3 = new THREE.Mesh(
            new THREE.TorusGeometry(0.07, 0.015, 8, 16),
            ironMat
        );
        ring3.position.y = poleH;
        ring3.rotation.x = Math.PI / 2;
        lamp.add(ring3);

        // ── Shepherd's crook / gooseneck arm ─────────────
        // Build curved arm from segments along an arc
        const armSegments = 10;
        const armLength = 1.4;
        const armCurve = 0.6;

        for (let i = 0; i < armSegments; i++) {
            const t = i / (armSegments - 1);
            // Parametric curve: starts horizontal, curves upward then down
            const ax = facing * t * armLength;
            const ay = poleH + armCurve * Math.sin(t * Math.PI) - t * 0.15;
            const seg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.03, armLength / armSegments + 0.02, 6),
                darkIronMat
            );

            // Angle each segment along the curve
            const nextT = Math.min(1, (i + 1) / (armSegments - 1));
            const nextAx = facing * nextT * armLength;
            const nextAy = poleH + armCurve * Math.sin(nextT * Math.PI) - nextT * 0.15;
            const segAngle = Math.atan2(nextAy - ay, (nextAx - ax) * facing);

            seg.position.set(ax, ay, 0);
            seg.rotation.z = -(Math.PI / 2 - segAngle) * facing;
            lamp.add(seg);
        }

        // Decorative scroll curl at the tip (small spiral flourish)
        const curlEnd = facing * armLength;
        const curlY = poleH + armCurve * Math.sin(Math.PI) - 0.15;
        for (let c = 0; c < 5; c++) {
            const ct = c / 4;
            const curlR = 0.12 * (1 - ct);
            const curlSeg = new THREE.Mesh(
                new THREE.SphereGeometry(0.018 - ct * 0.004, 6, 6),
                ironMat
            );
            curlSeg.position.set(
                curlEnd + facing * curlR * Math.cos(ct * Math.PI * 1.5),
                curlY - 0.1 - curlR * Math.sin(ct * Math.PI * 1.5),
                0
            );
            lamp.add(curlSeg);
        }

        // ── Lantern housing ──────────────────────────────
        const lanternX = curlEnd;
        const lanternY = curlY - 0.3;

        // Top cap (dome)
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            darkIronMat
        );
        cap.position.set(lanternX, lanternY + 0.22, 0);
        lamp.add(cap);

        // Finial on top
        const finial = new THREE.Mesh(
            new THREE.ConeGeometry(0.03, 0.1, 6),
            brassMat
        );
        finial.position.set(lanternX, lanternY + 0.38, 0);
        lamp.add(finial);

        // Lantern body (octagonal cage — using cylinder with 8 sides)
        const lanternBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.12, 0.3, 8, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                roughness: 0.3,
                metalness: 0.85,
                side: THREE.DoubleSide,
                wireframe: true
            })
        );
        lanternBody.position.set(lanternX, lanternY + 0.07, 0);
        lamp.add(lanternBody);

        // Lantern glass panels (translucent warm glow)
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xffeebb,
            emissive: 0xffeebb,
            emissiveIntensity: 0.3,
            roughness: 0.1,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
        });
        const glass = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.09, 0.26, 8),
            glassMat
        );
        glass.position.set(lanternX, lanternY + 0.07, 0);
        lamp.add(glass);

        // Glowing bulb inside
        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xffeebb,
            emissive: 0xffeebb,
            emissiveIntensity: 0.3,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9
        });
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 8),
            bulbMat
        );
        bulb.position.set(lanternX, lanternY + 0.07, 0);
        bulb.userData.isLampBulb = true;
        lamp.add(bulb);

        // Bottom ring of lantern
        const bottomRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.12, 0.015, 8, 16),
            darkIronMat
        );
        bottomRing.position.set(lanternX, lanternY - 0.08, 0);
        bottomRing.rotation.x = Math.PI / 2;
        lamp.add(bottomRing);

        // Small hanging finial at bottom
        const bottomFinial = new THREE.Mesh(
            new THREE.ConeGeometry(0.025, 0.08, 6),
            brassMat
        );
        bottomFinial.position.set(lanternX, lanternY - 0.16, 0);
        bottomFinial.rotation.x = Math.PI;
        lamp.add(bottomFinial);

        lamp.position.set(x, 0, z);
        lamp.castShadow = true;
        group.add(lamp);
    }
}

// ─── Pathways (looping paths around the court/park) ─────────
function createPathways(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9a8d7a';
    ctx.fillRect(0, 0, 256, 256);
    // Paver pattern
    ctx.strokeStyle = '#8a7d6a';
    ctx.lineWidth = 1;
    for (let row = 0; row < 16; row++) {
        const offset = row % 2 === 0 ? 0 : 16;
        for (let col = 0; col < 9; col++) {
            ctx.strokeRect(offset + col * 32, row * 16, 32, 16);
        }
    }
    for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${80 + Math.random() * 50}, ${75 + Math.random() * 45}, ${65 + Math.random() * 40}, 0.06)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random());
    }
    const pathTex = new THREE.CanvasTexture(canvas);
    pathTex.wrapS = THREE.RepeatWrapping;
    pathTex.wrapT = THREE.RepeatWrapping;
    pathTex.repeat.set(6, 6);

    const pathMat = new THREE.MeshStandardMaterial({
        map: pathTex,
        roughness: 0.88,
        metalness: 0.02,
        color: 0xa09080
    });

    const pathY = -0.005;

    // Main entrance path (south approach to gate)
    addPathSegment(group, pathMat, 0, pathY, COURT_LENGTH / 2 + 6 + 13, 2.8, 28);

    // Perimeter loop path around the court area
    const loopDist = 22; // distance from center for the loop
    // North segment
    addPathSegment(group, pathMat, 0, pathY, -loopDist, loopDist * 2 + 4, 2.2);
    // South segment
    addPathSegment(group, pathMat, 0, pathY, loopDist, loopDist * 2 + 4, 2.2);
    // East segment
    addPathSegment(group, pathMat, loopDist + 2, pathY, 0, 2.2, loopDist * 2);
    // West segment
    addPathSegment(group, pathMat, -(loopDist + 2), pathY, 0, 2.2, loopDist * 2);

    // Diagonal paths from corners to the court area
    const diagPaths = [
        { x: 30, z: 30, angle: -Math.PI / 4, len: 16 },
        { x: -30, z: 30, angle: Math.PI / 4, len: 16 },
        { x: 30, z: -30, angle: Math.PI / 4, len: 16 },
        { x: -30, z: -30, angle: -Math.PI / 4, len: 16 },
    ];
    for (const dp of diagPaths) {
        const diag = new THREE.Mesh(
            new THREE.PlaneGeometry(2.0, dp.len),
            pathMat
        );
        diag.rotation.x = -Math.PI / 2;
        diag.rotation.z = dp.angle;
        diag.position.set(dp.x, pathY, dp.z);
        diag.receiveShadow = true;
        group.add(diag);
    }

    // Connector paths from loop to sidewalks (4 cardinal exits)
    addPathSegment(group, pathMat, 0, pathY, -(loopDist + 18), 2.5, 15);  // north exit
    addPathSegment(group, pathMat, loopDist + 18, pathY, 0, 2.5, 15);     // east exit  (rotated via w/l)
    addPathSegment(group, pathMat, -(loopDist + 18), pathY, 0, 2.5, 15);  // west exit
}

function addPathSegment(group, mat, x, y, z, width, length) {
    const path = new THREE.Mesh(
        new THREE.PlaneGeometry(width, length),
        mat
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(x, y, z);
    path.receiveShadow = true;
    group.add(path);
}

// ─── Small Bleachers / Spectator Area ───────────────────────
function createBleachers(group, colliders) {
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.4,
        metalness: 0.8
    });

    function buildBleacher(rows, width) {
        const bleacher = new THREE.Group();
        for (let row = 0; row < rows; row++) {
            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.04, 0.3),
                metalMat
            );
            seat.position.set(0, 0.35 + row * 0.35, -row * 0.35);
            seat.castShadow = true;
            bleacher.add(seat);

            for (const xOff of [-width / 2 + 0.2, width / 2 - 0.2]) {
                const leg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, 0.35 + row * 0.35, 0.04),
                    metalMat
                );
                leg.position.set(xOff, (0.35 + row * 0.35) / 2, -row * 0.35);
                bleacher.add(leg);
            }

            if (row > 0) {
                const footRest = new THREE.Mesh(
                    new THREE.BoxGeometry(width, 0.03, 0.15),
                    metalMat
                );
                footRest.position.set(0, 0.15 + row * 0.35, -row * 0.35 + 0.15);
                bleacher.add(footRest);
            }
        }
        return bleacher;
    }

    // Bleacher placements outside the fence (fence halfW ~12.12, halfL ~20.33)
    const placements = [
        // Left side — two bleachers facing court
        { x: -14.5, z: -7, rotY: Math.PI / 2, rows: 3, width: 5 },
        { x: -14.5, z: 7, rotY: Math.PI / 2, rows: 3, width: 5 },
        // Right side — two bleachers facing court
        { x: 14.5, z: -7, rotY: -Math.PI / 2, rows: 3, width: 5 },
        { x: 14.5, z: 7, rotY: -Math.PI / 2, rows: 3, width: 5 },
        // Behind each hoop — smaller bleachers
        { x: -5, z: -22.5, rotY: 0, rows: 2, width: 4 },
        { x: 5, z: -22.5, rotY: 0, rows: 2, width: 4 },
        { x: -5, z: 22.5, rotY: Math.PI, rows: 2, width: 4 },
        { x: 5, z: 22.5, rotY: Math.PI, rows: 2, width: 4 },
    ];

    for (const p of placements) {
        const b = buildBleacher(p.rows, p.width);
        b.position.set(p.x, 0, p.z);
        b.rotation.y = p.rotY;
        group.add(b);

        // Physical collider footprint for each bleacher block.
        // Depth follows generated row layout: front seat + stepped rows.
        const depth = 0.30 + (p.rows - 1) * 0.35 + 0.18;
        const height = 0.35 + (p.rows - 1) * 0.35 + 0.45;
        const c = Math.abs(Math.cos(p.rotY));
        const s = Math.abs(Math.sin(p.rotY));
        const halfX = c * (p.width / 2) + s * (depth / 2) + 0.04;
        const halfZ = s * (p.width / 2) + c * (depth / 2) + 0.04;

        colliders.push({
            type: 'aabb',
            minX: p.x - halfX,
            maxX: p.x + halfX,
            minZ: p.z - halfZ,
            maxZ: p.z + halfZ,
            yMin: 0,
            yMax: height
        });
    }
}

// ─── Drinking Fountain ──────────────────────────────────────
function createDrinkingFountain(group) {
    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.1
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.3,
        metalness: 0.9
    });

    const fountain = new THREE.Group();

    // Pedestal
    const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.85, 8),
        stoneMat
    );
    pedestal.position.y = 0.425;
    pedestal.castShadow = true;
    fountain.add(pedestal);

    // Basin
    const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.2, 0.1, 8),
        stoneMat
    );
    basin.position.y = 0.9;
    fountain.add(basin);

    // Spout
    const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6),
        metalMat
    );
    spout.rotation.z = Math.PI / 4;
    spout.position.set(0.05, 0.98, 0);
    fountain.add(spout);

    fountain.position.set(COURT_WIDTH / 2 + 6, 0, -5);
    group.add(fountain);
}

// ─── Scattered Details (leaves, pebbles, etc.) ─────────────
function createScatteredDetails(group) {
    // Scattered leaves near trees
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x5a7a3a,
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    const dryLeafMat = new THREE.MeshStandardMaterial({
        color: 0x8b6914,
        roughness: 0.9,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 40;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        const leaf = new THREE.Mesh(
            new THREE.CircleGeometry(0.05 + Math.random() * 0.08, 5),
            Math.random() > 0.5 ? leafMat : dryLeafMat
        );
        leaf.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        leaf.rotation.z = Math.random() * Math.PI * 2;
        leaf.position.set(x, 0.01, z);
        group.add(leaf);
    }

    // Small rocks / pebbles near court edges
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x777777,
        roughness: 0.95
    });

    for (let i = 0; i < 20; i++) {
        const x = (Math.random() - 0.5) * 25;
        const z = (Math.random() - 0.5) * 40;
        // Only place outside court area
        if (Math.abs(x) > COURT_WIDTH / 2 + 2 || Math.abs(z) > COURT_LENGTH / 2 + 3) {
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.05 + Math.random() * 0.1, 0),
                rockMat
            );
            rock.position.set(x, 0.03, z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            group.add(rock);
        }
    }
}
