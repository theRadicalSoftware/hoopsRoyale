import * as THREE from 'three';

// ─── Court Dimensions (regulation NBA, scaled 1 unit = 1 meter) ─────
const COURT_LENGTH = 28.65;
const COURT_WIDTH = 15.24;
const HALF_LENGTH = COURT_LENGTH / 2;
const HALF_WIDTH = COURT_WIDTH / 2;

const KEY_WIDTH = 4.88;
const KEY_LENGTH = 5.79;
const HALF_KEY = KEY_WIDTH / 2;

const THREE_PT_RADIUS = 7.24;
const THREE_PT_CORNER = 6.71;
const THREE_PT_STRAIGHT = 4.26;

const FT_CIRCLE_RADIUS = 1.83;
const CENTER_CIRCLE_RADIUS = 1.83;
const RIM_FROM_BASELINE = 1.575;

// Gritty street court palette — faded, weathered, worn
const LINE_COLOR = 0xccccaa;        // yellowed white lines
const PAINT_COLOR = 0x882222;       // faded dark red
const COURT_COLOR = 0x2a4a28;       // dark worn green
const ASPHALT_COLOR = 0x383838;
let courtMaxAnisotropy = 1;

function setupTextureFiltering(texture) {
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(courtMaxAnisotropy, 8);
}

export function createCourt(scene) {
    const courtGroup = new THREE.Group();
    courtGroup.name = 'court';
    courtMaxAnisotropy = Math.max(1, Math.floor(scene?.userData?.maxAnisotropy || 1));

    createGround(courtGroup);
    createCourtSurface(courtGroup);
    createPlayingSurface(courtGroup);
    createCourtLines(courtGroup);
    createCourtDetails(courtGroup);
    createGraffiti(courtGroup);

    scene.add(courtGroup);
    return courtGroup;
}

// ─── Ground (grass — patchy, urban park style) ──────────────
function createGround(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Darker, patchier grass
    ctx.fillStyle = '#2d5a2d';
    ctx.fillRect(0, 0, 512, 512);

    // Dirt patches
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = `rgba(90, 75, 55, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Grass blades
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = Math.random();
        if (shade > 0.6) {
            ctx.fillStyle = `rgba(50, 110, 40, ${0.2 + Math.random() * 0.3})`;
        } else if (shade > 0.3) {
            ctx.fillStyle = `rgba(35, 80, 30, ${0.2 + Math.random() * 0.25})`;
        } else {
            ctx.fillStyle = `rgba(70, 60, 40, ${0.1 + Math.random() * 0.15})`;
        }
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(30, 30);
    setupTextureFiltering(texture);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.95,
            metalness: 0.0,
            color: 0x3a7a35
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    group.add(ground);
}

// ─── Court Surface (cracked, weathered asphalt) ─────────────
function createCourtSurface(group) {
    const padX = 3.0;
    const padZ = 4.0;
    const totalW = COURT_WIDTH + padX * 2;
    const totalL = COURT_LENGTH + padZ * 2;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Darker, grittier asphalt base
    ctx.fillStyle = '#353535';
    ctx.fillRect(0, 0, 1024, 1024);

    // Heavy texture noise
    for (let i = 0; i < 50000; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const b = 30 + Math.random() * 50;
        ctx.fillStyle = `rgb(${b}, ${b}, ${b})`;
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }

    // Prominent cracks
    ctx.strokeStyle = 'rgba(15, 15, 15, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        let cx = Math.random() * 1024;
        let cy = Math.random() * 1024;
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 8; j++) {
            cx += (Math.random() - 0.5) * 120;
            cy += (Math.random() - 0.5) * 120;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }

    // Thin hairline cracks
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 25; i++) {
        ctx.beginPath();
        let cx = Math.random() * 1024;
        let cy = Math.random() * 1024;
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 5; j++) {
            cx += (Math.random() - 0.5) * 60;
            cy += (Math.random() - 0.5) * 60;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }

    // Oil stains / dark patches
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const r = 15 + Math.random() * 40;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, 'rgba(20, 20, 20, 0.3)');
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    setupTextureFiltering(texture);

    const asphalt = new THREE.Mesh(
        new THREE.BoxGeometry(totalW, 0.15, totalL),
        new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.95,
            metalness: 0.03,
            color: ASPHALT_COLOR
        })
    );
    // Keep asphalt top clearly below the painted playing surface to avoid z-fighting.
    asphalt.position.y = -0.03;
    asphalt.receiveShadow = true;
    group.add(asphalt);

    // Crumbling edge
    const edgeGeo = new THREE.BoxGeometry(totalW + 0.3, 0.08, totalL + 0.3);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.98 });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = -0.08;
    edge.receiveShadow = true;
    group.add(edge);
}

// ─── Playing Surface (faded, worn green) ────────────────────
function createPlayingSurface(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Faded, worn court green
    ctx.fillStyle = '#1e4a20';
    ctx.fillRect(0, 0, 512, 512);

    // Wear pattern — heavy traffic areas lighter
    const centerGrad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    centerGrad.addColorStop(0, 'rgba(80, 80, 60, 0.15)');
    centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Grit and texture
    for (let i = 0; i < 20000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = Math.random();
        if (shade > 0.7) {
            ctx.fillStyle = `rgba(50, 70, 40, ${0.1 + Math.random() * 0.2})`;
        } else if (shade > 0.3) {
            ctx.fillStyle = `rgba(25, 55, 25, ${0.1 + Math.random() * 0.15})`;
        } else {
            ctx.fillStyle = `rgba(60, 55, 45, ${0.05 + Math.random() * 0.1})`;
        }
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }

    // Scuff marks
    ctx.strokeStyle = 'rgba(40, 40, 35, 0.2)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        const sx = Math.random() * 512;
        const sy = Math.random() * 512;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(
            sx + (Math.random() - 0.5) * 40,
            sy + (Math.random() - 0.5) * 40,
            sx + (Math.random() - 0.5) * 80,
            sy + (Math.random() - 0.5) * 80
        );
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 6);
    setupTextureFiltering(texture);

    const surfaceMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.01,
        color: COURT_COLOR
    });

    const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH),
        surfaceMat
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.06;
    surface.receiveShadow = true;
    group.add(surface);

    createPaintArea(group, -1);
    createPaintArea(group, 1);
}

// ─── Paint / Key Area (faded, chipped red) ──────────────────
function createPaintArea(group, side) {
    const zCenter = side * (HALF_LENGTH - KEY_LENGTH / 2);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Faded brick red
    ctx.fillStyle = '#6b1818';
    ctx.fillRect(0, 0, 256, 256);

    // Chipped paint / exposed asphalt
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(50, 50, 45, ${0.3 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + Math.random() * 12, 2 + Math.random() * 8, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Texture noise
    for (let i = 0; i < 6000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(${80 + Math.random() * 50}, ${12 + Math.random() * 18}, ${12 + Math.random() * 18}, 0.12)`;
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }

    const texture = new THREE.CanvasTexture(canvas);
    setupTextureFiltering(texture);

    const paint = new THREE.Mesh(
        new THREE.PlaneGeometry(KEY_WIDTH, KEY_LENGTH),
        new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.01,
            color: PAINT_COLOR
        })
    );
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(0, 0.065, zCenter);
    paint.receiveShadow = true;
    group.add(paint);
}

