import * as THREE from 'three';

// City surrounds the park on all sides — buildings, sidewalks, streets, cars, etc.
const PARK_RADIUS = 55; // park grass extends ~100x100, city starts beyond
const BLOCK_SIZE = 12;
const STREET_WIDTH = 6;
const SIDEWALK_WIDTH = 3.5;
const CITY_OUTER_EDGE = PARK_RADIUS + 0.5;

const buildingBodyMaterialCache = new Map();
const buildingCorniceMaterialCache = new Map();
const buildingAccentMaterialCache = new Map();

const WINDOW_DARK_MAT = new THREE.MeshStandardMaterial({
    color: 0x87a6c4,
    emissive: 0x26384a,
    emissiveIntensity: 0.14,
    roughness: 0.16,
    metalness: 0.58
});
const WINDOW_LIT_MAT = new THREE.MeshStandardMaterial({
    color: 0xffe4b8,
    emissive: 0xffcc70,
    emissiveIntensity: 0.36,
    roughness: 0.22,
    metalness: 0.08
});
const ROOF_METAL_MAT = new THREE.MeshStandardMaterial({
    color: 0x5f6666,
    roughness: 0.62,
    metalness: 0.35
});
const ROOF_RAIL_MAT = new THREE.MeshStandardMaterial({
    color: 0x434343,
    roughness: 0.4,
    metalness: 0.75
});
const BILLBOARD_COOL_MAT = new THREE.MeshStandardMaterial({
    color: 0xdfe8f4,
    roughness: 0.7,
    metalness: 0.08
});
const BILLBOARD_WARM_MAT = new THREE.MeshStandardMaterial({
    color: 0xf3dfcc,
    roughness: 0.7,
    metalness: 0.08
});
const AWNING_MATERIALS = [
    new THREE.MeshStandardMaterial({ color: 0xcc4a3b, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x3f7a4b, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x3d5f99, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.7 }),
];
const LANE_DASH_MAT = new THREE.MeshBasicMaterial({ color: 0xddcc44 });
const LANE_EDGE_MAT = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
const CROSSWALK_MAT = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
const WATER_TOWER_WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
const WATER_TOWER_METAL_MAT = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });
const WINDOW_GEO = new THREE.PlaneGeometry(0.82, 1.24);
const AC_GEO = new THREE.BoxGeometry(1.2, 0.8, 1.0);
const ROOF_UNIT_GEO = new THREE.BoxGeometry(1.8, 1.2, 1.6);

export function createCity(scene) {
    const cityGroup = new THREE.Group();
    cityGroup.name = 'city';
    const cityColliders = [];

    createSidewalks(cityGroup);
    createStreets(cityGroup);
    createCityGroundPlane(cityGroup);
    createCityBlocks(cityGroup, cityColliders);
    createStreetProps(cityGroup);
    createParkedCars(cityGroup);

    scene.userData.cityColliders = cityColliders;
    scene.add(cityGroup);
    return cityGroup;
}

