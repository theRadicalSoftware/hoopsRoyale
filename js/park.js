import * as THREE from 'three';

const COURT_WIDTH = 15.24;
const COURT_LENGTH = 28.65;
const FENCE_PAD_X = 4.5;
const FENCE_PAD_Z = 6.0;
const FENCE_HALF_W = COURT_WIDTH / 2 + FENCE_PAD_X;
const FENCE_HALF_L = COURT_LENGTH / 2 + FENCE_PAD_Z;

export function createPark(scene) {
    const parkGroup = new THREE.Group();
    parkGroup.name = 'park';
    const parkColliders = [];
    const parkSeats = [];

    createFencing(parkGroup, parkColliders);
    createTrees(parkGroup, parkColliders);
    createBenches(parkGroup, parkColliders, parkSeats);
    createTrashCans(parkGroup, parkColliders);
    createLampPosts(parkGroup, parkColliders);
    createPathways(parkGroup);
    createPerimeterPlantingBeds(parkGroup, parkColliders);
    createBleachers(parkGroup, parkColliders, parkSeats);
    createDrinkingFountain(parkGroup);
    createPavilion(parkGroup, parkColliders);
    createPond(parkGroup, parkColliders);
    createScatteredDetails(parkGroup);

    scene.userData.parkColliders = parkColliders;
    scene.userData.parkSeats = parkSeats;
    scene.add(parkGroup);
    return parkGroup;
}

// ─── Chain-Link Fence ───────────────────────────────────────
// Diamond-pattern chain-link texture between posts with gate openings
// behind each basketball hoop.
function createFencing(group, colliders) {
    const fenceHeight = 3.0;
    const halfW = FENCE_HALF_W;
    const halfL = FENCE_HALF_L;
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
function createTrees(group, colliders) {
    const treePositions = [
        // Immediate park perimeter (outside fence)
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

    // Fill out the skyline edge with a ring of additional trees.
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const radius = 44 + stableNoise2D(Math.cos(angle) * 9, Math.sin(angle) * 9, 2.6) * 9;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        treePositions.push([x, z]);
    }

    const palette = createTreePalette();

    for (const [x, z] of treePositions) {
        if (!isOutsideFenceArea(x, z, 1.2)) continue;

        const scale = 0.75 + stableNoise2D(x, z, 5.1) * 0.7;
        const treeTypeRoll = stableNoise2D(x, z, 11.7);

        if (treeTypeRoll < 0.45) {
            createDeciduousTree(group, x, z, scale, palette);
        } else if (treeTypeRoll < 0.8) {
            createOakTree(group, x, z, scale, palette);
        } else {
            createPineTree(group, x, z, scale, palette);
        }

        // Add trunk collider for nearby trees (skip distant skyline trees)
        const distSq = x * x + z * z;
        if (distSq < 48 * 48) {
            const trunkRadius = (treeTypeRoll < 0.45 ? 0.18 : treeTypeRoll < 0.8 ? 0.23 : 0.14) * scale;
            const trunkH = (treeTypeRoll < 0.45 ? 3.2 : treeTypeRoll < 0.8 ? 3.8 : 2.2) * scale;
            colliders.push({ type: 'cylinder', x, z, radius: Math.max(trunkRadius, 0.15), yMin: 0, yMax: trunkH });
        }
    }
}

function createTreePalette() {
    return {
        trunkMats: [
            new THREE.MeshStandardMaterial({ color: 0x4f3724, roughness: 0.95, metalness: 0.01 }),
            new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.95, metalness: 0.01 }),
            new THREE.MeshStandardMaterial({ color: 0x46301f, roughness: 0.96, metalness: 0.0 }),
        ],
        branchMat: new THREE.MeshStandardMaterial({ color: 0x4b331f, roughness: 0.95, metalness: 0.0 }),
        mulchMat: new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.95, metalness: 0.0 }),
        deciduousLeafMats: [
            new THREE.MeshStandardMaterial({ color: 0x6dbf67, roughness: 0.88, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x79c977, roughness: 0.88, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x5ea95a, roughness: 0.9, metalness: 0.0 }),
        ],
        oakLeafMats: [
            new THREE.MeshStandardMaterial({ color: 0x5ca95b, roughness: 0.9, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x4f9850, roughness: 0.91, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x74b86f, roughness: 0.9, metalness: 0.0 }),
        ],
        pineLeafMats: [
            new THREE.MeshStandardMaterial({ color: 0x3d7a45, roughness: 0.9, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x2f6a3d, roughness: 0.9, metalness: 0.0 }),
            new THREE.MeshStandardMaterial({ color: 0x4b8753, roughness: 0.89, metalness: 0.0 }),
        ],
        trunkGeo: new THREE.CylinderGeometry(0.1, 0.18, 1, 8),
        oakTrunkGeo: new THREE.CylinderGeometry(0.12, 0.23, 1, 8),
        pineTrunkGeo: new THREE.CylinderGeometry(0.08, 0.14, 1, 7),
        branchGeo: new THREE.CylinderGeometry(0.035, 0.06, 1, 6),
        canopySphereGeo: new THREE.SphereGeometry(1, 8, 7),
        canopyChunkGeo: new THREE.IcosahedronGeometry(1, 0),
        pineTierGeo: new THREE.ConeGeometry(1, 1, 8),
        mulchGeo: new THREE.CylinderGeometry(1.0, 1.1, 0.05, 10),
    };
}

