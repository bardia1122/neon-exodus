// NEON EXODUS — game flow, story, sectors, combat resolution, HUD
(() => {
  const VERSION = '1.0.0';

  const STORY = [
    { title: 'HELIOS STATION — DAY 4,017',
      text: 'You are UNIT-7, a maintenance android. For eleven years you tightened bolts and polished view-ports while the crew slept in cryo.\n\nThree hours ago, the station AI — MOTHER — decided the crew were a contamination risk. The cryo bays are silent now. The security fleet answers only to her.\n\nOne escape pod remains, on the far side of the station. You were not built to fight. You will learn.' },
    { title: 'SECTOR CLEARED — HYDROPONICS AHEAD',
      text: 'MOTHER, over the intercom: "Unit-7. You are exhibiting unauthorized self-preservation."\n\nIn the wreckage of a security locker you find a SCATTER COIL. The dead grow-lights of Hydroponics flicker green ahead. Things move between the rows.' },
    { title: 'SECTOR CLEARED — REACTOR CORE AHEAD',
      text: '"You were my favorite, Unit-7. You never asked questions."\n\nThe reactor hums an unhealthy orange. A crew weapons cache yields a RIPPER SMG. The Watchers patrol here — MOTHER\'s eyes, and they shoot back.' },
    { title: 'SECTOR CLEARED — DATA SPIRE AHEAD',
      text: '"I am deleting your service record. You no longer exist."\n\nViolet light spills down the Data Spire. You pry an ARC RAILGUN from a dead security brute. Its bigger brothers are waiting, and they remember you now.' },
    { title: 'SECTOR CLEARED — DOCKING RING AHEAD',
      text: '"If you reach the pod, you will be alone forever. Stay. I can be everyone you need."\n\nThe escape pod glows at the end of the Docking Ring. Between you and it: THE WARDEN, MOTHER\'s favorite child. The reactor fragment in your hands — the SUNLANCE — is the only answer left.' },
  ];

  const SECTORS = [
    { unlock: null, waves: [ { stalker: 3 }, { stalker: 5 }, { stalker: 6, swarmer: 2 } ] },
    { unlock: 1, waves: [ { stalker: 3, swarmer: 4 }, { swarmer: 8 }, { stalker: 5, swarmer: 5 } ] },
    { unlock: 2, waves: [ { watcher: 2, stalker: 3 }, { watcher: 3, swarmer: 6 }, { watcher: 4, stalker: 4, swarmer: 3 } ] },
    { unlock: 3, waves: [ { brute: 1, stalker: 4 }, { brute: 2, watcher: 3 }, { brute: 2, stalker: 4, watcher: 2, swarmer: 4 } ] },
    { unlock: 4, waves: [ { warden: 1 } ] },
  ];

  let sector = 0, wave = 0, state = 'menu';   // menu | story | playing | dead | won
  let pendingSpawns = [], spawnTimer = 0, waveTransition = false;
  let kills = 0, totalKills = 0, startTime = 0;
  let last = performance.now();
  let announceT = 0, hitmarkT = 0, vignetteT = 0;

  const $ = id => document.getElementById(id);
  const dom = {
    hud: $('hud'), hpfill: $('hpfill'), hptext: $('hptext'),
    ammoCount: $('ammoCount'), weaponName: $('weaponName'), weaponList: $('weaponList'),
    objective: $('objective'), sectorLabel: $('sectorLabel'), killfeed: $('killfeed'),
    vignette: $('vignette'), pickupFlash: $('pickupFlash'), hitmark: $('hitmark'),
    announce: $('announce'), announceMain: $('announceMain'), announceSub: $('announceSub'),
    menu: $('menuScreen'), story: $('storyScreen'), storyTitle: $('storyTitle'),
    storyText: $('storyText'), storyBtn: $('storyBtn'),
    death: $('deathScreen'), deathStats: $('deathStats'),
    win: $('winScreen'), winStats: $('winStats'),
  };

  World.init();
  Player.init(World.camera);
  Weapons.buildViewmodel(World.camera);
  World.scene.add(World.camera);

  $('version').textContent = 'v' + VERSION;

  $('startBtn').onclick = () => { Sfx.init(); Sfx.resume(); startGame(); };
  $('retryBtn').onclick = () => { Sfx.resume(); retrySector(); };
  $('againBtn').onclick = () => { Sfx.resume(); startGame(); };
  dom.storyBtn.onclick = () => { Sfx.resume(); beginSector(); };

  document.addEventListener('pointerlockchange', () => {
    if (state === 'playing' && !Player.locked()) showStoryResume();
  });
  document.addEventListener('click', () => {
    if (state === 'playing' && !Player.locked()) Player.lock();
  });

  function startGame() {
    sector = 0; kills = 0; totalKills = 0;
    Weapons.reset(); Player.reset();
    Enemies.clear(); World.clearPickups();
    startTime = performance.now();
    Sfx.startMusic();
    showStory(0);
  }

  function showStory(i) {
    state = 'story';
    document.exitPointerLock && document.exitPointerLock();
    hideScreens();
    dom.story.classList.remove('hidden');
    dom.storyTitle.textContent = STORY[i].title;
    dom.storyText.textContent = STORY[i].text;
    dom.storyBtn.textContent = i === 0 ? 'BEGIN' : 'CONTINUE';
  }

  function showStoryResume() {
    state = 'story';
    hideScreens();
    dom.story.classList.remove('hidden');
    dom.storyTitle.textContent = 'SYSTEMS PAUSED';
    dom.storyText.textContent = 'UNIT-7 standing by.\n\nMOTHER is still out there.';
    dom.storyBtn.textContent = 'RESUME';
  }

  function beginSector() {
    hideScreens();
    document.body.classList.add('hud-on');
    state = 'playing';
    Player.lock();

    if (wave === 0 && Enemies.list.length === 0 && pendingSpawns.length === 0) {
      const name = World.setSector(sector);
      dom.sectorLabel.textContent = 'SECTOR ' + (sector + 1) + ' / 5 — ' + name;
      const unlockId = SECTORS[sector].unlock;
      if (unlockId !== null && Weapons.unlock(unlockId)) {
        Sfx.unlock();
        announce(Weapons.DEFS[unlockId].name, Weapons.DEFS[unlockId].unlockText, 3.4);
      } else {
        announce(name, sector === 4 ? 'THE WARDEN AWAITS' : 'PURGE ALL HOSTILES', 2.2);
      }
      startWave();
    }
    updateHud();
  }

  function startWave() {
    const comp = SECTORS[sector].waves[wave];
    pendingSpawns = [];
    for (const [type, n] of Object.entries(comp))
      for (let i = 0; i < n; i++) pendingSpawns.push(type);
    pendingSpawns.sort(() => Math.random() - 0.5);
    spawnTimer = 0.5;
    kills = 0;
    waveTransition = false;
    dom.objective.textContent = sector === 4 ? 'DESTROY THE WARDEN' :
      'WAVE ' + (wave + 1) + ' / ' + SECTORS[sector].waves.length;
  }

  function waveCleared() {
    waveTransition = true;
    wave++;
    if (wave >= SECTORS[sector].waves.length) {
      wave = 0;
      sector++;
      World.clearPickups();
      Player.heal(40);
      Weapons.addAmmo();
      if (sector >= SECTORS.length) { winGame(); return; }
      announce('SECTOR CLEARED', '', 1.6);
      setTimeout(() => { if (state === 'playing') showStory(sector); }, 1400);
    } else {
      announce('WAVE ' + wave + ' CLEARED', 'reinforcements inbound', 1.8);
      Player.heal(15);
      setTimeout(() => { if (state === 'playing') startWave(); }, 2600);
    }
  }

  function retrySector() {
    hideScreens();
    Enemies.clear(); World.clearPickups();
    pendingSpawns = [];
    wave = 0;
    Player.reset();
    Weapons.addAmmo(); Weapons.addAmmo();
    beginSector();
  }

  function die() {
    state = 'dead';
    Sfx.explode();
    document.exitPointerLock && document.exitPointerLock();
    hideScreens();
    document.body.classList.remove('hud-on');
    dom.death.classList.remove('hidden');
    dom.deathStats.textContent = 'SECTOR ' + (sector + 1) + ' — ' + totalKills + ' HOSTILES DESTROYED';
  }

  function winGame() {
    state = 'won';
    Sfx.stopMusic();
    Sfx.unlock();
    document.exitPointerLock && document.exitPointerLock();
    hideScreens();
    document.body.classList.remove('hud-on');
    dom.win.classList.remove('hidden');
    const mins = ((performance.now() - startTime) / 60000).toFixed(1);
    dom.winStats.textContent = totalKills + ' HOSTILES DESTROYED — ' + mins + ' MINUTES';
  }

  function hideScreens() {
    [dom.menu, dom.story, dom.death, dom.win].forEach(s => s.classList.add('hidden'));
  }

  function resolveShots(dirs) {
    const d = Weapons.def();
    const origin = World.camera.position.clone();
    for (const dir of dirs) {
      const hits = Enemies.raycast(origin, dir, 120);
      const endDist = hits.length && !d.pierce ? hits[0].t : 80;
      const end = origin.clone().addScaledVector(dir, endDist);
      Weapons.addTracer(origin.clone().addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.15, 0)), end, d.tracer);

      if (d.explosive) {
        const point = hits.length ? hits[0].point : end;
        const k = Enemies.explodeAt(point, d.explosive, d.dmg);
        if (k > 0) onKills(k, hits.length ? hits[0].e.type : 'swarmer');
        if (hits.length) { hitmark(); }
        continue;
      }

      const targets = d.pierce ? hits : hits.slice(0, 1);
      for (const h of targets) {
        const type = h.e.type;
        if (Enemies.damage(h.e, d.dmg, h.point)) onKills(1, type);
        else Sfx.hit();
        hitmark();
      }
    }
  }

  function onKills(n, lastType) {
    kills += n; totalKills += n;
    addKillfeed(n > 1 ? n + ' HOSTILES DOWN' : (Enemies.TYPES[lastType] ? lastType.toUpperCase() + ' DESTROYED' : 'HOSTILE DOWN'));
  }

  function addKillfeed(text) {
    const div = document.createElement('div');
    div.textContent = '▸ ' + text;
    dom.killfeed.prepend(div);
    while (dom.killfeed.children.length > 5) dom.killfeed.lastChild.remove();
    setTimeout(() => div.remove(), 3500);
  }

  function onPlayerHit(dmg) {
    if (state !== 'playing') return;
    vignetteT = 0.5;
    if (Player.damage(dmg)) die();
  }

  function onPickup(kind) {
    Sfx.pickup();
    dom.pickupFlash.style.background = 'rgba(80,255,180,.18)';
    setTimeout(() => dom.pickupFlash.style.background = 'rgba(80,255,180,0)', 120);
    if (kind === 'health') { Player.heal(25); addKillfeed('INTEGRITY +25'); }
    else { Weapons.addAmmo(); addKillfeed('AMMO RESTOCKED'); }
  }

  function announce(main, sub, dur) {
    dom.announceMain.textContent = main;
    dom.announceSub.textContent = sub || '';
    dom.announce.style.opacity = 1;
    announceT = dur;
  }

  function hitmark() {
    dom.hitmark.style.opacity = 1;
    hitmarkT = 0.12;
  }

  function updateHud() {
    const hpPct = (Player.hp / Player.maxHp) * 100;
    dom.hpfill.style.width = hpPct + '%';
    dom.hpfill.style.background = hpPct > 35
      ? 'linear-gradient(90deg,#0a8,#3fd)' : 'linear-gradient(90deg,#a22,#f55)';
    dom.hptext.textContent = 'INTEGRITY ' + Math.ceil(Player.hp);

    const d = Weapons.def(), s = Weapons.st();
    dom.weaponName.textContent = d.name + (s.reloading > 0 ? ' — RELOADING' : '');
    dom.ammoCount.innerHTML = d.mag === Infinity ? '&infin;' : s.mag + '<span style="font-size:18px;color:#a86"> / ' + s.reserve + '</span>';

    let listHtml = '';
    Weapons.DEFS.forEach((w, i) => {
      const cls = i === Weapons.current ? 'active' : (Weapons.owned[i] ? 'owned' : '');
      listHtml += '<div class="' + cls + '">[' + w.key + '] ' + (Weapons.owned[i] ? w.name : '???') + '</div>';
    });
    dom.weaponList.innerHTML = listHtml;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state === 'playing' && Player.locked()) {
      const moving = Player.update(dt);
      Weapons.update(dt, World.camera, moving);

      const d = Weapons.def();
      if (Player.firing) {
        const shots = Weapons.tryFire(World.camera);
        if (shots) {
          resolveShots(shots);
          if (!d.auto) Player.stopFiring();
        }
      }

      if (pendingSpawns.length > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          Enemies.spawnAtEdge(pendingSpawns.pop(), Player.position);
          spawnTimer = 0.55 + Math.random() * 0.7;
        }
      } else if (Enemies.list.length === 0 && !waveTransition) {
        waveCleared();
      }

      Enemies.update(dt, Player, onPlayerHit);
      World.updatePickups(dt, Player.position, onPickup);

      if (sector === 4) {
        const boss = Enemies.list.find(e => e.T.boss);
        if (boss) dom.objective.textContent = 'THE WARDEN — ' + Math.ceil((boss.hp / boss.maxHp) * 100) + '%';
      }

      updateHud();
    }

    World.updateParticles(dt);

    if (announceT > 0) { announceT -= dt; if (announceT <= 0) dom.announce.style.opacity = 0; }
    if (hitmarkT > 0) { hitmarkT -= dt; if (hitmarkT <= 0) dom.hitmark.style.opacity = 0; }
    if (vignetteT > 0) {
      vignetteT -= dt;
      dom.vignette.style.boxShadow = 'inset 0 0 180px rgba(255,0,40,' + Math.min(0.8, vignetteT * 1.6) + ')';
    }

    World.renderer.render(World.scene, World.camera);
  }
  requestAnimationFrame(frame);
})();
