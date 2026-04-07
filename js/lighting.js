import * as THREE from 'three';

export function createLighting(scene) {
    const lightGroup = new THREE.Group();
    lightGroup.name = 'lighting';

    // ── Ambient Light ───────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x8899bb, 0.45);
    ambient.userData.lightRole = 'ambient';
    lightGroup.add(ambient);

    // ── Hemisphere Light ────────────────────────────────────
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a5a2a, 0.5);
    hemi.position.set(0, 50, 0);
    hemi.userData.lightRole = 'hemi';
    lightGroup.add(hemi);

    // ── Sun ─────────────────────────────────────────────────
    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(30, 35, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    sun.userData.lightRole = 'sun';
    lightGroup.add(sun);
    const sunTarget = new THREE.Object3D();
    sunTarget.position.set(0, 0, 0);
    lightGroup.add(sunTarget);
    sun.target = sunTarget;

    // ── Fill light ──────────────────────────────────────────
    const fill = new THREE.DirectionalLight(0xaabbdd, 0.35);
    fill.position.set(-25, 25, -15);
    fill.userData.lightRole = 'fill';
    lightGroup.add(fill);

    // ── Rim light ───────────────────────────────────────────
    const rimLight = new THREE.DirectionalLight(0xffaa55, 0.25);
    rimLight.position.set(-20, 10, -30);
    rimLight.userData.lightRole = 'rim';
    lightGroup.add(rimLight);

    // ── Court lamp post lights ──────────────────────────────
    // Match positions from park.js createLampPosts
    const lampPositions = [
        { x: -13.5, z: -14, facing: 1 },
        { x: -13.5, z: 14, facing: 1 },
        { x: 13.5, z: -14, facing: -1 },
        { x: 13.5, z: 14, facing: -1 },
        { x: -13.5, z: 0, facing: 1 },
        { x: 13.5, z: 0, facing: -1 },
    ];

    for (const { x, z, facing } of lampPositions) {
        // SpotLight aimed downward from lantern position
        const lanternX = x + facing * 1.4;
        const lanternY = 5.05;
        const spot = new THREE.SpotLight(0xffeebb, 0.5, 25, Math.PI / 3, 0.6, 1.5);
        spot.position.set(lanternX, lanternY, z);
        spot.target.position.set(lanternX, 0, z);
        // Keep night lighting smooth by avoiding six extra shadow-map passes.
        spot.castShadow = false;
        spot.userData.lightRole = 'lamppost';
        lightGroup.add(spot);
        lightGroup.add(spot.target);

        // Small warm point light for ambient glow around the lantern
        const glow = new THREE.PointLight(0xffeebb, 0.15, 12, 2);
        glow.position.set(lanternX, lanternY, z);
        glow.userData.lightRole = 'lamppost';
        lightGroup.add(glow);
    }

    // ── Moonlight ─────────────────────────────────────────
    const moon = new THREE.DirectionalLight(0x8888cc, 0.0);
    moon.position.set(-20, 40, -15);
    moon.userData.lightRole = 'moon';
    lightGroup.add(moon);
    const moonTarget = new THREE.Object3D();
    moonTarget.position.set(0, 0, 0);
    lightGroup.add(moonTarget);
    moon.target = moonTarget;

    scene.add(lightGroup);
    return lightGroup;
}