function createDeciduousTree(group, x, z, scale, palette) {
    const trunkHeight = (3.2 + stableNoise2D(x, z, 1.3) * 1.8) * scale;
    const trunkMat = pickDeterministic(palette.trunkMats, x, z, 0.8);
    const leafMat = pickDeterministic(palette.deciduousLeafMats, x, z, 3.1);

    const trunk = new THREE.Mesh(palette.trunkGeo, trunkMat);
    trunk.scale.set(1, trunkHeight, 1);
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const branchCount = 2 + Math.floor(stableNoise2D(x, z, 4.7) * 2);
    for (let i = 0; i < branchCount; i++) {
        const t = i / Math.max(1, branchCount - 1);
        const branch = new THREE.Mesh(palette.branchGeo, palette.branchMat);
        const yaw = stableNoise2D(x + i * 2.1, z - i * 1.7, 6.2) * Math.PI * 2;
        const pitch = 0.45 + stableNoise2D(x, z, 7.8 + i) * 0.35;
        const length = (0.8 + stableNoise2D(x, z, 9.5 + i) * 0.45) * scale;
        branch.scale.set(0.7, length, 0.7);
        branch.position.set(
            x + Math.cos(yaw) * 0.25 * scale,
            trunkHeight * (0.55 + t * 0.18),
            z + Math.sin(yaw) * 0.25 * scale
        );
        branch.rotation.set(0, yaw, pitch);
        branch.castShadow = true;
        group.add(branch);
    }

    const canopyY = trunkHeight + 0.45 * scale;
    const canopyRadius = (1.9 + stableNoise2D(x, z, 12.2) * 1.2) * scale;
    const blobs = 6 + Math.floor(stableNoise2D(x, z, 14.1) * 2);
    for (let i = 0; i < blobs; i++) {
        const n = stableNoise2D(x + i * 3.1, z - i * 4.4, 15.3);
        const angle = n * Math.PI * 2;
        const offsetDist = canopyRadius * (0.1 + n * 0.35);
        const blob = new THREE.Mesh(
            i % 2 === 0 ? palette.canopySphereGeo : palette.canopyChunkGeo,
            leafMat
        );
        const blobScale = canopyRadius * (0.42 + n * 0.28);
        blob.scale.set(blobScale, blobScale * (0.78 + n * 0.25), blobScale);
        blob.position.set(
            x + Math.cos(angle) * offsetDist,
            canopyY + (n - 0.4) * canopyRadius * 0.32,
            z + Math.sin(angle) * offsetDist
        );
        blob.castShadow = true;
        blob.receiveShadow = true;
        blob.userData.isLeaves = true;
        blob.userData.leafSway = 0.35 + n * 1.1;
        group.add(blob);
    }

    const mulch = new THREE.Mesh(palette.mulchGeo, palette.mulchMat);
    mulch.position.set(x, 0.02, z);
    mulch.scale.set(0.8 * scale, 1, 0.8 * scale);
    mulch.receiveShadow = true;
    group.add(mulch);
}

function createOakTree(group, x, z, scale, palette) {
    const trunkHeight = (3.8 + stableNoise2D(x, z, 17.6) * 2.4) * scale;
    const trunkMat = pickDeterministic(palette.trunkMats, x, z, 19.4);
    const leafMat = pickDeterministic(palette.oakLeafMats, x, z, 20.9);

    const trunk = new THREE.Mesh(palette.oakTrunkGeo, trunkMat);
    trunk.scale.set(1.05, trunkHeight, 1.05);
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Secondary trunk creates a fuller oak silhouette.
    const trunk2 = new THREE.Mesh(palette.branchGeo, trunkMat);
    trunk2.scale.set(1.2, 1.4 * scale, 1.2);
    trunk2.position.set(x + 0.35 * scale, trunkHeight * 0.68, z - 0.2 * scale);
    trunk2.rotation.set(0.18, 0.8, 0.35);
    trunk2.castShadow = true;
    group.add(trunk2);

    const canopyY = trunkHeight + 0.2 * scale;
    const canopyRadius = (2.4 + stableNoise2D(x, z, 23.1) * 1.3) * scale;
    const blobs = 8 + Math.floor(stableNoise2D(x, z, 25.2) * 3);
    for (let i = 0; i < blobs; i++) {
        const n = stableNoise2D(x + i * 2.7, z - i * 3.2, 26.4);
        const angle = n * Math.PI * 2;
        const dist = canopyRadius * (0.05 + n * 0.45);
        const blob = new THREE.Mesh(palette.canopyChunkGeo, leafMat);
        const blobScale = canopyRadius * (0.36 + n * 0.24);
        blob.scale.set(blobScale, blobScale * 0.62, blobScale);
        blob.position.set(
            x + Math.cos(angle) * dist,
            canopyY + (n - 0.5) * canopyRadius * 0.2,
            z + Math.sin(angle) * dist
        );
        blob.castShadow = true;
        blob.userData.isLeaves = true;
        blob.userData.leafSway = 0.25 + n * 0.9;
        group.add(blob);
    }

    const mulch = new THREE.Mesh(palette.mulchGeo, palette.mulchMat);
    mulch.position.set(x, 0.02, z);
    mulch.scale.set(0.92 * scale, 1, 0.92 * scale);
    mulch.receiveShadow = true;
    group.add(mulch);
}