// ─── Court Lines (faded, not crisp white) ───────────────────
function createCourtLines(group) {
    const lineMat = new THREE.MeshBasicMaterial({ color: LINE_COLOR });
    const lineHeight = 0.072;
    const lineThickness = 0.05;

    function drawLine(x, z, width, length) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), lineMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, lineHeight, z);
        group.add(mesh);
    }

    // Boundary lines
    drawLine(HALF_WIDTH, 0, lineThickness, COURT_LENGTH);
    drawLine(-HALF_WIDTH, 0, lineThickness, COURT_LENGTH);
    drawLine(0, HALF_LENGTH, COURT_WIDTH, lineThickness);
    drawLine(0, -HALF_LENGTH, COURT_WIDTH, lineThickness);

    // Center line
    drawLine(0, 0, COURT_WIDTH, lineThickness);

    // Center circle
    drawCircleLine(group, 0, 0, CENTER_CIRCLE_RADIUS, lineHeight, lineMat, lineThickness);

    for (const side of [-1, 1]) {
        const baselineZ = side * HALF_LENGTH;

        drawLine(-HALF_KEY, baselineZ - side * KEY_LENGTH / 2, lineThickness, KEY_LENGTH);
        drawLine(HALF_KEY, baselineZ - side * KEY_LENGTH / 2, lineThickness, KEY_LENGTH);
        drawLine(0, baselineZ - side * KEY_LENGTH, KEY_WIDTH, lineThickness);

        drawCircleLine(group, 0, baselineZ - side * KEY_LENGTH, FT_CIRCLE_RADIUS, lineHeight, lineMat, lineThickness);
        drawThreePointArc(group, side, lineHeight, lineMat, lineThickness);
        drawRestrictedArea(group, side, lineHeight, lineMat, lineThickness);

        const blockPositions = [1.0, 2.0, 3.0, 3.6];
        for (const offset of blockPositions) {
            drawLine(-HALF_KEY - 0.15, baselineZ - side * offset, 0.3, lineThickness);
            drawLine(HALF_KEY + 0.15, baselineZ - side * offset, 0.3, lineThickness);
        }
    }
}

function drawCircleLine(group, cx, cz, radius, y, material, thickness) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + thickness / 2, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, radius - thickness / 2, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    group.add(mesh);
}

