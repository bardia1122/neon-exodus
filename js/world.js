// NEON EXODUS — scene, arena, particles, pickups
const World = (() => {
  const ARENA = 46;          // half-size of square arena
  let scene, renderer, camera;
  const obstacles = [];      // {x, z, r} collision cylinders
  const themed = [];
  let trimMat, pillarGlowMat, fogColor;

  const SECTOR_THEMES = [
    { trim: 0x00ffd0, fog: 0x020608, name: 'HANGAR BAY' },
    { trim: 0x55ff44, fog: 0x021004, name: 'HYDROPONICS' },
    { trim: 0xff8800, fog: 0x0c0502, name: 'REACTOR CORE' },
    { trim: 0xbb44ff, fog: 0x070210, name: 'DATA SPIRE' },
    { trim: 0xff2244, fog: 0x0e0204, name: 'DOCKING RING' },
  ];

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    scene = new THREE.Scene();
    fogColor = new THREE.Color(0x020608);
    scene.background = fogColor;
    scene.fog = new THREE.FogExp2(0x020608, 0.022);

    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
    camera.position.set(0, 1.7, 0);

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    buildArena();
    buildLights();
    return { scene, camera, renderer };
  }

  function buildArena() {
    trimMat = new THREE.MeshBasicMaterial({ color: 0x00ffd0 });
    pillarGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ffd0 });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.85, metalness: 0.4 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA * 2, 23, 0x00ffd0, 0x063a38);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);
    themed.push(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.7, metalness: 0.5 });
    const wallGeo = new THREE.BoxGeometry(ARENA * 2 + 2, 8, 1);
    [[0, -ARENA, 0], [0, ARENA, 0], [-ARENA, 0, Math.PI / 2], [ARENA, 0, Math.PI / 2]].forEach(([x, z, ry]) => {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x, 4, z);
      w.rotation.y = ry;
      scene.add(w);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2 + 2, 0.18, 1.06), trimMat);
      strip.position.set(x, 6.5, z);
      strip.rotation.y = ry;
      scene.add(strip);
    });

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.6, metalness: 0.6 });
    const spots = [
      [-22, -22], [22, -22], [-22, 22], [22, 22],
      [0, -30], [0, 30], [-30, 0], [30, 0],
      [-12, 8], [12, -8], [14, 16], [-14, -16],
    ];
    spots.forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 9, 8), pillarMat);
      p.position.set(x, 4.5, z);
      scene.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.09, 6, 18), pillarGlowMat);
      ring.position.set(x, 2.2, z);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      obstacles.push({ x, z, r: 2.0 });
    });

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.8, metalness: 0.3 });
    for (let i = 0; i < 14; i++) {
      const s = 1.4 + Math.random() * 1.4;
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 30;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      c.position.set(x, s / 2, z);
      c.rotation.y = Math.random() * Math.PI;
      scene.add(c);
      obstacles.push({ x, z, r: s * 0.8 });
    }

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(60, 2.5, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x0a2030, fog: false })
    );
    halo.position.y = 40;
    halo.rotation.x = Math.PI / 2.3;
    scene.add(halo);
  }

  function buildLights() {
    scene.add(new THREE.HemisphereLight(0x224455, 0x080a10, 0.9));
    const key = new THREE.PointLight(0x66ddff, 0.8, 120);
    key.position.set(0, 14, 0);
    scene.add(key);
    [[-30, -30], [30, 30], [-30, 30], [30, -30]].forEach(([x, z]) => {
      const l = new THREE.PointLight(0xff8855, 0.35, 60);
      l.position.set(x, 8, z);
      scene.add(l);
    });
  }

  function setSector(i) {
    const t = SECTOR_THEMES[Math.min(i, SECTOR_THEMES.length - 1)];
    trimMat.color.setHex(t.trim);
    pillarGlowMat.color.setHex(t.trim);
    fogColor.setHex(t.fog);
    scene.fog.color.setHex(t.fog);
    themed.forEach(m => {
      if (m.material && m.material.color) m.material.color.setHex(t.trim);
    });
    return t.name;
  }

  // mutates pos {x,z}
  function collide(pos, radius) {
    const lim = ARENA - 1 - radius;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
    for (const o of obstacles) {
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const min = o.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = o.x + (dx / d) * min;
        pos.z = o.z + (dz / d) * min;
      }
    }
  }

  const particles = [];
  function burst(pos, color, count, speed, life, size) {
    const geo = new THREE.BufferGeometry();
    const n = count || 12;
    const positions = new Float32Array(n * 3);
    const vels = [];
    for (let i = 0; i < n; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5)
        .normalize().multiplyScalar((speed || 6) * (0.4 + Math.random() * 0.6));
      vels.push(v);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: size || 0.18, transparent: true, opacity: 1 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particles.push({ pts, vels, life: life || 0.6, age: 0 });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        scene.remove(p.pts);
        p.pts.geometry.dispose();
        p.pts.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      const arr = p.pts.geometry.attributes.position.array;
      for (let j = 0; j < p.vels.length; j++) {
        const v = p.vels[j];
        v.y -= 9 * dt;
        arr[j * 3] += v.x * dt;
        arr[j * 3 + 1] += v.y * dt;
        arr[j * 3 + 2] += v.z * dt;
        if (arr[j * 3 + 1] < 0.05) { arr[j * 3 + 1] = 0.05; v.y *= -0.3; }
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
      p.pts.material.opacity = 1 - p.age / p.life;
    }
  }

  const pickups = [];
  function spawnPickup(kind, pos) {  // kind: 'health' | 'ammo'
    const color = kind === 'health' ? 0x33ff88 : 0xffaa22;
    const geo = kind === 'health'
      ? new THREE.OctahedronGeometry(0.42)
      : new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.set(pos.x, 0.8, pos.z);
    scene.add(m);
    const l = new THREE.PointLight(color, 0.6, 5);
    l.position.copy(m.position);
    scene.add(l);
    pickups.push({ kind, mesh: m, light: l, age: 0 });
  }

  function updatePickups(dt, playerPos, onPickup) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.age += dt;
      p.mesh.rotation.y += dt * 2.5;
      p.mesh.position.y = 0.8 + Math.sin(p.age * 3) * 0.15;
      const dx = playerPos.x - p.mesh.position.x, dz = playerPos.z - p.mesh.position.z;
      const expired = p.age > 25;
      if (expired || dx * dx + dz * dz < 1.7) {
        if (!expired) onPickup(p.kind);
        scene.remove(p.mesh); scene.remove(p.light);
        p.mesh.geometry.dispose(); p.mesh.material.dispose();
        pickups.splice(i, 1);
      }
    }
  }

  function clearPickups() {
    pickups.forEach(p => { scene.remove(p.mesh); scene.remove(p.light); });
    pickups.length = 0;
  }

  return {
    init, setSector, collide, burst, updateParticles,
    spawnPickup, updatePickups, clearPickups,
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    obstacles, ARENA, SECTOR_THEMES,
  };
})();