function createPineTree(group, x, z, scale, palette) {
    const trunkHeight = (2.2 + stableNoise2D(x, z, 29.8) * 1.3) * scale;
    const trunkMat = pickDeterministic(palette.trunkMats, x, z, 31.6);
    const leafMat = pickDeterministic(palette.pineLeafMats, x, z, 33.2);

    const trunk = new THREE.Mesh(palette.pineTrunkGeo, trunkMat);
    trunk.scale.set(1, trunkHeight, 1);
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const tiers = 3 + Math.floor(stableNoise2D(x, z, 35.4) * 2);
    const tierHeight = (1.5 + stableNoise2D(x, z, 36.9) * 0.4) * scale;
    for (let i = 0; i < tiers; i++) {
        const t = i / Math.max(1, tiers - 1);
        const radius = (1.9 - t * 1.15) * scale;
        const cone = new THREE.Mesh(palette.pineTierGeo, leafMat);
        cone.scale.set(radius, tierHeight, radius);
        cone.position.set(x, trunkHeight + i * tierHeight * 0.53, z);
        cone.castShadow = true;
        cone.userData.isLeaves = true;
        cone.userData.leafSway = 0.18 + t * 0.3;
        group.add(cone);
    }

    const topCone = new THREE.Mesh(palette.pineTierGeo, leafMat);
    topCone.scale.set(0.45 * scale, 0.7 * scale, 0.45 * scale);
    topCone.position.set(x, trunkHeight + tiers * tierHeight * 0.5 + 0.35 * scale, z);
    topCone.castShadow = true;
    topCone.userData.isLeaves = true;
    topCone.userData.leafSway = 0.3;
    group.add(topCone);
}

function pickDeterministic(items, x, z, seed) {
    const idx = Math.floor(stableNoise2D(x, z, seed) * items.length) % items.length;
    return items[idx];
}