function drawThreePointArc(group, side, y, material, thickness) {
    const baselineZ = side * HALF_LENGTH;
    const rimZ = baselineZ - side * RIM_FROM_BASELINE;
    const straightLength = THREE_PT_STRAIGHT;

    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(thickness, straightLength), material);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-THREE_PT_CORNER, y, baselineZ - side * straightLength / 2);
    group.add(leftLine);

    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(thickness, straightLength), material);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(THREE_PT_CORNER, y, baselineZ - side * straightLength / 2);
    group.add(rightLine);

    const arcShape = new THREE.Shape();
    const startAngle = Math.asin(THREE_PT_CORNER / THREE_PT_RADIUS);

    if (side === 1) {
        arcShape.absarc(0, 0, THREE_PT_RADIUS + thickness / 2, Math.PI + startAngle, -startAngle, false);
        const inner = new THREE.Path();
        inner.absarc(0, 0, THREE_PT_RADIUS - thickness / 2, -startAngle, Math.PI + startAngle, true);
        arcShape.holes.push(inner);
    } else {
        arcShape.absarc(0, 0, THREE_PT_RADIUS + thickness / 2, startAngle, Math.PI - startAngle, false);
        const inner = new THREE.Path();
        inner.absarc(0, 0, THREE_PT_RADIUS - thickness / 2, Math.PI - startAngle, startAngle, true);
        arcShape.holes.push(inner);
    }

    const arcMesh = new THREE.Mesh(new THREE.ShapeGeometry(arcShape, 64), material);
    arcMesh.rotation.x = -Math.PI / 2;
    arcMesh.position.set(0, y, rimZ);
    group.add(arcMesh);
}

function drawRestrictedArea(group, side, y, material, thickness) {
    const baselineZ = side * HALF_LENGTH;
    const rimZ = baselineZ - side * RIM_FROM_BASELINE;
    const restrictedRadius = 1.22;

    const arcShape = new THREE.Shape();
    if (side === 1) {
        arcShape.absarc(0, 0, restrictedRadius + thickness / 2, Math.PI, 2 * Math.PI, false);
        const inner = new THREE.Path();
        inner.absarc(0, 0, restrictedRadius - thickness / 2, 2 * Math.PI, Math.PI, true);
        arcShape.holes.push(inner);
    } else {
        arcShape.absarc(0, 0, restrictedRadius + thickness / 2, 0, Math.PI, false);
        const inner = new THREE.Path();
        inner.absarc(0, 0, restrictedRadius - thickness / 2, Math.PI, 0, true);
        arcShape.holes.push(inner);
    }

    const arcMesh = new THREE.Mesh(new THREE.ShapeGeometry(arcShape, 32), material);
    arcMesh.rotation.x = -Math.PI / 2;
    arcMesh.position.set(0, y, rimZ);
    group.add(arcMesh);
}

// ─── Court Details (heavy wear, shoe marks, gum, stains) ────
function createCourtDetails(group) {
    // Worn patches — larger, more visible
    const wornMat = new THREE.MeshStandardMaterial({
        color: 0x333330,
        roughness: 0.98,
        transparent: true,
        opacity: 0.25
    });

    const wornPositions = [
        [0, 0, 2.5], [0, -10, 2.0], [0, 10, 2.0],
        [-3, -12, 1.8], [3, -12, 1.8], [-3, 12, 1.8], [3, 12, 1.8],
        [-5, -8, 1.5], [5, 8, 1.5], [0, -13, 1.5], [0, 13, 1.5],
        [-6, 0, 1.2], [6, 0, 1.2],
    ];

    for (const [x, z, baseSize] of wornPositions) {
        const size = baseSize + Math.random() * 1.0;
        const worn = new THREE.Mesh(new THREE.CircleGeometry(size, 16), wornMat);
        worn.rotation.x = -Math.PI / 2;
        worn.position.set(x, 0.073, z);
        group.add(worn);
    }

    // Shoe scuff marks
    const scuffMat = new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.12
    });
    for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * COURT_WIDTH * 0.9;
        const z = (Math.random() - 0.5) * COURT_LENGTH * 0.9;
        const scuff = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3 + Math.random() * 0.5, 0.05 + Math.random() * 0.08),
            scuffMat
        );
        scuff.rotation.x = -Math.PI / 2;
        scuff.rotation.z = Math.random() * Math.PI;
        scuff.position.set(x, 0.074, z);
        group.add(scuff);
    }

    // Gum spots
    const gumMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.6,
        metalness: 0.1
    });
    for (let i = 0; i < 8; i++) {
        const x = (Math.random() - 0.5) * COURT_WIDTH;
        const z = (Math.random() - 0.5) * COURT_LENGTH;
        const gum = new THREE.Mesh(new THREE.CircleGeometry(0.02 + Math.random() * 0.03, 6), gumMat);
        gum.rotation.x = -Math.PI / 2;
        gum.position.set(x, 0.075, z);
        group.add(gum);
    }
}

