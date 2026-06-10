// NEON EXODUS — first-person controller (pointer lock, movement, jumping)
const Player = (() => {
  const EYE = 1.7, RADIUS = 0.6;
  const WALK = 8.5, SPRINT = 13, JUMP = 7.5, GRAV = 22;

  const position = new THREE.Vector3(0, EYE, 8);
  let velY = 0, grounded = true;
  let yaw = 0, pitch = 0;   // yaw 0 faces -Z, toward arena center from spawn
  const keys = {};
  let firing = false;
  let hp = 100, maxHp = 100;
  let stepT = 0;
  let camera = null;

  function init(cam) {
    camera = cam;
    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'KeyR') Weapons.tryReload();
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (idx >= 0) Weapons.switchTo(idx);
    });
    document.addEventListener('keyup', e => keys[e.code] = false);
    document.addEventListener('mousedown', e => { if (e.button === 0) firing = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) firing = false; });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== document.body) return;
      yaw -= e.movementX * 0.0021;
      pitch -= e.movementY * 0.0021;
      pitch = Math.max(-1.45, Math.min(1.45, pitch));
    });
  }

  function lock() { document.body.requestPointerLock(); }
  function locked() { return document.pointerLockElement === document.body; }

  function update(dt) {
    // movement input in camera space
    let fx = 0, fz = 0;
    if (keys['KeyW']) fz += 1;
    if (keys['KeyS']) fz -= 1;
    if (keys['KeyA']) fx -= 1;
    if (keys['KeyD']) fx += 1;
    const moving = (fx !== 0 || fz !== 0);
    const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? SPRINT : WALK;

    if (moving) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      // forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      position.x += (-sin * fz + cos * fx) * speed * dt;
      position.z += (-cos * fz - sin * fx) * speed * dt;
      stepT -= dt;
      if (grounded && stepT <= 0) { Sfx.step(); stepT = speed === SPRINT ? 0.27 : 0.38; }
    }

    // jump + gravity
    if (keys['Space'] && grounded) { velY = JUMP; grounded = false; Sfx.jump(); }
    velY -= GRAV * dt;
    position.y += velY * dt;
    if (position.y <= EYE) { position.y = EYE; velY = 0; grounded = true; }

    // collision
    const p = { x: position.x, z: position.z };
    World.collide(p, RADIUS);
    position.x = p.x; position.z = p.z;

    // camera
    camera.position.copy(position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    return moving;
  }

  function damage(d) {
    hp = Math.max(0, hp - d);
    Sfx.hurt();
    return hp <= 0;
  }

  function heal(n) { hp = Math.min(maxHp, hp + n); }

  function reset() {
    position.set(0, EYE, 8);
    velY = 0; grounded = true;
    yaw = 0; pitch = 0;
    hp = maxHp;
    firing = false;
  }

  function stopFiring() { firing = false; }

  return {
    init, update, lock, locked, damage, heal, reset, stopFiring, position,
    get hp() { return hp; }, get maxHp() { return maxHp; },
    get firing() { return firing; },
    get yaw() { return yaw; },
  };
})();