// ─── Sidewalks (ring around the park) ───────────────────────
function createSidewalks(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Concrete sidewalk texture
    ctx.fillStyle = '#b0a898';
    ctx.fillRect(0, 0, 256, 256);
    // Grid lines (expansion joints)
    ctx.strokeStyle = '#9a9080';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 64);
        ctx.lineTo(256, i * 64);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * 64, 0);
        ctx.lineTo(i * 64, 256);
        ctx.stroke();
    }
    // Wear/grime
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(${100 + Math.random() * 60}, ${95 + Math.random() * 55}, ${85 + Math.random() * 50}, 0.08)`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // Hairline cracks and repaired seams for sidewalk variation.
    ctx.strokeStyle = 'rgba(115, 107, 95, 0.38)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 34; i++) {
        const sx = Math.random() * 256;
        const sy = Math.random() * 256;
        const ex = sx + (Math.random() - 0.5) * 56;
        const ey = sy + (Math.random() - 0.5) * 56;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(15, 15);

    const sidewalkMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0.02,
        color: 0xc0b8a8
    });

    // Four sidewalk strips around the park perimeter
    const parkEdge = CITY_OUTER_EDGE - SIDEWALK_WIDTH;
    const sidewalkWidth = SIDEWALK_WIDTH;

    const strips = [
        // [x, z, width, length]
        [0, parkEdge + sidewalkWidth / 2, parkEdge * 2 + sidewalkWidth * 2, sidewalkWidth],  // north
        [0, -(parkEdge + sidewalkWidth / 2), parkEdge * 2 + sidewalkWidth * 2, sidewalkWidth], // south
        [parkEdge + sidewalkWidth / 2, 0, sidewalkWidth, parkEdge * 2],  // east
        [-(parkEdge + sidewalkWidth / 2), 0, sidewalkWidth, parkEdge * 2], // west
    ];

    for (const [x, z, w, l] of strips) {
        const sidewalk = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.12, l),
            sidewalkMat
        );
        sidewalk.position.set(x, 0.01, z);
        sidewalk.receiveShadow = true;
        group.add(sidewalk);
    }

    // Curb (raised edge between sidewalk and street)
    const curbMat = new THREE.MeshStandardMaterial({
        color: 0x999080,
        roughness: 0.8,
        metalness: 0.05
    });
    const curbHeight = 0.18;
    const curbWidth = 0.2;
    const outerEdge = parkEdge + sidewalkWidth;

    const curbs = [
        [0, outerEdge + curbWidth / 2, outerEdge * 2 + curbWidth * 2, curbWidth, curbHeight],
        [0, -(outerEdge + curbWidth / 2), outerEdge * 2 + curbWidth * 2, curbWidth, curbHeight],
        [outerEdge + curbWidth / 2, 0, curbWidth, outerEdge * 2, curbHeight],
        [-(outerEdge + curbWidth / 2), 0, curbWidth, outerEdge * 2, curbHeight],
    ];

    for (const [x, z, w, l, h] of curbs) {
        const curb = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, l),
            curbMat
        );
        curb.position.set(x, h / 2, z);
        curb.receiveShadow = true;
        curb.castShadow = true;
        group.add(curb);
    }

    createSidewalkPlanters(group);
}

// ─── Streets ────────────────────────────────────────────────
function createStreets(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const b = 45 + Math.random() * 30;
        ctx.fillStyle = `rgb(${b}, ${b}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
    }
    // Broad repair patches and shallow cracks for aged asphalt.
    for (let i = 0; i < 24; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = 16 + Math.random() * 52;
        const h = 10 + Math.random() * 30;
        ctx.fillStyle = `rgba(${55 + Math.random() * 25}, ${55 + Math.random() * 25}, ${55 + Math.random() * 25}, 0.22)`;
        ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.38)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
        const sx = Math.random() * 512;
        const sy = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
            sx + (Math.random() - 0.5) * 90,
            sy + (Math.random() - 0.5) * 90
        );
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);

    const streetMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.05,
        color: 0x444444
    });

    const outerEdge = CITY_OUTER_EDGE;
    const streetW = STREET_WIDTH;

    // Streets on all 4 sides
    const streets = [
        [0, outerEdge + streetW / 2, outerEdge * 2 + streetW * 2, streetW],
        [0, -(outerEdge + streetW / 2), outerEdge * 2 + streetW * 2, streetW],
        [outerEdge + streetW / 2, 0, streetW, outerEdge * 2],
        [-(outerEdge + streetW / 2), 0, streetW, outerEdge * 2],
    ];

    for (const [x, z, w, l] of streets) {
        const street = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.08, l),
            streetMat
        );
        street.position.set(x, -0.01, z);
        street.receiveShadow = true;
        group.add(street);

        // Center lane markings (yellow dashed)
        addLaneMarkings(group, x, z, w, l);
    }

    // Corner fillers (where streets intersect)
    const cornerSize = streetW;
    const corners = [
        [outerEdge + streetW / 2, outerEdge + streetW / 2],
        [-(outerEdge + streetW / 2), outerEdge + streetW / 2],
        [outerEdge + streetW / 2, -(outerEdge + streetW / 2)],
        [-(outerEdge + streetW / 2), -(outerEdge + streetW / 2)],
    ];
    for (const [cx, cz] of corners) {
        const corner = new THREE.Mesh(
            new THREE.BoxGeometry(cornerSize, 0.08, cornerSize),
            streetMat
        );
        corner.position.set(cx, -0.01, cz);
        corner.receiveShadow = true;
        group.add(corner);
    }

    addCrosswalks(group, outerEdge, streetW);
}