// ─── Graffiti & Street Art ──────────────────────────────────
function createGraffiti(group) {
    const graffitiHeight = 0.076;

    // Court center graffiti — large tag
    createGraffitiTag(group, 0, graffitiHeight, 0, 6, 3, drawCenterCourtGraffiti);

    // Asphalt side tags
    createGraffitiTag(group, -8.5, graffitiHeight, -5, 3, 1.5, drawSideTag1);
    createGraffitiTag(group, 8, graffitiHeight, 8, 2.5, 1.5, drawSideTag2);

    // Key area tags
    createGraffitiTag(group, 0, graffitiHeight, 12.5, 3.5, 1.5, drawKeyTag);
    createGraffitiTag(group, 0, graffitiHeight, -12.5, 3.5, 1.5, drawKeyTag2);

    // Fence-area ground tags (outside court)
    createGraffitiTag(group, -9, graffitiHeight, -17, 2.5, 1.2, drawSmallTag);
    createGraffitiTag(group, 7, graffitiHeight, 18, 2, 1, drawTinyTag);
}

function createGraffitiTag(group, x, y, z, width, height, drawFunc) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.clearRect(0, 0, 512, 256);

    drawFunc(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.premultiplyAlpha = true;

    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    group.add(mesh);
}

function drawCenterCourtGraffiti(ctx) {
    // "HR" in big bold dripping graffiti style
    ctx.save();

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.font = 'bold 140px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HR', 259, 132);

    // Main text — red with orange highlight
    ctx.fillStyle = 'rgba(180, 30, 30, 0.55)';
    ctx.fillText('HR', 256, 128);

    // Outline
    ctx.strokeStyle = 'rgba(220, 60, 20, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeText('HR', 256, 128);

    // Inner highlight
    ctx.fillStyle = 'rgba(255, 120, 40, 0.25)';
    ctx.font = 'bold 130px Impact, sans-serif';
    ctx.fillText('HR', 256, 128);

    // Drips
    ctx.fillStyle = 'rgba(180, 30, 30, 0.3)';
    const dripXs = [190, 210, 260, 290, 310];
    for (const dx of dripXs) {
        const dripLen = 20 + Math.random() * 40;
        ctx.fillRect(dx, 180, 3, dripLen);
    }

    // Subtext
    ctx.fillStyle = 'rgba(255, 200, 50, 0.35)';
    ctx.font = 'bold 22px Impact, sans-serif';
    ctx.fillText('HOOPS ROYALE', 256, 230);

    ctx.restore();
}

function drawSideTag1(ctx) {
    ctx.fillStyle = 'rgba(50, 100, 200, 0.35)';
    ctx.font = 'bold italic 60px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BKLYN', 256, 110);

    ctx.strokeStyle = 'rgba(30, 60, 150, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeText('BKLYN', 256, 110);

    // Crown
    ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
    ctx.font = 'bold 30px serif';
    ctx.fillText('\u2654', 256, 55);
}

function drawSideTag2(ctx) {
    ctx.fillStyle = 'rgba(200, 50, 200, 0.3)';
    ctx.font = 'bold 50px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KING\u2019S', 256, 90);
    ctx.fillText('COURT', 256, 150);

    ctx.strokeStyle = 'rgba(150, 20, 150, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeText('KING\u2019S', 256, 90);
    ctx.strokeText('COURT', 256, 150);
}

function drawKeyTag(ctx) {
    ctx.fillStyle = 'rgba(255, 100, 30, 0.3)';
    ctx.font = 'bold 45px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO EASY', 256, 90);
    ctx.fillText('BUCKETS', 256, 145);
}

function drawKeyTag2(ctx) {
    // Skull-ish icon and "RUN IT" text
    ctx.fillStyle = 'rgba(100, 220, 100, 0.3)';
    ctx.font = 'bold 55px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RUN IT', 256, 100);

    ctx.strokeStyle = 'rgba(60, 180, 60, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeText('RUN IT', 256, 100);

    ctx.fillStyle = 'rgba(100, 220, 100, 0.2)';
    ctx.font = 'bold 25px Impact, sans-serif';
    ctx.fillText('BACK', 256, 145);
}

function drawSmallTag(ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 40px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CB', 256, 100);

    // Stars
    ctx.fillStyle = 'rgba(255, 200, 50, 0.2)';
    ctx.font = '20px serif';
    ctx.fillText('\u2605 \u2605 \u2605', 256, 150);
}

function drawTinyTag(ctx) {
    ctx.fillStyle = 'rgba(255, 50, 50, 0.25)';
    ctx.font = 'bold italic 35px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT UP', 256, 128);
}
