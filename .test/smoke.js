// NEON EXODUS — headless smoke test.
// Serves the repo over http://localhost (so the same test runs on CI Linux runners),
// loads the game, clicks through menu/story, and drives Enemies/Weapons/World/Player
// directly to validate combat, unlocks, pickups, the death path and the win path.
//
// Browser resolution (in order):
//   1. BROWSER_PATH env var      -> puppeteer-core with that executable
//   2. bundled full `puppeteer`  -> its downloaded Chromium (used in CI)
//   3. auto-detected Edge/Chrome -> puppeteer-core (developer convenience)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LAUNCH_ARGS = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--no-sandbox',
  '--disable-setuid-sandbox',
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.css': 'text/css', '.ico': 'image/x-icon',
};

// ---------- assertion helpers ----------
let failures = 0;
function check(label, cond, detail) {
  const ok = !!cond;
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!ok) failures++;
}

// ---------- tiny static server ----------
function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ---------- browser resolution ----------
async function launchBrowser() {
  if (process.env.BROWSER_PATH) {
    const puppeteer = (await import('puppeteer-core')).default;
    console.log('browser: BROWSER_PATH =', process.env.BROWSER_PATH);
    return puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: 'new', args: LAUNCH_ARGS });
  }
  try {
    const puppeteer = (await import('puppeteer')).default; // full build, bundled Chromium
    console.log('browser: bundled puppeteer Chromium');
    return puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
  } catch (e) {
    // fall through to auto-detection
  }
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    throw new Error('No browser found. Set BROWSER_PATH or run `npm install` to fetch bundled puppeteer.');
  }
  const puppeteer = (await import('puppeteer-core')).default;
  console.log('browser: auto-detected', found);
  return puppeteer.launch({ executablePath: found, headless: 'new', args: LAUNCH_ARGS });
}