function addLaneMarkings(group, streetX, streetZ, streetW, streetL) {
    const isHorizontal = streetW > streetL;

    const length = isHorizontal ? streetW : streetL;
    const dashLength = 2.5;
    const gapLength = 2.5;
    const dashCount = Math.floor(length / (dashLength + gapLength));

    for (let i = 0; i < dashCount; i++) {
        const offset = -length / 2 + i * (dashLength + gapLength) + dashLength / 2;
        const dash = new THREE.Mesh(
            new THREE.PlaneGeometry(
                isHorizontal ? dashLength : 0.12,
                isHorizontal ? 0.12 : dashLength
            ),
            LANE_DASH_MAT
        );
        dash.rotation.x = -Math.PI / 2;
        if (isHorizontal) {
            dash.position.set(streetX + offset, 0.04, streetZ);
        } else {
            dash.position.set(streetX, 0.04, streetZ + offset);
        }
        group.add(dash);
    }

    // White edge lines
    for (const edgeOffset of [-1, 1]) {
        const edgeLine = new THREE.Mesh(
            new THREE.PlaneGeometry(
                isHorizontal ? length : 0.08,
                isHorizontal ? 0.08 : length
            ),
            LANE_EDGE_MAT
        );
        edgeLine.rotation.x = -Math.PI / 2;
        if (isHorizontal) {
            edgeLine.position.set(streetX, 0.04, streetZ + edgeOffset * (STREET_WIDTH / 2 - 0.3));
        } else {
            edgeLine.position.set(streetX + edgeOffset * (STREET_WIDTH / 2 - 0.3), 0.04, streetZ);
        }
        group.add(edgeLine);
    }
}

function addCrosswalks(group, outerEdge, streetW) {
    const stripeSpan = 2.2;
    const stripeThickness = 0.34;
    const stripeCount = 6;
    const stripeGap = 0.5;
    const cornerSigns = [-1, 1];

    for (const sx of cornerSigns) {
        for (const sz of cornerSigns) {
            // Crosswalk on north/south streets (stripes run along X).
            for (let i = 0; i < stripeCount; i++) {
                const offset = (i - (stripeCount - 1) / 2) * stripeGap;
                const stripe = new THREE.Mesh(
                    new THREE.PlaneGeometry(stripeSpan, stripeThickness),
                    CROSSWALK_MAT
                );
                stripe.rotation.x = -Math.PI / 2;
                stripe.position.set(
                    sx * (outerEdge + streetW * 0.5 + offset),
                    0.045,
                    sz * (outerEdge + 0.9)
                );
                group.add(stripe);
            }

            // Crosswalk on east/west streets (stripes run along Z).
            for (let i = 0; i < stripeCount; i++) {
                const offset = (i - (stripeCount - 1) / 2) * stripeGap;
                const stripe = new THREE.Mesh(
                    new THREE.PlaneGeometry(stripeThickness, stripeSpan),
                    CROSSWALK_MAT
                );
                stripe.rotation.x = -Math.PI / 2;
                stripe.position.set(
                    sx * (outerEdge + 0.9),
                    0.045,
                    sz * (outerEdge + streetW * 0.5 + offset)
                );
                group.add(stripe);
            }
        }
    }
}

function createSidewalkPlanters(group) {
    const planterMat = new THREE.MeshStandardMaterial({
        color: 0x8f887c,
        roughness: 0.88,
        metalness: 0.04
    });
    const soilMat = new THREE.MeshStandardMaterial({
        color: 0x57422d,
        roughness: 0.95,
        metalness: 0.0
    });
    const shrubMats = [
        new THREE.MeshStandardMaterial({ color: 0x6aa95f, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: 0x5c9654, roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: 0x78ba6f, roughness: 0.88 }),
    ];

    const planterPositions = [
        ...[-38, -22, -6, 10, 26, 42].flatMap((x) => [[x, CITY_OUTER_EDGE - 1.9], [x, -(CITY_OUTER_EDGE - 1.9)]]),
        ...[-34, -18, 0, 18, 34].flatMap((z) => [[CITY_OUTER_EDGE - 1.9, z], [-(CITY_OUTER_EDGE - 1.9), z]]),
    ];

    for (const [x, z] of planterPositions) {
        const planter = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 1.2), planterMat);
        box.position.y = 0.21;
        box.castShadow = true;
        box.receiveShadow = true;
        planter.add(box);

        const soil = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.95), soilMat);
        soil.position.y = 0.35;
        planter.add(soil);

        const shrub = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.42, 0),
            shrubMats[Math.floor(Math.random() * shrubMats.length)]
        );
        shrub.position.y = 0.72;
        shrub.scale.y = 0.8 + Math.random() * 0.4;
        shrub.castShadow = true;
        shrub.userData.isLeaves = true;
        shrub.userData.leafSway = 0.08 + Math.random() * 0.15;
        planter.add(shrub);

        planter.position.set(x, 0, z);
        group.add(planter);
    }
}

