import * as THREE from 'three';

// City surrounds the park on all sides — buildings, sidewalks, streets, cars, etc.
const PARK_RADIUS = 55; // park grass extends ~100x100, city starts beyond
const BLOCK_SIZE = 12;
const STREET_WIDTH = 6;

export function createCity(scene) {
    const cityGroup = new THREE.Group();
    cityGroup.name = 'city';

    createSidewalks(cityGroup);
    createStreets(cityGroup);
    createCityBlocks(cityGroup);
    createStreetProps(cityGroup);
    createParkedCars(cityGroup);

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
    const parkEdge = 52;
    const sidewalkWidth = 3.5;

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

    const outerEdge = 55.5;
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
}

function addLaneMarkings(group, streetX, streetZ, streetW, streetL) {
    const markMat = new THREE.MeshBasicMaterial({ color: 0xddcc44 });
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
            markMat
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
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    for (const edgeOffset of [-1, 1]) {
        const edgeLine = new THREE.Mesh(
            new THREE.PlaneGeometry(
                isHorizontal ? length : 0.08,
                isHorizontal ? 0.08 : length
            ),
            edgeMat
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

// ─── City Blocks (buildings) ────────────────────────────────
function createCityBlocks(group) {
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
        const { xRange, zRange } = side;

        // Place buildings in a grid pattern with variation
        for (let x = xRange[0]; x < xRange[1]; x += BLOCK_SIZE + 2) {
            for (let z = zRange[0]; z < zRange[1]; z += BLOCK_SIZE + 2) {
                if (Math.random() < 0.15) continue; // occasional empty lot

                const bWidth = 6 + Math.random() * 8;
                const bDepth = 6 + Math.random() * 8;
                const bHeight = 8 + Math.random() * 35;

                // Closer buildings are shorter (zoning feel)
                const distFromPark = Math.sqrt(x * x + z * z) - cityStart;
                const heightMult = 0.4 + (distFromPark / 50) * 0.8;

                const finalHeight = bHeight * heightMult;
                const colorIdx = Math.floor(Math.random() * buildingColors.length);

                createBuilding(group, x + Math.random() * 3, z + Math.random() * 3,
                    bWidth, bDepth, finalHeight, buildingColors[colorIdx]);
            }
        }
    }
}

function createBuilding(group, x, z, width, depth, height, color) {
    const building = new THREE.Group();

    // Main structure
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.75,
        metalness: 0.1
    });

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        bodyMat
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    // Windows (grid of emissive rectangles on front faces)
    addBuildingWindows(building, width, depth, height, x, z);

    // Roof details
    if (Math.random() > 0.5) {
        // Water tower (NYC style)
        if (height > 20 && Math.random() > 0.6) {
            addWaterTower(building, height, width, depth);
        }
        // AC units
        if (Math.random() > 0.4) {
            const acCount = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < acCount; i++) {
                const ac = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2, 0.8, 1.0),
                    new THREE.MeshStandardMaterial({ color: 0x667766, roughness: 0.6, metalness: 0.4 })
                );
                ac.position.set(
                    (Math.random() - 0.5) * (width - 2),
                    height + 0.4,
                    (Math.random() - 0.5) * (depth - 2)
                );
                ac.castShadow = true;
                building.add(ac);
            }
        }
    }

    // Cornice / ledge at top
    const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.85), roughness: 0.8 })
    );
    cornice.position.y = height;
    building.add(cornice);

    // Ground floor awning (some buildings)
    if (Math.random() > 0.6) {
        const awningColor = [0xcc3333, 0x336633, 0x334488, 0x884422][Math.floor(Math.random() * 4)];
        const awning = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.8, 0.08, 1.5),
            new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.7 })
        );
        awning.position.set(0, 3.2, depth / 2 + 0.7);
        building.add(awning);
    }

    building.position.set(x, 0, z);
    group.add(building);
}

function addBuildingWindows(building, width, depth, height, bx, bz) {
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc,
        emissive: 0x334455,
        emissiveIntensity: 0.15,
        roughness: 0.1,
        metalness: 0.6
    });
    const litWindowMat = new THREE.MeshStandardMaterial({
        color: 0xffeebb,
        emissive: 0xffcc66,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.1
    });

    const windowW = 0.8;
    const windowH = 1.2;
    const floorHeight = 3.2;
    const floors = Math.floor(height / floorHeight);
    const windowsPerFloor = Math.max(1, Math.floor(width / 2.5));

    // Front and back faces
    for (const zSide of [-1, 1]) {
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < windowsPerFloor; w++) {
                const wx = -width / 2 + (w + 0.5) * (width / windowsPerFloor);
                const wy = floor * floorHeight + windowH / 2 + 0.5;
                const wz = zSide * (depth / 2 + 0.01);

                const isLit = Math.random() > 0.6;
                const win = new THREE.Mesh(
                    new THREE.PlaneGeometry(windowW, windowH),
                    isLit ? litWindowMat : windowMat
                );
                win.position.set(wx, wy, wz);
                if (zSide === -1) win.rotation.y = Math.PI;
                building.add(win);
            }
        }
    }

    // Side faces
    const sideWindowsPerFloor = Math.max(1, Math.floor(depth / 2.5));
    for (const xSide of [-1, 1]) {
        for (let floor = 1; floor < floors; floor++) {
            for (let w = 0; w < sideWindowsPerFloor; w++) {
                const wz = -depth / 2 + (w + 0.5) * (depth / sideWindowsPerFloor);
                const wy = floor * floorHeight + windowH / 2 + 0.5;
                const wx = xSide * (width / 2 + 0.01);

                const isLit = Math.random() > 0.6;
                const win = new THREE.Mesh(
                    new THREE.PlaneGeometry(windowW, windowH),
                    isLit ? litWindowMat : windowMat
                );
                win.position.set(wx, wy, wz);
                win.rotation.y = xSide * Math.PI / 2;
                building.add(win);
            }
        }
    }
}

function addWaterTower(building, height, bWidth, bDepth) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });

    const tower = new THREE.Group();

    // Tank
    const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.3, 2.5, 10),
        woodMat
    );
    tank.position.y = 3.5;
    tank.castShadow = true;
    tower.add(tank);

    // Cone roof
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 1.0, 10),
        woodMat
    );
    roof.position.y = 5.2;
    tower.add(roof);

    // Legs
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4),
            metalMat
        );
        leg.position.set(Math.cos(angle) * 1.0, 1.25, Math.sin(angle) * 1.0);
        tower.add(leg);
    }

    // Metal bands
    for (const y of [3.0, 3.8, 4.5]) {
        const band = new THREE.Mesh(
            new THREE.TorusGeometry(1.25, 0.04, 4, 16),
            metalMat
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
    const outerEdge = 55.5;

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
    const outerEdge = 55.5;
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
