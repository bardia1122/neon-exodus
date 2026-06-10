// NEON EXODUS — weapon definitions, firing, viewmodel, tracers
const Weapons = (() => {
  const DEFS = [
    { id: 0, key: '1', name: 'PULSE PISTOL', auto: false, dmg: 22, rate: 0.28, pellets: 1, spread: 0.012,
      mag: Infinity, reserve: Infinity, reload: 0, sfx: 'pistol', tracer: 0x66ffee, kick: 0.018,
      unlockText: null },
    { id: 1, key: '2', name: 'SCATTER COIL', auto: false, dmg: 11, rate: 0.85, pellets: 8, spread: 0.075,
      mag: 6, reserve: 30, reload: 1.4, sfx: 'shotgun', tracer: 0x88ff44, kick: 0.06,
      unlockText: 'SCATTER COIL ACQUIRED — magnetic flechette storm. Hold them close.' },
    { id: 2, key: '3', name: 'RIPPER SMG', auto: true, dmg: 9, rate: 0.085, pellets: 1, spread: 0.035,
      mag: 36, reserve: 144, reload: 1.6, sfx: 'smg', tracer: 0xffcc44, kick: 0.012,
      unlockText: 'RIPPER SMG ACQUIRED — 700rpm of recycled hull plating.' },
    { id: 3, key: '4', name: 'ARC RAILGUN', auto: false, dmg: 95, rate: 1.1, pellets: 1, spread: 0.0,
      mag: 4, reserve: 20, reload: 1.9, sfx: 'railgun', tracer: 0xcc66ff, kick: 0.09, pierce: true,
      unlockText: 'ARC RAILGUN ACQUIRED — pierces everything in a line. Including walls’ feelings.' },
    { id: 4, key: '5', name: 'SUNLANCE', auto: false, dmg: 70, rate: 1.0, pellets: 1, spread: 0.0,
      mag: 3, reserve: 12, reload: 2.2, sfx: 'sunlance', tracer: 0xffee66, kick: 0.1, explosive: 4.5,
      unlockText: 'SUNLANCE ACQUIRED — a fragment of the reactor, weaponized. End this.' },
  ];

  let current = 0;
  const owned = [true, false, false, false, false];
  const state = DEFS.map(d => ({ mag: d.mag, reserve: d.reserve, cooldown: 0, reloading: 0 }));
  let viewmodel = null, muzzleFlash = null, bobT = 0;
  const tracers = [];

  function buildViewmodel(camera) {
    viewmodel = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x222a33, roughness: 0.4, metalness: 0.8 })
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, metalness: 0.9 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.3;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.02, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x66ffee })
    );
    glow.position.y = 0.07;
    viewmodel.add(body, barrel, glow);
    viewmodel.userData.glow = glow;

    muzzleFlash = new THREE.PointLight(0xffcc66, 0, 6);
    muzzleFlash.position.set(0, 0, -0.55);
    viewmodel.add(muzzleFlash);

    viewmodel.position.set(0.28, -0.24, -0.55);
    camera.add(viewmodel);
  }

  function def() { return DEFS[current]; }
  function st() { return state[current]; }

  function unlock(id) {
    if (owned[id]) return false;
    owned[id] = true;
    switchTo(id);
    return true;
  }

  function switchTo(id) {
    if (!owned[id] || id === current) return;
    current = id;
    st().reloading = 0;
    if (viewmodel) {
      viewmodel.userData.glow.material.color.setHex(DEFS[id].tracer);
      viewmodel.position.y = -0.45; // raise animation
    }
  }

  function tryReload() {
    const d = def(), s = st();
    if (d.mag === Infinity || s.reloading > 0 || s.mag >= d.mag || s.reserve <= 0) return;
    s.reloading = d.reload;
    Sfx.reload();
  }

  // returns array of shot rays [{dir}] or null if couldn't fire
  function tryFire(camera) {
    const d = def(), s = st();
    if (s.cooldown > 0 || s.reloading > 0) return null;
    if (d.mag !== Infinity && s.mag <= 0) {
      Sfx.empty();
      tryReload();
      return null;
    }
    s.cooldown = d.rate;
    if (d.mag !== Infinity) s.mag--;
    Sfx[d.sfx]();
    muzzleFlash.color.setHex(d.tracer);
    muzzleFlash.intensity = 2.5;
    viewmodel.position.z = -0.45; // recoil push

    const shots = [];
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    for (let i = 0; i < d.pellets; i++) {
      const dir = fwd.clone();
      dir.x += (Math.random() - 0.5) * d.spread * 2;
      dir.y += (Math.random() - 0.5) * d.spread * 2;
      dir.z += (Math.random() - 0.5) * d.spread * 2;
      dir.normalize();
      shots.push(dir);
    }
    return shots;
  }

  function addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    World.scene.add(line);
    tracers.push({ line, age: 0, life: 0.12 });
  }

  function update(dt, camera, moving) {
    const s = st();
    if (s.cooldown > 0) s.cooldown -= dt;
    if (s.reloading > 0) {
      s.reloading -= dt;
      if (s.reloading <= 0) {
        const d = def();
        const need = d.mag - s.mag;
        const take = Math.min(need, s.reserve);
        s.mag += take;
        if (s.reserve !== Infinity) s.reserve -= take;
      }
    }
    // viewmodel bob + recover
    if (viewmodel) {
      bobT += dt * (moving ? 9 : 2);
      const targetY = -0.24 + Math.sin(bobT) * (moving ? 0.012 : 0.004);
      viewmodel.position.y += (targetY - viewmodel.position.y) * dt * 8;
      viewmodel.position.z += (-0.55 - viewmodel.position.z) * dt * 10;
      if (s.reloading > 0) viewmodel.rotation.x = Math.sin(s.reloading * 6) * 0.4;
      else viewmodel.rotation.x *= 1 - dt * 10;
    }
    if (muzzleFlash && muzzleFlash.intensity > 0) muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - dt * 22);

    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.age += dt;
      if (t.age >= t.life) {
        World.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        tracers.splice(i, 1);
      } else t.line.material.opacity = 0.9 * (1 - t.age / t.life);
    }
  }

  function addAmmo() {
    // refill 35% of reserve on every owned weapon
    DEFS.forEach((d, i) => {
      if (owned[i] && d.reserve !== Infinity) state[i].reserve = Math.min(d.reserve, state[i].reserve + Math.ceil(d.reserve * 0.35));
    });
  }

  function reset() {
    current = 0;
    DEFS.forEach((d, i) => { owned[i] = i === 0; state[i] = { mag: d.mag, reserve: d.reserve, cooldown: 0, reloading: 0 }; });
    if (viewmodel) viewmodel.userData.glow.material.color.setHex(DEFS[0].tracer);
  }

  return { DEFS, owned, state, buildViewmodel, def, st, unlock, switchTo, tryFire, tryReload, addTracer, update, addAmmo, reset,
    get current() { return current; } };
})();