// ─── City Ground Plane ─────────────────────────────────────
// Pavement/sidewalk surface beneath buildings so the city area
// looks like actual city ground instead of grass.
function createCityGroundPlane(group) {
    // Reuse sidewalk-style concrete texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#a8a090';
    ctx.fillRect(0, 0, 256, 256);
    // Concrete slab grid
    ctx.strokeStyle = '#908878';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 64);
        ctx.lineTo(256, i * 64);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * 64, 0);
        ctx.lineTo(i * 64, 256);
        ctx.stroke();
    }
    // Wear marks and grime
    for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 40}, ${85 + Math.random() * 40}, ${75 + Math.random() * 35}, 0.07)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // Oil stains
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(40, 38, 35, 0.12)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);

    const groundMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.88,
        metalness: 0.03,
        color: 0xb0a898
    });

    const cityStart = 62;
    const cityDepth = 52;
    const groundY = -0.015;

    // Four ground planes beneath each building district
    const planes = [
        // [x, z, width, depth]
        [0, cityStart + cityDepth / 2, cityStart * 2 + cityDepth * 2, cityDepth],          // north
        [0, -(cityStart + cityDepth / 2), cityStart * 2 + cityDepth * 2, cityDepth],       // south
        [cityStart + cityDepth / 2, 0, cityDepth, cityStart * 2],                           // east
        [-(cityStart + cityDepth / 2), 0, cityDepth, cityStart * 2],                        // west
    ];

    for (const [x, z, w, d] of planes) {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            groundMat
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(x, groundY, z);
        ground.receiveShadow = true;
        group.add(ground);
    }

    // Corner fills (where districts overlap)
    const cornerPlanes = [
        [cityStart + cityDepth / 2, cityStart + cityDepth / 2],
        [-(cityStart + cityDepth / 2), cityStart + cityDepth / 2],
        [cityStart + cityDepth / 2, -(cityStart + cityDepth / 2)],
        [-(cityStart + cityDepth / 2), -(cityStart + cityDepth / 2)],
    ];
    for (const [x, z] of cornerPlanes) {
        const corner = new THREE.Mesh(
            new THREE.PlaneGeometry(cityDepth, cityDepth),
            groundMat
        );
        corner.rotation.x = -Math.PI / 2;
        corner.position.set(x, groundY, z);
        corner.receiveShadow = true;
        group.add(corner);
    }
}

// ─── City Blocks (buildings) ────────────────────────────────
function createCityBlocks(group, colliders) {
    const buildingColors = [
        0x8b7355, 0x6b5b47, 0x997755, 0x7a6a52, // brownstone
        0x666666, 0x777777, 0x888888, 0x5a5a5a,   // concrete/modern
        0x8b4513, 0x7a3b10, 0x654321,              // brick
        0x556b6b, 0x4a5a5a,                         // glass/steel tint
    ];

    const cityStart = 62; // where buildings begin (after street)

    // Generate building clusters on each side
    const sides = [
        { dir: 'north', xRange: [-65, 65], zRange: [cityStart, cityStart + 50] },
        { dir: 'south', xRange: [-65, 65], zRange: [-(cityStart + 50), -cityStart] },
        { dir: 'east', xRange: [cityStart, cityStart + 50], zRange: [-65, 65] },
        { dir: 'west', xRange: [-(cityStart + 50), -cityStart], zRange: [-65, 65] },
    ];

    for (const side of sides) {
        const { xRange, zRange, dir } = side;

        // Place buildings in a grid pattern with variation
        for (let x = xRange[0]; x < xRange[1]; x += BLOCK_SIZE + 2) {
            for (let z = zRange[0]; z < zRange[1]; z += BLOCK_SIZE + 2) {
                if (Math.random() < 0.12) continue; // occasional empty lot

                const bWidth = 6 + Math.random() * 8;
                const bDepth = 6 + Math.random() * 8;
                const bHeight = 8 + Math.random() * 35;

                // Closer buildings are shorter (zoning feel)
                const distFromPark = Math.sqrt(x * x + z * z) - cityStart;
                const heightMult = 0.4 + (distFromPark / 50) * 0.8;

                const finalHeight = bHeight * heightMult;
                const colorIdx = Math.floor(Math.random() * buildingColors.length);
                const styleSeed = Math.random();
                const jitterX = (Math.random() - 0.5) * 2.4;
                let jitterZ = (Math.random() - 0.5) * 2.4;
                let adjustedJitterX = jitterX;

                if (dir === 'north') jitterZ = Math.random() * 2.2;
                if (dir === 'south') jitterZ = -Math.random() * 2.2;
                if (dir === 'east') {
                    adjustedJitterX = Math.random() * 2.2;
                    jitterZ = (Math.random() - 0.5) * 2.2;
                }
                if (dir === 'west') {
                    adjustedJitterX = -Math.random() * 2.2;
                    jitterZ = (Math.random() - 0.5) * 2.2;
                }

                const bx = x + adjustedJitterX;
                const bz = z + jitterZ;
                createBuilding(
                    group,
                    bx,
                    bz,
                    bWidth,
                    bDepth,
                    finalHeight,
                    buildingColors[colorIdx],
                    styleSeed,
                    dir
                );
                // Building collider (AABB matching footprint)
                colliders.push({
                    type: 'aabb',
                    minX: bx - bWidth / 2 - 0.3,
                    maxX: bx + bWidth / 2 + 0.3,
                    minZ: bz - bDepth / 2 - 0.3,
                    maxZ: bz + bDepth / 2 + 0.3,
                    yMin: 0,
                    yMax: finalHeight
                });
            }
        }
    }
}