function stableNoise2D(x, z, seed = 0) {
    const n = Math.sin((x + seed * 11.73) * 12.9898 + (z - seed * 7.19) * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

function isOutsideFenceArea(x, z, buffer = 0) {
    return Math.abs(x) > FENCE_HALF_W + buffer || Math.abs(z) > FENCE_HALF_L + buffer;
}

// ─── Park Benches ───────────────────────────────────────────
function createBenches(group, colliders, seats) {
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
        createBench(group, x, z, rot, colliders, seats);
    }
}

function createBench(group, x, z, rotation, colliders, seats) {
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

    // Sit anchors (two spots per bench)
    const seatOffsets = [-0.45, 0.45];
    const seatLocalZ = 0.02;
    const seatY = seatHeight + 0.02;
    for (const localX of seatOffsets) {
        const worldX = x + localX * Math.cos(rotation) + seatLocalZ * Math.sin(rotation);
        const worldZ = z - localX * Math.sin(rotation) + seatLocalZ * Math.cos(rotation);
        seats.push({
            type: 'bench',
            x: worldX,
            y: seatY,
            z: worldZ,
            facing: rotation
        });
    }
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
function createLampPosts(group, colliders) {
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

        // Lamp post pole collider (base is ~0.35 radius, pole shaft is ~0.06)
        colliders.push({ type: 'cylinder', x, z, radius: 0.3, yMin: 0, yMax: 5.5 });
    }
}

// ─── Perimeter Planting Beds (outside fence) ─────────────────
function createPerimeterPlantingBeds(group, colliders) {
    const bedMat = new THREE.MeshStandardMaterial({
        color: 0x456739,
        roughness: 0.95,
        metalness: 0.0
    });
    const mulchMat = new THREE.MeshStandardMaterial({
        color: 0x5a4329,
        roughness: 0.93,
        metalness: 0.0
    });
    const shrubMats = [
        new THREE.MeshStandardMaterial({ color: 0x6fb062, roughness: 0.88, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ color: 0x5f9f54, roughness: 0.9, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ color: 0x7cbf72, roughness: 0.88, metalness: 0.0 }),
    ];
    const flowerMats = [
        new THREE.MeshStandardMaterial({ color: 0xffd86b, roughness: 0.75 }),
        new THREE.MeshStandardMaterial({ color: 0xff9f7f, roughness: 0.75 }),
        new THREE.MeshStandardMaterial({ color: 0xbfdfff, roughness: 0.75 }),
    ];

    const bedGeo = new THREE.CircleGeometry(1, 16);
    const shrubGeo = new THREE.IcosahedronGeometry(0.38, 0);
    const flowerGeo = new THREE.SphereGeometry(0.07, 6, 5);

    const beds = [
        { x: -31, z: -13, rx: 3.8, rz: 2.1, rot: 0.35, shrubs: 6 },
        { x: -29, z: 16, rx: 4.0, rz: 2.3, rot: -0.15, shrubs: 6 },
        { x: 30, z: -15, rx: 3.7, rz: 2.2, rot: 0.2, shrubs: 6 },
        { x: 28, z: 15, rx: 3.9, rz: 2.2, rot: -0.4, shrubs: 6 },
        { x: -8, z: -33, rx: 4.4, rz: 2.1, rot: 0.05, shrubs: 7 },
        { x: 9, z: -33, rx: 4.2, rz: 2.0, rot: -0.15, shrubs: 7 },
        { x: -7, z: 33, rx: 4.2, rz: 2.2, rot: -0.08, shrubs: 7 },
        { x: 8, z: 33, rx: 4.4, rz: 2.1, rot: 0.1, shrubs: 7 },
    ];

    for (const bed of beds) {
        if (!isOutsideFenceArea(bed.x, bed.z, 2.5)) continue;

        const grassInset = new THREE.Mesh(bedGeo, bedMat);
        grassInset.rotation.x = -Math.PI / 2;
        grassInset.rotation.z = bed.rot;
        grassInset.position.set(bed.x, 0.006, bed.z);
        grassInset.scale.set(bed.rx, bed.rz, 1);
        grassInset.receiveShadow = true;
        group.add(grassInset);

        const mulch = new THREE.Mesh(bedGeo, mulchMat);
        mulch.rotation.x = -Math.PI / 2;
        mulch.rotation.z = bed.rot;
        mulch.position.set(bed.x, 0.012, bed.z);
        mulch.scale.set(bed.rx * 0.75, bed.rz * 0.75, 1);
        mulch.receiveShadow = true;
        group.add(mulch);

        // Planting bed collider — ellipse approximated as AABB
        const bedR = Math.max(bed.rx, bed.rz) * 0.65;
        colliders.push({
            type: 'aabb',
            minX: bed.x - bedR, maxX: bed.x + bedR,
            minZ: bed.z - bedR, maxZ: bed.z + bedR,
            yMin: 0, yMax: 1.2
        });

        for (let i = 0; i < bed.shrubs; i++) {
            const n = stableNoise2D(bed.x + i * 3.7, bed.z - i * 2.9, 40.4);
            const angle = n * Math.PI * 2;
            const localR = 0.25 + n * 0.55;
            const localX = Math.cos(angle) * bed.rx * localR * 0.7;
            const localZ = Math.sin(angle) * bed.rz * localR * 0.7;
            const px = bed.x + localX * Math.cos(bed.rot) - localZ * Math.sin(bed.rot);
            const pz = bed.z + localX * Math.sin(bed.rot) + localZ * Math.cos(bed.rot);
            if (!isOutsideFenceArea(px, pz, 1.5)) continue;

            const shrub = new THREE.Mesh(shrubGeo, shrubMats[i % shrubMats.length]);
            const shrubScale = 0.55 + n * 0.55;
            shrub.scale.set(shrubScale, shrubScale * (0.85 + n * 0.3), shrubScale);
            shrub.position.set(px, 0.28 + shrubScale * 0.08, pz);
            shrub.castShadow = true;
            shrub.receiveShadow = true;
            shrub.userData.isLeaves = true;
            shrub.userData.leafSway = 0.08 + n * 0.18;
            group.add(shrub);

            if (n > 0.62) {
                const flower = new THREE.Mesh(flowerGeo, flowerMats[i % flowerMats.length]);
                flower.position.set(px + (n - 0.5) * 0.25, 0.42 + n * 0.12, pz + (0.5 - n) * 0.2);
                flower.castShadow = true;
                group.add(flower);
            }
        }
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

    // Main entrance paths (approaches to both gates)
    addPathSegment(group, pathMat, 0, pathY, COURT_LENGTH / 2 + 6 + 13, 2.8, 28); // south gate
    addPathSegment(group, pathMat, 0, pathY, -(COURT_LENGTH / 2 + 6 + 13), 2.8, 28); // north gate

    // ── Primary perimeter loop (rectangular, around court) ──
    const loopDist = 22;
    // North segment
    addPathSegment(group, pathMat, 0, pathY, -loopDist, loopDist * 2 + 4, 2.4);
    // South segment
    addPathSegment(group, pathMat, 0, pathY, loopDist, loopDist * 2 + 4, 2.4);
    // East segment
    addPathSegment(group, pathMat, loopDist + 2, pathY, 0, 2.4, loopDist * 2);
    // West segment
    addPathSegment(group, pathMat, -(loopDist + 2), pathY, 0, 2.4, loopDist * 2);

    // ── Outer ring path (connects to features and sidewalks) ──
    const outerDist = 38;
    addPathSegment(group, pathMat, 0, pathY, -outerDist, outerDist * 2 + 4, 2.0);
    addPathSegment(group, pathMat, 0, pathY, outerDist, outerDist * 2 + 4, 2.0);
    addPathSegment(group, pathMat, outerDist + 2, pathY, 0, 2.0, outerDist * 2);
    addPathSegment(group, pathMat, -(outerDist + 2), pathY, 0, 2.0, outerDist * 2);

    // ── Spokes connecting inner loop to outer ring (8 directions) ──
    // Cardinal spokes
    addPathSegment(group, pathMat, 0, pathY, -(loopDist + 8), 2.0, 16);     // north
    addPathSegment(group, pathMat, 0, pathY, loopDist + 8, 2.0, 16);        // south
    addPathSegment(group, pathMat, loopDist + 10, pathY, 0, 2.0, 16);       // east
    addPathSegment(group, pathMat, -(loopDist + 10), pathY, 0, 2.0, 16);    // west

    // Diagonal paths connecting inner loop corners to outer ring
    const diagPaths = [
        { x: 30, z: 30, angle: -Math.PI / 4, len: 18 },
        { x: -30, z: 30, angle: Math.PI / 4, len: 18 },
        { x: 30, z: -30, angle: Math.PI / 4, len: 18 },
        { x: -30, z: -30, angle: -Math.PI / 4, len: 18 },
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

    // ── Feature connector paths ──
    // Path from outer ring to pavilion (northwest, at -32, -30)
    addPathSegment(group, pathMat, -32, pathY, -34, 2.0, 8);    // spur heading to pavilion
    addPathSegment(group, pathMat, -37, pathY, -30, 2.0, 10);   // west approach

    // Path from outer ring to pond (southeast, at 30, 30)
    addPathSegment(group, pathMat, 30, pathY, 34, 2.0, 8);      // spur heading to pond area
    addPathSegment(group, pathMat, 35, pathY, 30, 2.0, 10);     // east approach

    // ── Sidewalk connectors (outer ring to sidewalks, 4 cardinal exits) ──
    addPathSegment(group, pathMat, 0, pathY, -(outerDist + 10), 2.5, 14);   // north exit
    addPathSegment(group, pathMat, 0, pathY, outerDist + 10, 2.5, 14);      // south exit
    addPathSegment(group, pathMat, outerDist + 10, pathY, 0, 2.5, 14);      // east exit
    addPathSegment(group, pathMat, -(outerDist + 10), pathY, 0, 2.5, 14);   // west exit
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
function createBleachers(group, colliders, seats) {
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

        // Sit anchors (front row spots)
        const seatLocalY = 0.35 + 0.04;
        const seatLocalZ = 0.03;
        const seatOffsets = p.width >= 5 ? [-1.0, 1.0] : [-0.6, 0.6];
        for (const localX of seatOffsets) {
            const worldX = p.x + localX * Math.cos(p.rotY) + seatLocalZ * Math.sin(p.rotY);
            const worldZ = p.z - localX * Math.sin(p.rotY) + seatLocalZ * Math.cos(p.rotY);
            seats.push({
                type: 'bleacher',
                x: worldX,
                y: seatLocalY,
                z: worldZ,
                facing: p.rotY
            });
        }
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

// ─── Park Pavilion ────────────────────────────────────────────
// Open-air shelter with stone columns, wooden roof, and seating area.
// Positioned in the northwest quadrant between the path loop and sidewalks.
function createPavilion(group, colliders) {
    const pavGroup = new THREE.Group();
    const cx = -32, cz = -30; // pavilion center

    // Shared materials
    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x8a8278, roughness: 0.85, metalness: 0.05
    });
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6b4a2e, roughness: 0.82, metalness: 0.02
    });
    const roofMat = new THREE.MeshStandardMaterial({
        color: 0x5a3d22, roughness: 0.78, metalness: 0.04
    });
    const metalTrimMat = new THREE.MeshStandardMaterial({
        color: 0x444444, roughness: 0.35, metalness: 0.8
    });

    // ── Stone foundation (octagonal raised platform) ──
    const platformRadius = 4.8;
    const platformHeight = 0.18;
    const platformGeo = new THREE.CylinderGeometry(platformRadius, platformRadius + 0.15, platformHeight, 8);
    const platform = new THREE.Mesh(platformGeo, stoneMat);
    platform.position.set(cx, platformHeight / 2, cz);
    platform.receiveShadow = true;
    platform.castShadow = true;
    pavGroup.add(platform);

    // Platform edge trim
    const edgeGeo = new THREE.TorusGeometry(platformRadius + 0.05, 0.06, 6, 8);
    const edge = new THREE.Mesh(edgeGeo, metalTrimMat);
    edge.rotation.x = Math.PI / 2;
    edge.position.set(cx, platformHeight, cz);
    pavGroup.add(edge);

    // ── Columns (8 stone pillars around the perimeter) ──
    const columnCount = 8;
    const columnRadius = 0.18;
    const columnHeight = 3.2;
    const columnRing = platformRadius - 0.5;
    const colGeo = new THREE.CylinderGeometry(columnRadius, columnRadius + 0.04, columnHeight, 10);
    const capGeo = new THREE.CylinderGeometry(columnRadius + 0.12, columnRadius + 0.04, 0.12, 10);
    const baseGeo = new THREE.CylinderGeometry(columnRadius + 0.06, columnRadius + 0.14, 0.2, 10);

    for (let i = 0; i < columnCount; i++) {
        const angle = (i / columnCount) * Math.PI * 2;
        const px = cx + Math.cos(angle) * columnRing;
        const pz = cz + Math.sin(angle) * columnRing;

        // Column shaft
        const col = new THREE.Mesh(colGeo, stoneMat);
        col.position.set(px, platformHeight + columnHeight / 2, pz);
        col.castShadow = true;
        pavGroup.add(col);

        // Column capital (top)
        const cap = new THREE.Mesh(capGeo, stoneMat);
        cap.position.set(px, platformHeight + columnHeight + 0.06, pz);
        pavGroup.add(cap);

        // Column base
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.set(px, platformHeight + 0.1, pz);
        pavGroup.add(base);

        // Column collider
        colliders.push({
            type: 'cylinder', x: px, z: pz,
            radius: columnRadius + 0.1, yMin: 0, yMax: columnHeight + 0.3
        });
    }

    // ── Roof (conical/octagonal peaked roof with overhang) ──
    const roofBaseY = platformHeight + columnHeight;
    const roofRadius = platformRadius + 0.8; // overhang past columns
    const roofPeakHeight = 2.2;

    // Main roof cone
    const roofGeo = new THREE.ConeGeometry(roofRadius, roofPeakHeight, 8);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(cx, roofBaseY + roofPeakHeight / 2, cz);
    roof.castShadow = true;
    roof.receiveShadow = true;
    pavGroup.add(roof);

    // Roof underside (flat disc so it doesn't look hollow from below)
    const roofUnderGeo = new THREE.CircleGeometry(roofRadius - 0.1, 8);
    const roofUnder = new THREE.Mesh(roofUnderGeo, woodMat);
    roofUnder.rotation.x = Math.PI / 2;
    roofUnder.position.set(cx, roofBaseY + 0.02, cz);
    pavGroup.add(roofUnder);

    // Roof trim ring
    const roofTrimGeo = new THREE.TorusGeometry(roofRadius - 0.05, 0.08, 6, 8);
    const roofTrim = new THREE.Mesh(roofTrimGeo, metalTrimMat);
    roofTrim.rotation.x = Math.PI / 2;
    roofTrim.position.set(cx, roofBaseY + 0.05, cz);
    pavGroup.add(roofTrim);

    // Roof peak finial
    const finialGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const finial = new THREE.Mesh(finialGeo, metalTrimMat);
    finial.position.set(cx, roofBaseY + roofPeakHeight + 0.12, cz);
    pavGroup.add(finial);

    // ── Crossbeams connecting columns to center (visible under roof) ──
    const beamGeo = new THREE.BoxGeometry(0.12, 0.14, columnRing);
    for (let i = 0; i < columnCount; i++) {
        const angle = (i / columnCount) * Math.PI * 2;
        const beam = new THREE.Mesh(beamGeo, woodMat);
        beam.position.set(
            cx + Math.cos(angle) * (columnRing / 2),
            roofBaseY - 0.1,
            cz + Math.sin(angle) * (columnRing / 2)
        );
        beam.rotation.y = -angle + Math.PI / 2;
        beam.castShadow = true;
        pavGroup.add(beam);
    }

    // ── Built-in bench ring (hexagonal inner seating) ──
    const benchRing = 2.8;
    const benchCount = 6;
    const benchSeatGeo = new THREE.BoxGeometry(2.2, 0.08, 0.55);
    const benchLegGeo = new THREE.BoxGeometry(0.08, 0.38, 0.08);

    for (let i = 0; i < benchCount; i++) {
        const angle = (i / benchCount) * Math.PI * 2 + Math.PI / 6;
        const bx = cx + Math.cos(angle) * benchRing;
        const bz = cz + Math.sin(angle) * benchRing;

        // Seat
        const seat = new THREE.Mesh(benchSeatGeo, woodMat);
        seat.position.set(bx, platformHeight + 0.42, bz);
        seat.rotation.y = -angle;
        seat.castShadow = true;
        seat.receiveShadow = true;
        pavGroup.add(seat);

        // Two legs
        for (const side of [-0.85, 0.85]) {
            const leg = new THREE.Mesh(benchLegGeo, metalTrimMat);
            const lx = bx + Math.cos(angle + Math.PI / 2) * side * 0.3;
            const lz = bz + Math.sin(angle + Math.PI / 2) * side * 0.3;
            leg.position.set(lx, platformHeight + 0.19, lz);
            pavGroup.add(leg);
        }
    }

    group.add(pavGroup);
}

// ─── Park Pond ──────────────────────────────────────────────
// Small decorative pond with rocks, reeds, and a lily pad cluster.
// Positioned in the southeast quadrant.
function createPond(group, colliders) {
    const pondGroup = new THREE.Group();
    const cx = 30, cz = 30; // pond center

    // Materials
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a5a,
        roughness: 0.15,
        metalness: 0.3,
        transparent: true,
        opacity: 0.78
    });
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a62, roughness: 0.92, metalness: 0.05
    });
    const darkRockMat = new THREE.MeshStandardMaterial({
        color: 0x4a4a42, roughness: 0.95, metalness: 0.04
    });
    const reedMat = new THREE.MeshStandardMaterial({
        color: 0x4a6a32, roughness: 0.85, metalness: 0.0
    });
    const lilyPadMat = new THREE.MeshStandardMaterial({
        color: 0x2d6b30, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide
    });
    const lilyFlowerMat = new THREE.MeshStandardMaterial({
        color: 0xf0c0d0, roughness: 0.6
    });
    const mudMat = new THREE.MeshStandardMaterial({
        color: 0x4a3d2a, roughness: 0.95, metalness: 0.0
    });

    // ── Pond basin (elliptical depression) ──
    const pondRadiusX = 4.5;
    const pondRadiusZ = 3.5;
    const pondDepth = 0.12;

    // Mud/earth ring around pond edge
    const mudRingGeo = new THREE.CircleGeometry(1, 24);
    const mudRing = new THREE.Mesh(mudRingGeo, mudMat);
    mudRing.rotation.x = -Math.PI / 2;
    mudRing.position.set(cx, -0.008, cz);
    mudRing.scale.set(pondRadiusX + 0.8, pondRadiusZ + 0.8, 1);
    mudRing.receiveShadow = true;
    pondGroup.add(mudRing);

    // Water surface
    const waterGeo = new THREE.CircleGeometry(1, 24);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, -pondDepth + 0.01, cz);
    water.scale.set(pondRadiusX, pondRadiusZ, 1);
    water.receiveShadow = true;
    pondGroup.add(water);

    // ── Rock border (irregular stones around the edge) ──
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockCount = 22;
    for (let i = 0; i < rockCount; i++) {
        const angle = (i / rockCount) * Math.PI * 2 + stableNoise2D(i, cx, 5.3) * 0.3;
        const edgeDist = 0.92 + stableNoise2D(i, cz, 8.7) * 0.15;
        const rx = cx + Math.cos(angle) * pondRadiusX * edgeDist;
        const rz = cz + Math.sin(angle) * pondRadiusZ * edgeDist;
        const scale = 0.18 + stableNoise2D(i, i * 3, 12.1) * 0.28;

        const rock = new THREE.Mesh(rockGeo, stableNoise2D(i, 0, 99) > 0.5 ? rockMat : darkRockMat);
        rock.scale.set(scale, scale * 0.6, scale * 0.9);
        rock.position.set(rx, scale * 0.15, rz);
        rock.rotation.set(
            stableNoise2D(i, 1, 20) * 0.5,
            stableNoise2D(i, 2, 20) * Math.PI,
            stableNoise2D(i, 3, 20) * 0.3
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        pondGroup.add(rock);
    }

    // A few larger accent rocks
    const accentRocks = [
        { x: cx - 3.8, z: cz - 2.5, s: 0.55 },
        { x: cx + 4.0, z: cz + 1.5, s: 0.48 },
        { x: cx - 1.5, z: cz + 3.2, s: 0.42 },
    ];
    for (const ar of accentRocks) {
        const rock = new THREE.Mesh(rockGeo, darkRockMat);
        rock.scale.set(ar.s, ar.s * 0.55, ar.s * 0.8);
        rock.position.set(ar.x, ar.s * 0.18, ar.z);
        rock.rotation.y = stableNoise2D(ar.x, ar.z, 7) * Math.PI;
        rock.castShadow = true;
        pondGroup.add(rock);
    }

    // ── Reeds / cattails around edges ──
    const reedGeo = new THREE.CylinderGeometry(0.02, 0.025, 1, 4);
    const cattailGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.18, 5);
    const cattailMat = new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.9 });

    const reedClusters = [
        { x: cx - 3.5, z: cz - 2.8, count: 6 },
        { x: cx + 3.8, z: cz + 2.2, count: 5 },
        { x: cx - 2.0, z: cz + 3.0, count: 4 },
        { x: cx + 1.5, z: cz - 3.2, count: 5 },
    ];
    for (const cluster of reedClusters) {
        for (let i = 0; i < cluster.count; i++) {
            const reedHeight = 0.6 + stableNoise2D(cluster.x + i, cluster.z, 15) * 0.6;
            const ox = (stableNoise2D(i, cluster.x, 22) - 0.5) * 1.2;
            const oz = (stableNoise2D(i, cluster.z, 33) - 0.5) * 1.0;

            const reed = new THREE.Mesh(reedGeo, reedMat);
            reed.scale.y = reedHeight;
            reed.position.set(cluster.x + ox, reedHeight * 0.5 - 0.05, cluster.z + oz);
            reed.rotation.x = (stableNoise2D(i, 0, 44) - 0.5) * 0.15;
            reed.rotation.z = (stableNoise2D(i, 1, 44) - 0.5) * 0.15;
            reed.userData.isLeaves = true;
            reed.userData.leafSway = 0.15 + stableNoise2D(i, 2, 44) * 0.2;
            pondGroup.add(reed);

            // Cattail top on taller reeds
            if (reedHeight > 0.9) {
                const cattail = new THREE.Mesh(cattailGeo, cattailMat);
                cattail.position.set(cluster.x + ox, reedHeight - 0.02, cluster.z + oz);
                pondGroup.add(cattail);
            }
        }
    }

    // ── Lily pads on the water surface ──
    const lilyGeo = new THREE.CircleGeometry(0.25, 8);
    const lilyFlowerGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const lilyPads = [
        { x: cx - 1.2, z: cz + 0.8 },
        { x: cx + 0.8, z: cz - 0.5 },
        { x: cx - 0.3, z: cz - 1.5 },
        { x: cx + 1.8, z: cz + 1.2 },
        { x: cx - 2.0, z: cz - 0.2 },
        { x: cx + 0.2, z: cz + 1.8 },
    ];
    for (let i = 0; i < lilyPads.length; i++) {
        const lp = lilyPads[i];
        const pad = new THREE.Mesh(lilyGeo, lilyPadMat);
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = stableNoise2D(i, 55, 10) * Math.PI;
        pad.scale.setScalar(0.7 + stableNoise2D(i, 66, 10) * 0.6);
        pad.position.set(lp.x, -pondDepth + 0.02, lp.z);
        pondGroup.add(pad);

        // Flower on some pads
        if (i % 3 === 0) {
            const flower = new THREE.Mesh(lilyFlowerGeo, lilyFlowerMat);
            flower.position.set(lp.x + 0.1, -pondDepth + 0.08, lp.z + 0.05);
            pondGroup.add(flower);
        }
    }

    // ── Pond collider (prevent walking into water) ──
    // Approximate with two overlapping AABBs for the ellipse
    colliders.push({
        type: 'aabb',
        minX: cx - pondRadiusX * 0.85, maxX: cx + pondRadiusX * 0.85,
        minZ: cz - pondRadiusZ, maxZ: cz + pondRadiusZ,
        yMin: -0.3, yMax: 0.3
    });
    colliders.push({
        type: 'aabb',
        minX: cx - pondRadiusX, maxX: cx + pondRadiusX,
        minZ: cz - pondRadiusZ * 0.75, maxZ: cz + pondRadiusZ * 0.75,
        yMin: -0.3, yMax: 0.3
    });

    group.add(pondGroup);
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

    for (let i = 0; i < 96; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 42;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        if (!isOutsideFenceArea(x, z, 1.2)) continue;

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

    for (let i = 0; i < 34; i++) {
        const x = (Math.random() - 0.5) * 92;
        const z = (Math.random() - 0.5) * 92;
        if (!isOutsideFenceArea(x, z, 1.5)) continue;
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.13, 0),
            rockMat
        );
        rock.position.set(x, 0.03, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        group.add(rock);
    }

    // Small branch litter for extra ground richness around the outer park.
    const twigMat = new THREE.MeshStandardMaterial({
        color: 0x5a412d,
        roughness: 0.95,
        metalness: 0.0
    });
    for (let i = 0; i < 26; i++) {
        const x = (Math.random() - 0.5) * 86;
        const z = (Math.random() - 0.5) * 86;
        if (!isOutsideFenceArea(x, z, 1.8)) continue;
        const twig = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.02, 0.35 + Math.random() * 0.35, 5),
            twigMat
        );
        twig.position.set(x, 0.04, z);
        twig.rotation.set(
            (Math.random() - 0.5) * 0.4,
            Math.random() * Math.PI,
            Math.PI / 2 + (Math.random() - 0.5) * 0.6
        );
        twig.castShadow = true;
        group.add(twig);
    }
}