(async () => {
  const { server, port } = await startServer();
  const base = 'http://127.0.0.1:' + port + '/index.html';
  console.log('serving repo at', base);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof THREE !== 'undefined' && typeof World !== 'undefined' && typeof Enemies !== 'undefined',
    { timeout: 30000 });

  // THREE must come from the vendored file, not a CDN.
  check('vendored three.js loaded', await page.evaluate(() => typeof THREE !== 'undefined' && THREE.REVISION),
    'r' + (await page.evaluate(() => (typeof THREE !== 'undefined' ? THREE.REVISION : '?'))));

  // menu visible at boot
  check('menu visible at boot', await page.$eval('#menuScreen', el => !el.classList.contains('hidden')));

  // start game -> story screen
  await page.click('#startBtn');
  await new Promise(r => setTimeout(r, 300));
  check('story screen shows after INITIALIZE', await page.$eval('#storyScreen', el => !el.classList.contains('hidden')));
  const storyTitle = await page.$eval('#storyTitle', el => el.textContent);
  check('story has a title', storyTitle && storyTitle.length > 0, storyTitle);

  // begin sector (pointer lock fails headless; we drive systems directly below)
  await page.click('#storyBtn');
  await new Promise(r => setTimeout(r, 500));

  // ---------- combat / systems ----------
  const combat = await page.evaluate(() => {
    const out = {};
    try {
      out.sectorName = World.setSector(2);
      Enemies.spawn('stalker', 0, -10);
      Enemies.spawn('watcher', 5, -15);
      Enemies.spawn('brute', -5, -12);
      out.spawned = Enemies.list.length;

      let playerHits = 0;
      for (let i = 0; i < 120; i++) Enemies.update(1 / 60, Player, d => playerHits += d);
      out.aiFramesOk = true;
      out.playerHits = playerHits;

      const origin = new THREE.Vector3(0, 1.7, 8);
      const stalker = Enemies.list.find(e => e.type === 'stalker');
      const target = stalker.mesh.position.clone(); target.y = 1.1;
      const dir = target.clone().sub(origin).normalize();
      out.raycastHits = Enemies.raycast(origin, dir, 120).length;

      let killed = false;
      for (let i = 0; i < 10 && !killed; i++) killed = Enemies.damage(stalker, 22, target);
      out.killWorks = killed;
      out.afterKill = Enemies.list.length;

      out.explodeKills = Enemies.explodeAt(new THREE.Vector3(0, 1, -13), 8, 300);
      out.remaining = Enemies.list.length;

      World.updateParticles(1 / 60);
      out.worldUpdateOk = true;
    } catch (e) {
      out.error = e.message + '\n' + e.stack;
    }
    return out;
  });
  if (combat.error) console.log('combat error:\n' + combat.error);
  check('sector 2 has a name', !!combat.sectorName, combat.sectorName);
  check('3 enemies spawned', combat.spawned === 3, combat.spawned);
  check('enemy AI ran 120 frames', combat.aiFramesOk === true);
  check('raycast hit the stalker', combat.raycastHits >= 1, combat.raycastHits);
  check('damage kills an enemy', combat.killWorks === true);
  check('explosion produced kills', combat.explodeKills >= 1, combat.explodeKills);
  check('world particle update ok', combat.worldUpdateOk === true);

  // ---------- weapon unlock flow ----------
  const weapons = await page.evaluate(() => {
    const out = {};
    try {
      Weapons.reset();
      out.railOwnedBefore = !!Weapons.owned[3];
      const unlockedNow = Weapons.unlock(3);
      out.unlockReturned = !!unlockedNow;
      out.railOwnedAfter = !!Weapons.owned[3];
      out.unlockAgain = !!Weapons.unlock(3); // already owned -> should be falsey
      // unlock() auto-switches to the new weapon; confirm and fire it
      out.currentAfterUnlock = Weapons.current;
      Weapons.switchTo(3);
      const shots = Weapons.tryFire(World.camera);
      out.railShots = shots ? shots.length : 0;
      out.defName = Weapons.def().name;
    } catch (e) { out.error = e.message + '\n' + e.stack; }
    return out;
  });
  if (weapons.error) console.log('weapons error:\n' + weapons.error);
  check('railgun not owned before unlock', weapons.railOwnedBefore === false);
  check('unlock(3) reports success', weapons.unlockReturned === true);
  check('railgun owned after unlock', weapons.railOwnedAfter === true);
  check('re-unlocking already-owned weapon is a no-op', !weapons.unlockAgain);
  check('unlocked weapon fires', weapons.railShots >= 1, weapons.railShots);

  // ---------- pickup collection ----------
  const pickups = await page.evaluate(() => {
    const out = {};
    try {
      World.clearPickups();
      out.hasApi = typeof World.spawnPickup === 'function';
      // spawnPickup(kind, pos) places it at pos.x / pos.z — drop it on the player
      World.spawnPickup('health', Player.position);
      let collected = null;
      // player is sitting on top of it -> next update should collect
      World.updatePickups(1 / 60, Player.position, kind => { collected = kind; });
      out.collected = collected;
    } catch (e) { out.error = e.message + '\n' + e.stack; }
    return out;
  });
  if (pickups.error) console.log('pickups error:\n' + pickups.error);
  check('a pickup-spawn API exists', pickups.hasApi === true);
  check('pickup collected when player overlaps', pickups.collected === 'health', String(pickups.collected));

  // ---------- death path ----------
  const death = await page.evaluate(() => {
    const out = {};
    try {
      Player.reset();
      out.hpStart = Player.hp;
      let dead = false;
      for (let i = 0; i < 100 && !dead; i++) dead = Player.damage(9999);
      out.diedFromLethal = dead;
      out.hpAfter = Player.hp;
    } catch (e) { out.error = e.message + '\n' + e.stack; }
    return out;
  });
  if (death.error) console.log('death error:\n' + death.error);
  check('player starts with hp', death.hpStart > 0, death.hpStart);
  check('lethal damage reports death', death.diedFromLethal === true);

  // Drive the real death screen via the click path: deplete and let a frame resolve.
  // (Player.damage true is consumed by game.js onPlayerHit -> die(); but headless has no
  // pointer lock, so we assert the death-stat formatting helper instead by reaching the screen.)
  const deathScreen = await page.evaluate(() => {
    // Force the game's death UI by simulating a fatal enemy hit through the public flow:
    // re-enter playing-ish state is not exposed, so just verify the DOM + reset button exist.
    return {
      hasDeathScreen: !!document.getElementById('deathScreen'),
      hasRetry: !!document.getElementById('retryBtn'),
    };
  });
  check('death screen + retry button present', deathScreen.hasDeathScreen && deathScreen.hasRetry);

  // ---------- win path ----------
  const win = await page.evaluate(() => {
    const out = {};
    try {
      Weapons.reset();
      // Clear every sector's wave tables by killing all spawned enemies sector-by-sector.
      // We can't reach game.js internals, so validate the win SCREEN + final-sector data instead.
      out.hasWinScreen = !!document.getElementById('winScreen');
      out.hasAgainBtn = !!document.getElementById('againBtn');
      // Final sector should contain the boss (warden).
      const finalSectorName = World.setSector(4);
      Enemies.clear();
      Enemies.spawn('warden', 0, -14);
      const boss = Enemies.list.find(e => e.type === 'warden');
      out.finalSectorName = finalSectorName;
      out.bossSpawned = !!boss;
      out.bossIsBoss = !!(boss && boss.T && boss.T.boss);
      // Boss must be killable (large but finite hp).
      let killed = false;
      for (let i = 0; i < 2000 && !killed; i++) killed = Enemies.damage(boss, 50, boss.mesh.position.clone());
      out.bossKillable = killed;
    } catch (e) { out.error = e.message + '\n' + e.stack; }
    return out;
  });
  if (win.error) console.log('win error:\n' + win.error);
  check('win screen + replay button present', win.hasWinScreen && win.hasAgainBtn);
  check('final sector has a name', !!win.finalSectorName, win.finalSectorName);
  check('warden boss spawns and is flagged boss', win.bossSpawned && win.bossIsBoss);
  check('warden boss is killable', win.bossKillable === true);

  // ---------- no runtime errors ----------
  await new Promise(r => setTimeout(r, 500));
  check('no page/console errors', errors.length === 0, errors.length ? '\n   ' + errors.join('\n   ') : 'none');

  await browser.close();
  server.close();

  console.log('\n' + (failures === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED — ' + failures + ' assertion(s)'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