function createBuilding(group, x, z, width, depth, height, color, styleSeed, district) {
    const building = new THREE.Group();

    // Main structure
    const bodyMat = getBuildingBodyMaterial(color);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        bodyMat
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    addFacadeArticulation(building, width, depth, height, color, styleSeed);

    // Windows (grid of emissive rectangles on front faces)
    addBuildingWindows(building, width, depth, height, styleSeed);

    // Roof details
    if (styleSeed > 0.18) {
        // Water tower (NYC style)
        if (height > 20 && styleSeed > 0.62) {
            addWaterTower(building, height, width, depth);
        }
        // Rooftop mechanical units
        if (styleSeed > 0.35) {
            const acCount = 1 + Math.floor(styleSeed * 3);
            for (let i = 0; i < acCount; i++) {
                const ac = new THREE.Mesh(
                    i % 2 === 0 ? AC_GEO : ROOF_UNIT_GEO,
                    ROOF_METAL_MAT
                );
                ac.position.set(
                    (Math.random() - 0.5) * (width - 2.2),
                    height + 0.4,
                    (Math.random() - 0.5) * (depth - 2.2)
                );
                ac.castShadow = true;
                building.add(ac);
            }
        }
    }

    // Cornice / ledge at top
    const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3),
        getBuildingCorniceMaterial(color)
    );
    cornice.position.y = height;
    building.add(cornice);

    addRooftopSilhouette(building, width, depth, height, color, styleSeed, district);

    // Ground floor awning (some buildings)
    if (styleSeed > 0.56) {
        const awning = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.8, 0.08, 1.5),
            AWNING_MATERIALS[Math.floor(styleSeed * AWNING_MATERIALS.length) % AWNING_MATERIALS.length]
        );
        awning.position.set(0, 3.2, depth / 2 + 0.7);
        building.add(awning);
    }

    building.position.set(x, 0, z);
    group.add(building);
}

function getBuildingBodyMaterial(color) {
    if (!buildingBodyMaterialCache.has(color)) {
        buildingBodyMaterialCache.set(color, new THREE.MeshStandardMaterial({
            color,
            roughness: 0.75,
            metalness: 0.1
        }));
    }
    return buildingBodyMaterialCache.get(color);
}

function getBuildingCorniceMaterial(color) {
    if (!buildingCorniceMaterialCache.has(color)) {
        const corniceColor = new THREE.Color(color).multiplyScalar(0.82).getHex();
        buildingCorniceMaterialCache.set(color, new THREE.MeshStandardMaterial({
            color: corniceColor,
            roughness: 0.8,
            metalness: 0.08
        }));
    }
    return buildingCorniceMaterialCache.get(color);
}

function getBuildingAccentMaterial(color, keySuffix, scalar, roughness = 0.76, metalness = 0.08) {
    const cacheKey = `${color}|${keySuffix}`;
    if (!buildingAccentMaterialCache.has(cacheKey)) {
        buildingAccentMaterialCache.set(cacheKey, new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(scalar),
            roughness,
            metalness
        }));
    }
    return buildingAccentMaterialCache.get(cacheKey);
}

