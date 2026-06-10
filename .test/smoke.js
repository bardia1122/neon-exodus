// Smoke test: load the game in headless Edge, click through menu/story, simulate combat frames.
(async () => {
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file:///D:/game_making/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof World !== 'undefined', { timeout: 30000 });

  // menu visible?
  const menuVisible = await page.$eval('#menuScreen', el => !el.classList.contains('hidden'));
  console.log('menu visible:', menuVisible);

  // start game -> story screen
  await page.click('#startBtn');
  await new Promise(r => setTimeout(r, 300));
  const storyVisible = await page.$eval('#storyScreen', el => !el.classList.contains('hidden'));
  const storyTitle = await page.$eval('#storyTitle', el => el.textContent);
  console.log('story visible:', storyVisible, '|', storyTitle);

  // begin sector (pointer lock will fail headless; force-run gameplay path manually)
  await page.click('#storyBtn');
  await new Promise(r => setTimeout(r, 500));

  // Drive systems directly to validate combat math without pointer lock
  const combat = await page.evaluate(() => {
    const out = {};
    try {
      out.sectorName = World.setSector(2);
      Enemies.spawn('stalker', 0, -10);
      Enemies.spawn('watcher', 5, -15);
      Enemies.spawn('brute', -5, -12);
      out.spawned = Enemies.list.length;

      // simulate enemy AI + bolts for 120 frames
      let playerHits = 0;
      for (let i = 0; i < 120; i++) Enemies.update(1 / 60, Player, d => playerHits += d);
      out.aiFramesOk = true;
      out.playerHits = playerHits;

      // raycast a shot straight at the stalker
      const origin = new THREE.Vector3(0, 1.7, 8);
      const stalker = Enemies.list.find(e => e.type === 'stalker');
      const target = stalker.mesh.position.clone(); target.y = 1.1;
      const dir = target.clone().sub(origin).normalize();
      const hits = Enemies.raycast(origin, dir, 120);
      out.raycastHits = hits.length;

      // damage until kill, check drop/score path
      let killed = false;
      for (let i = 0; i < 10 && !killed; i++) killed = Enemies.damage(stalker, 22, target);
      out.killWorks = killed;
      out.afterKill = Enemies.list.length;

      // explosion
      const k = Enemies.explodeAt(new THREE.Vector3(0, 1, -13), 8, 300);
      out.explodeKills = k;
      out.remaining = Enemies.list.length;

      // weapons
      Weapons.unlock(3);
      out.railOwned = Weapons.owned[3];
      const shots = Weapons.tryFire(World.camera);
      out.railShots = shots ? shots.length : 0;

      // particles + pickups update
      World.updateParticles(1 / 60);
      World.updatePickups(1 / 60, Player.position, () => {});
      out.worldUpdateOk = true;

      // player movement
      const before = Player.position.z;
      // simulate W key
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      for (let i = 0; i < 30; i++) Player.update(1 / 60);
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      out.movedForward = (before - Player.position.z).toFixed(2); // yaw 0 faces -Z so z should decrease
    } catch (e) {
      out.error = e.message + '\n' + e.stack;
    }
    return out;
  });
  console.log(JSON.stringify(combat, null, 2));

  await new Promise(r => setTimeout(r, 1000));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
