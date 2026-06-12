// NEON EXODUS — enemy types, AI, projectiles, boss
const Enemies = (() => {
  const list = [];
  const bolts = [];

  const TYPES = {
    stalker: { hp: 50,  speed: 6.5, radius: 0.7, dmg: 12, attackRange: 1.8, attackRate: 0.9,
               color: 0xff3344, score: 100, build: buildStalker },
    swarmer: { hp: 18,  speed: 9.5, radius: 0.45, dmg: 6,  attackRange: 1.4, attackRate: 0.6,
               color: 0xffaa00, score: 60, build: buildSwarmer },
    watcher: { hp: 70,  speed: 4.0, radius: 0.8, dmg: 10, attackRange: 26,  attackRate: 1.6, ranged: true, hover: 2.6, keepDist: 14,
               color: 0x44aaff, score: 150, build: buildWatcher },
    brute:   { hp: 220, speed: 3.2, radius: 1.2, dmg: 28, attackRange: 2.6, attackRate: 1.4,
               color: 0xbb44ff, score: 300, build: buildBrute },
    warden:  { hp: 1600, speed: 2.6, radius: 2.2, dmg: 30, attackRange: 30, attackRate: 2.2, ranged: true, hover: 3.2, keepDist: 12, boss: true,
               color: 0xff2255, score: 2000, build: buildWarden },
  };

  function glowMat(color) { return new THREE.MeshBasicMaterial({ color }); }
  function bodyMat(color) {
    return new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.5, metalness: 0.7, emissive: color, emissiveIntensity: 0.25 });
  }

  function buildStalker(c) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), bodyMat(c));
    torso.position.y = 1.0;
    torso.scale.y = 1.5;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glowMat(c));
    eye.position.set(0, 1.45, 0.4);
    const blades = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 4), glowMat(c));
    blades.position.y = 1.0;
    blades.rotation.x = Math.PI / 2;
    g.add(torso, eye, blades);
    g.userData.spin = blades;
    return g;
  }

  function buildSwarmer(c) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4), bodyMat(c));
    core.position.y = 0.7;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), glowMat(c));
    eye.position.set(0, 0.7, 0.3);
    g.add(core, eye);
    g.userData.spin = core;
    return g;
  }

  function buildWatcher(c) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), bodyMat(c));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), glowMat(c));
    iris.position.z = 0.35;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 20), glowMat(c));
    g.add(shell, iris, ring);
    g.userData.spin = ring;
    return g;
  }

  function buildBrute(c) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.1), bodyMat(c));
    body.position.y = 1.3;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), bodyMat(c));
    head.position.y = 2.45;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.2), glowMat(c));
    visor.position.set(0, 2.45, 0.3);
    const fistL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bodyMat(c));
    fistL.position.set(-1.1, 1.0, 0);
    const fistR = fistL.clone();
    fistR.position.x = 1.1;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.1), glowMat(c));
    chest.position.set(0, 1.5, 0.58);
    g.add(body, head, visor, fistL, fistR, chest);
    return g;
  }

  function buildWarden(c) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), bodyMat(c));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), glowMat(c));
    eye.position.z = 1.1;
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 32), glowMat(c));
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.08, 6, 32), glowMat(0xffaa00));
    r2.rotation.x = Math.PI / 3;
    g.add(core, eye, r1, r2);
    g.userData.spin = r1;
    g.userData.spin2 = r2;
    const light = new THREE.PointLight(c, 1.2, 25);
    g.add(light);
    return g;
  }

  function spawn(type, x, z) {
    const T = TYPES[type];
    const mesh = T.build(T.color);
    mesh.position.set(x, 0, z);
    const baseY = T.hover || 0;
    World.scene.add(mesh);
    list.push({
      type, T, mesh, hp: T.hp, maxHp: T.hp, baseY,
      attackCd: 1 + Math.random(), hitFlash: 0, wobble: Math.random() * 10,
      strafeDir: Math.random() < 0.5 ? 1 : -1, strafeT: 0,
    });
  }

  function spawnAtEdge(type, playerPos) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = World.ARENA * 0.82;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const dx = x - playerPos.x, dz = z - playerPos.z;
      if (dx * dx + dz * dz > 400) { spawn(type, x, z); return; }
    }
    spawn(type, World.ARENA * 0.8, 0);
  }

  function fireBolt(from, target, dmg, color, speed) {
    const dir = new THREE.Vector3().subVectors(target, from).normalize();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), glowMat(color || 0xff6622));
    m.position.copy(from);
    World.scene.add(m);
    bolts.push({ mesh: m, vel: dir.multiplyScalar(speed || 16), dmg, age: 0 });
    Sfx.enemyShot();
  }

  function update(dt, player, onPlayerHit) {
    const pPos = player.position;
    for (const e of list) {
      const m = e.mesh;
      e.wobble += dt;
      e.attackCd -= dt;
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        const f = e.hitFlash > 0 ? 2 : 0.25;
        m.traverse(o => { if (o.material && o.material.emissive) o.material.emissiveIntensity = f; });
      }
      if (m.userData.spin) m.userData.spin.rotation.z += dt * 5;
      if (m.userData.spin2) m.userData.spin2.rotation.z -= dt * 3;

      const toP = new THREE.Vector3(pPos.x - m.position.x, 0, pPos.z - m.position.z);
      const dist = toP.length();
      toP.normalize();
      m.lookAt(pPos.x, m.position.y, pPos.z);

      let mv = new THREE.Vector3();
      if (e.T.ranged) {
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = 1.5 + Math.random() * 2; }
        const side = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(e.strafeDir);
        if (dist > e.T.keepDist + 3) mv.add(toP);
        else if (dist < e.T.keepDist - 3) mv.sub(toP);
        mv.add(side.multiplyScalar(0.7)).normalize();
      } else {
        mv.copy(toP);
      }
      const next = { x: m.position.x + mv.x * e.T.speed * dt, z: m.position.z + mv.z * e.T.speed * dt };
      World.collide(next, e.T.radius);
      m.position.x = next.x;
      m.position.z = next.z;
      m.position.y = e.baseY + (e.T.hover ? Math.sin(e.wobble * 2) * 0.3 : 0);

      for (const o of list) {
        if (o === e) continue;
        const dx = m.position.x - o.mesh.position.x, dz = m.position.z - o.mesh.position.z;
        const min = e.T.radius + o.T.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 0.001) {
          const d = Math.sqrt(d2);
          m.position.x += (dx / d) * (min - d) * 0.5;
          m.position.z += (dz / d) * (min - d) * 0.5;
        }
      }

      if (e.attackCd <= 0 && dist < e.T.attackRange) {
        e.attackCd = e.T.attackRate;
        if (e.T.ranged) {
          const from = m.position.clone();
          from.y = e.baseY + 0.5;
          const tgt = new THREE.Vector3(pPos.x, 1.5, pPos.z);
          if (e.T.boss) {
            for (let i = -1; i <= 1; i++) {
              const t2 = tgt.clone();
              t2.x += i * 3; t2.z += i * 3 * Math.sign(toP.x || 1);
              fireBolt(from, t2, e.T.dmg, 0xff2255, 18);
            }
            if (Math.random() < 0.4 && list.length < 14) {
              spawnAtEdge('swarmer', pPos);
              spawnAtEdge('swarmer', pPos);
              Sfx.bossRoar();
            }
          } else {
            fireBolt(from, tgt, e.T.dmg, 0x44aaff, 16);
          }
        } else {
          onPlayerHit(e.T.dmg);
          World.burst(new THREE.Vector3(pPos.x, 1.2, pPos.z), 0xff4444, 8, 4, 0.4);
        }
      }
    }

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.age += dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const dx = b.mesh.position.x - pPos.x, dy = b.mesh.position.y - 1.4, dz = b.mesh.position.z - pPos.z;
      let dead = b.age > 4;
      if (dx * dx + dy * dy + dz * dz < 0.9) {
        onPlayerHit(b.dmg);
        dead = true;
      }
      if (Math.abs(b.mesh.position.x) > World.ARENA || Math.abs(b.mesh.position.z) > World.ARENA) dead = true;
      if (dead) {
        World.scene.remove(b.mesh);
        b.mesh.geometry.dispose(); b.mesh.material.dispose();
        bolts.splice(i, 1);
      }
    }
  }

  function damage(e, dmg, hitPoint) {
    e.hp -= dmg;
    e.hitFlash = 0.08;
    World.burst(hitPoint, e.T.color, 6, 5, 0.35, 0.12);
    if (e.hp <= 0) {
      kill(e);
      return true;
    }
    return false;
  }

  function kill(e) {
    const pos = e.mesh.position.clone();
    pos.y += 0.8;
    World.burst(pos, e.T.color, e.T.boss ? 80 : 24, e.T.boss ? 14 : 8, e.T.boss ? 1.6 : 0.8, 0.2);
    World.burst(pos, 0xffffff, 10, 6, 0.5, 0.1);
    Sfx.kill();
    if (e.T.boss) Sfx.explode();
    disposeEnemy(e);
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
    const roll = Math.random();
    if (e.T.boss) { /* boss drops nothing; game ends */ }
    else if (roll < 0.18) World.spawnPickup('health', pos);
    else if (roll < 0.40) World.spawnPickup('ammo', pos);
  }

  function disposeEnemy(e) {
    World.scene.remove(e.mesh);
    e.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  function raycast(origin, dir, maxDist) {
    const hits = [];
    const v = new THREE.Vector3();
    for (const e of list) {
      const center = e.mesh.position.clone();
      center.y += e.T.hover ? 0 : (e.T.radius + 0.4);
      v.subVectors(center, origin);
      const t = v.dot(dir);
      if (t < 0 || t > maxDist) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      const r = e.T.radius + 0.35;
      if (closest.distanceToSquared(center) < r * r) hits.push({ e, t, point: closest });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  function explodeAt(point, radius, dmg) {
    World.burst(point, 0xffaa33, 40, 12, 0.9, 0.22);
    Sfx.explode();
    let kills = 0;
    // copy first — kill() mutates list
    [...list].forEach(e => {
      const d = e.mesh.position.distanceTo(point);
      if (d < radius) {
        const fall = 1 - d / radius;
        if (damage(e, dmg * (0.4 + 0.6 * fall), e.mesh.position.clone().setY(1))) kills++;
      }
    });
    return kills;
  }

  function clear() {
    list.forEach(disposeEnemy);
    list.length = 0;
    bolts.forEach(b => { World.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
    bolts.length = 0;
  }

  return { list, TYPES, spawn, spawnAtEdge, update, damage, raycast, explodeAt, clear };
})();