function addFacadeArticulation(building, width, depth, height, color, styleSeed) {
    const insetDepth = 0.18;
    const accentMat = getBuildingAccentMaterial(color, 'accent', 0.92, 0.78, 0.05);

    if (styleSeed > 0.28) {
        const horizBands = height > 18 ? 2 : 1;
        for (let i = 0; i < horizBands; i++) {
            const y = height * (0.33 + i * 0.31);
            const bandFront = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.16, insetDepth), accentMat);
            bandFront.position.set(0, y, depth / 2 + insetDepth * 0.5);
            building.add(bandFront);

            const bandBack = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.16, insetDepth), accentMat);
            bandBack.position.set(0, y, -(depth / 2 + insetDepth * 0.5));
            building.add(bandBack);
        }
    }

    if (styleSeed > 0.42) {
        const pilasterMat = getBuildingAccentMaterial(color, 'pilaster', 0.84, 0.8, 0.04);
        const pilasterGeo = new THREE.BoxGeometry(0.26, height - 1.0, insetDepth);
        for (const xSign of [-1, 1]) {
            const pilaster = new THREE.Mesh(pilasterGeo, pilasterMat);
            pilaster.position.set(xSign * (width / 2 - 0.22), (height - 1.0) / 2 + 0.5, depth / 2 + insetDepth * 0.52);
            building.add(pilaster);

            const pilasterBack = new THREE.Mesh(pilasterGeo, pilasterMat);
            pilasterBack.position.set(xSign * (width / 2 - 0.22), (height - 1.0) / 2 + 0.5, -(depth / 2 + insetDepth * 0.52));
            building.add(pilasterBack);
        }
    }
}

function addRooftopSilhouette(building, width, depth, height, color, styleSeed, district) {
    if (height > 14 && styleSeed > 0.34) {
        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.64, Math.min(8, height * 0.22), depth * 0.64),
            getBuildingAccentMaterial(color, 'setback', 1.05, 0.72, 0.1)
        );
        tower.position.y = height + tower.geometry.parameters.height / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        building.add(tower);
    }

    if (styleSeed > 0.5) {
        const railH = 0.22;
        const rails = [
            new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, railH, 0.08), ROOF_RAIL_MAT),
            new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, railH, 0.08), ROOF_RAIL_MAT),
            new THREE.Mesh(new THREE.BoxGeometry(0.08, railH, depth + 0.2), ROOF_RAIL_MAT),
            new THREE.Mesh(new THREE.BoxGeometry(0.08, railH, depth + 0.2), ROOF_RAIL_MAT),
        ];
        rails[0].position.set(0, height + railH * 0.5, depth / 2 + 0.06);
        rails[1].position.set(0, height + railH * 0.5, -(depth / 2 + 0.06));
        rails[2].position.set(width / 2 + 0.06, height + railH * 0.5, 0);
        rails[3].position.set(-(width / 2 + 0.06), height + railH * 0.5, 0);
        for (const rail of rails) building.add(rail);
    }

    if (styleSeed > 0.73 && height > 11) {
        const billboard = new THREE.Group();
        const boardMat = district === 'north' || district === 'east' ? BILLBOARD_COOL_MAT : BILLBOARD_WARM_MAT;
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 0.12), boardMat);
        board.position.y = 2.1;
        board.castShadow = true;
        billboard.add(board);

        const supportGeo = new THREE.BoxGeometry(0.12, 2.0, 0.12);
        for (const xOff of [-1.0, 1.0]) {
            const support = new THREE.Mesh(supportGeo, ROOF_RAIL_MAT);
            support.position.set(xOff, 1.0, 0);
            billboard.add(support);
        }

        billboard.position.set(
            (Math.random() - 0.5) * Math.max(1.0, width - 4.0),
            height,
            depth / 2 + 0.16
        );
        building.add(billboard);
    }
}

function addBuildingWindows(building, width, depth, height, styleSeed) {
    const floorHeight = 3.2;
    const windowH = WINDOW_GEO.parameters.height;
    const floors = Math.floor(height / floorHeight);
    const windowsPerFloor = Math.max(1, Math.floor(width / (2.85 + styleSeed * 0.9)));
    const windowScaleX = 0.85 + styleSeed * 0.3;
    const windowScaleY = 0.9 + (1 - styleSeed) * 0.18;

    // Front and back faces
    for (const zSide of [-1, 1]) {
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < windowsPerFloor; w++) {
                const wx = -width / 2 + (w + 0.5) * (width / windowsPerFloor);
                const wy = floor * floorHeight + windowH / 2 + 0.5;
                const wz = zSide * (depth / 2 + 0.01);

                const isLit = Math.random() > 0.6;
                const win = new THREE.Mesh(
                    WINDOW_GEO,
                    isLit ? WINDOW_LIT_MAT : WINDOW_DARK_MAT
                );
                win.scale.set(windowScaleX, windowScaleY, 1);
                win.position.set(wx, wy, wz);
                if (zSide === -1) win.rotation.y = Math.PI;
                building.add(win);
            }
        }
    }

    // Side faces
    const sideWindowsPerFloor = Math.max(1, Math.floor(depth / (2.9 + (1 - styleSeed) * 0.6)));
    for (const xSide of [-1, 1]) {
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < sideWindowsPerFloor; w++) {
                const wz = -depth / 2 + (w + 0.5) * (depth / sideWindowsPerFloor);
                const wy = floor * floorHeight + windowH / 2 + 0.5;
                const wx = xSide * (width / 2 + 0.01);

                const isLit = Math.random() > 0.6;
                const win = new THREE.Mesh(
                    WINDOW_GEO,
                    isLit ? WINDOW_LIT_MAT : WINDOW_DARK_MAT
                );
                win.scale.set(windowScaleX, windowScaleY, 1);
                win.position.set(wx, wy, wz);
                win.rotation.y = xSide * Math.PI / 2;
                building.add(win);
            }
        }
    }
}

function addWaterTower(building, height, bWidth, bDepth) {
    const tower = new THREE.Group();

    // Tank
    const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.3, 2.5, 10),
        WATER_TOWER_WOOD_MAT
    );
    tank.position.y = 3.5;
    tank.castShadow = true;
    tower.add(tank);

    // Cone roof
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 1.0, 10),
        WATER_TOWER_WOOD_MAT
    );
    roof.position.y = 5.2;
    tower.add(roof);

    // Legs
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4),
            WATER_TOWER_METAL_MAT
        );
        leg.position.set(Math.cos(angle) * 1.0, 1.25, Math.sin(angle) * 1.0);
        tower.add(leg);
    }

    // Metal bands
    for (const y of [3.0, 3.8, 4.5]) {
        const band = new THREE.Mesh(
            new THREE.TorusGeometry(1.25, 0.04, 4, 16),
            WATER_TOWER_METAL_MAT
        );
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        tower.add(band);
    }

    tower.position.set(
        (Math.random() - 0.5) * (bWidth - 3),
        height,
        (Math.random() - 0.5) * (bDepth - 3)
    );
    building.add(tower);
}

// ─── Street Props (hydrants, mailboxes, signs, etc.) ────────
function createStreetProps(group) {
    const outerEdge = CITY_OUTER_EDGE;

    // Fire hydrants
    const hydrantPositions = [
        [outerEdge - 1, 15], [-(outerEdge - 1), -10],
        [20, outerEdge - 1], [-15, -(outerEdge - 1)],
    ];

    for (const [x, z] of hydrantPositions) {
        createFireHydrant(group, x, z);
    }

    // Street signs at intersections
    const signPositions = [
        [outerEdge + 2, outerEdge + 2, 0],
        [-(outerEdge + 2), outerEdge + 2, Math.PI / 2],
        [outerEdge + 2, -(outerEdge + 2), -Math.PI / 2],
        [-(outerEdge + 2), -(outerEdge + 2), Math.PI],
    ];

    for (const [x, z, rot] of signPositions) {
        createStreetSign(group, x, z, rot);
    }

    // Newspaper boxes
    createNewsBox(group, outerEdge - 0.5, 5);
    createNewsBox(group, -(outerEdge - 0.5), -8);

    // Traffic lights at corners
    createTrafficLight(group, outerEdge + STREET_WIDTH / 2, outerEdge + STREET_WIDTH / 2);
    createTrafficLight(group, -(outerEdge + STREET_WIDTH / 2), -(outerEdge + STREET_WIDTH / 2));
}

function createFireHydrant(group, x, z) {
    const hydrant = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6, metalness: 0.4 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), mat);
    body.position.y = 0.3;
    hydrant.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat);
    cap.position.y = 0.62;
    hydrant.add(cap);

    // Side nozzles
    for (const side of [-1, 1]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), mat);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(side * 0.17, 0.4, 0);
        hydrant.add(nozzle);

        const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6), mat);
        cap2.rotation.z = Math.PI / 2;
        cap2.position.set(side * 0.24, 0.4, 0);
        hydrant.add(cap2);
    }

    hydrant.position.set(x, 0, z);
    hydrant.castShadow = true;
    group.add(hydrant);
}

function createStreetSign(group, x, z, rotation) {
    const sign = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6), poleMat);
    pole.position.y = 1.75;
    sign.add(pole);

    // Sign plate
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x225522, roughness: 0.5, metalness: 0.3 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.03), plateMat);
    plate.position.y = 3.3;
    sign.add(plate);

    // Second sign perpendicular
    const plate2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 1.0), plateMat);
    plate2.position.y = 3.0;
    sign.add(plate2);

    sign.position.set(x, 0, z);
    sign.rotation.y = rotation;
    sign.castShadow = true;
    group.add(sign);
}

function createNewsBox(group, x, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.6, metalness: 0.3 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.4), mat);
    box.position.set(x, 0.5, z);
    box.castShadow = true;
    group.add(box);
}

function createTrafficLight(group, x, z) {
    const light = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.8 });

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), poleMat);
    pole.position.y = 2.5;
    light.add(pole);

    // Arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(1.5, 4.8, 0);
    light.add(arm);

    // Light housing
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.3), housingMat);
    housing.position.set(2.8, 4.8, 0);
    light.add(housing);

    // Lights (red, yellow, green)
    const lightColors = [0xff0000, 0xffaa00, 0x00ff00];
    for (let i = 0; i < 3; i++) {
        const bulb = new THREE.Mesh(
            new THREE.CircleGeometry(0.08, 8),
            new THREE.MeshStandardMaterial({
                color: lightColors[i],
                emissive: lightColors[i],
                emissiveIntensity: i === 2 ? 0.5 : 0.1 // green is active
            })
        );
        bulb.position.set(2.8, 5.1 - i * 0.3, 0.16);
        light.add(bulb);
    }

    light.position.set(x, 0, z);
    light.castShadow = true;
    group.add(light);
}

// ─── Parked Cars ────────────────────────────────────────────
function createParkedCars(group) {
    const carColors = [0x222222, 0xcc2222, 0x2244aa, 0xeeeeee, 0x444444, 0x886622, 0x228833];
    const outerEdge = CITY_OUTER_EDGE;
    const streetOffset = outerEdge + STREET_WIDTH * 0.75;

    // Cars along streets
    const carPositions = [
        // North street
        ...Array.from({ length: 6 }, (_, i) => [
            -30 + i * 12 + Math.random() * 3,
            streetOffset - 1.5,
            0
        ]),
        // South street
        ...Array.from({ length: 5 }, (_, i) => [
            -25 + i * 12 + Math.random() * 3,
            -(streetOffset - 1.5),
            Math.PI
        ]),
        // East street
        ...Array.from({ length: 5 }, (_, i) => [
            streetOffset - 1.5,
            -25 + i * 12 + Math.random() * 3,
            Math.PI / 2
        ]),
        // West street
        ...Array.from({ length: 4 }, (_, i) => [
            -(streetOffset - 1.5),
            -15 + i * 12 + Math.random() * 3,
            -Math.PI / 2
        ]),
    ];

    for (const [x, z, rot] of carPositions) {
        const color = carColors[Math.floor(Math.random() * carColors.length)];
        createCar(group, x, z, rot, color);
    }
}

function createCar(group, x, z, rotation, color) {
    const car = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc,
        roughness: 0.05,
        metalness: 0.8,
        transparent: true,
        opacity: 0.5
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Lower body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.2), bodyMat);
    body.position.y = 0.5;
    car.add(body);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
    cabin.position.set(0, 1.05, -0.2);
    car.add(cabin);

    // Wheels
    const wheelPositions = [[-0.85, -1.2], [-0.85, 1.2], [0.85, -1.2], [0.85, 1.2]];
    for (const [wx, wz] of wheelPositions) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), tireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.28, wz);
        car.add(wheel);
    }

    // Headlights
    const headlightMat = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.1
    });
    for (const xOff of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), headlightMat);
        hl.position.set(xOff, 0.5, 2.11);
        car.add(hl);
    }

    // Taillights
    const taillightMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.1
    });
    for (const xOff of [-0.6, 0.6]) {
        const tl = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), taillightMat);
        tl.position.set(xOff, 0.5, -2.11);
        tl.rotation.y = Math.PI;
        car.add(tl);
    }

    car.position.set(x, 0, z);
    car.rotation.y = rotation;
    car.castShadow = true;
    group.add(car);
}
